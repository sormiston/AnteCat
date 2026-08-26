-- Stakes: who owes what for an order item (ledger only -- no payment processing)
CREATE TABLE order_item_stakes (
    stake_id           SERIAL PRIMARY KEY,
    order_item_id      INTEGER NOT NULL REFERENCES order_items(order_item_id),
    user_id            UUID NOT NULL REFERENCES auth.users(id),
    stake_qty          INTEGER NOT NULL CHECK (stake_qty > 0),
    stake_amount_cents INTEGER NOT NULL
    -- stake_amount_cents is a ledger figure only -- no payment processing in-app
);

-- Trigger: stakes cannot push an order item past its capacity ceiling
-- (threshold_qty for threshold_bundle products, max_quantity for tiered products)
-- Overflow is rejected outright, never clamped.
CREATE OR REPLACE FUNCTION check_stake_capacity() RETURNS TRIGGER AS $$
DECLARE
  v_pricing_type TEXT;
  v_threshold    INTEGER;
  v_max_qty      INTEGER;
  v_current_qty  INTEGER;
BEGIN
  SELECT p.pricing_type, pbt.threshold_qty, oi.max_quantity
    INTO v_pricing_type, v_threshold, v_max_qty
  FROM order_items oi
  JOIN products p ON p.product_id = oi.product_id
  LEFT JOIN product_bundle_thresholds pbt ON pbt.product_id = p.product_id
  WHERE oi.order_item_id = NEW.order_item_id;

  SELECT COALESCE(SUM(stake_qty), 0) INTO v_current_qty
  FROM order_item_stakes
  WHERE order_item_id = NEW.order_item_id
    AND stake_id != COALESCE(NEW.stake_id, -1);  -- exclude self on UPDATE

  IF v_pricing_type = 'threshold_bundle' AND v_current_qty + NEW.stake_qty > v_threshold THEN
    RAISE EXCEPTION 'stake would exceed bundle threshold of % (already at %)', v_threshold, v_current_qty;
  END IF;

  IF v_pricing_type = 'tiered' AND v_max_qty IS NOT NULL AND v_current_qty + NEW.stake_qty > v_max_qty THEN
    RAISE EXCEPTION 'stake would exceed available quantity of % (already at %)', v_max_qty, v_current_qty;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_stake_capacity
BEFORE INSERT OR UPDATE ON order_item_stakes
FOR EACH ROW EXECUTE FUNCTION check_stake_capacity();

-- Trigger: a staker must be a member of the syndicate that owns the parent order
-- (order_item_stakes.user_id -> order_items -> orders -> syndicate_id)
CREATE OR REPLACE FUNCTION check_stake_user_is_member() RETURNS TRIGGER AS $$
DECLARE
  v_syndicate_id INTEGER;
BEGIN
  SELECT o.syndicate_id INTO v_syndicate_id
  FROM order_items oi
  JOIN orders o ON o.order_id = oi.order_id
  WHERE oi.order_item_id = NEW.order_item_id;

  IF NOT EXISTS (
    SELECT 1 FROM syndicate_members
    WHERE syndicate_id = v_syndicate_id
      AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'user_id must be a member of the syndicate that owns this order';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_stake_user_is_member
BEFORE INSERT OR UPDATE ON order_item_stakes
FOR EACH ROW EXECUTE FUNCTION check_stake_user_is_member();

-- Trigger: keep order_items.quantity in sync with SUM(order_item_stakes.stake_qty).
-- Runs AFTER the two BEFORE triggers above have already rejected any overflow,
-- so this write-back can never violate order_items' own quantity <= max_quantity
-- CHECK. Handles DELETE (no NEW row) and the unlikely case of a stake being
-- reassigned to a different order_item_id on UPDATE (resyncs both parents).
CREATE OR REPLACE FUNCTION sync_order_item_quantity() RETURNS TRIGGER AS $$
DECLARE
  v_order_item_id INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_order_item_id := OLD.order_item_id;
  ELSE
    v_order_item_id := NEW.order_item_id;
  END IF;

  UPDATE order_items
  SET quantity = COALESCE(
    (SELECT SUM(stake_qty) FROM order_item_stakes WHERE order_item_id = v_order_item_id), 0
  )
  WHERE order_item_id = v_order_item_id;

  IF TG_OP = 'UPDATE' AND OLD.order_item_id IS DISTINCT FROM NEW.order_item_id THEN
    UPDATE order_items
    SET quantity = COALESCE(
      (SELECT SUM(stake_qty) FROM order_item_stakes WHERE order_item_id = OLD.order_item_id), 0
    )
    WHERE order_item_id = OLD.order_item_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_order_item_quantity
AFTER INSERT OR UPDATE OR DELETE ON order_item_stakes
FOR EACH ROW EXECUTE FUNCTION sync_order_item_quantity();

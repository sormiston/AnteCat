-- Trigger: when a threshold_bundle order_item's stakes fill its threshold_qty,
-- re-derive every constituent stake's stake_amount_cents by smallest-remainder-first
-- apportionment so they sum exactly to bundle_price_cents.
--
-- Each stake's ideal share is bundle_price_cents * stake_qty / threshold_qty.
-- Every stake gets floor(ideal share); the cents left over (always fewer than
-- there are stakes) go one-per-stake to whichever stakes had the SMALLEST
-- fractional remainder, ties broken by ascending stake_id for determinism.
-- This is the mirror of the Hamilton (largest-remainder) method: it routes the
-- marginal cent to whoever's ideal share was already closest to the floor,
-- at the cost of maximizing (rather than minimizing) aggregate rounding
-- distortion across the item's stakes.
--
-- Fires AFTER INSERT OR UPDATE OF stake_qty only -- never on updates to
-- stake_amount_cents itself -- so this trigger's own bulk rewrite of that
-- column doesn't re-trigger itself. Before threshold_qty is reached, stakes
-- keep whatever stake_amount_cents the caller supplied at INSERT; this
-- trigger is the only thing that revises it, and only once, the instant the
-- bundle fills.
CREATE OR REPLACE FUNCTION apply_smallest_remainder_apportionment() RETURNS TRIGGER AS $$
DECLARE
  v_pricing_type   TEXT;
  v_threshold_qty  INTEGER;
  v_bundle_price   INTEGER;
  v_total_qty      INTEGER;
BEGIN
  SELECT p.pricing_type, pbt.threshold_qty, pbt.bundle_price_cents
    INTO v_pricing_type, v_threshold_qty, v_bundle_price
  FROM order_items oi
  JOIN products p ON p.product_id = oi.product_id
  LEFT JOIN product_bundle_thresholds pbt ON pbt.product_id = p.product_id
  WHERE oi.order_item_id = NEW.order_item_id;

  IF v_pricing_type IS DISTINCT FROM 'threshold_bundle' THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(SUM(stake_qty), 0) INTO v_total_qty
  FROM order_item_stakes
  WHERE order_item_id = NEW.order_item_id;

  IF v_total_qty < v_threshold_qty THEN
    RETURN NULL;
  END IF;

  WITH shares AS (
    SELECT
      stake_id,
      (v_bundle_price::BIGINT * stake_qty) / v_threshold_qty AS base_cents,
      (v_bundle_price::BIGINT * stake_qty) % v_threshold_qty AS remainder
    FROM order_item_stakes
    WHERE order_item_id = NEW.order_item_id
  ),
  ranked AS (
    SELECT
      stake_id,
      base_cents,
      ROW_NUMBER() OVER (ORDER BY remainder ASC, stake_id ASC) AS rank,
      v_bundle_price - SUM(base_cents) OVER () AS leftover_cents
    FROM shares
  )
  UPDATE order_item_stakes s
  SET stake_amount_cents = ranked.base_cents + CASE WHEN ranked.rank <= ranked.leftover_cents THEN 1 ELSE 0 END
  FROM ranked
  WHERE s.stake_id = ranked.stake_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_apply_smallest_remainder_apportionment
AFTER INSERT OR UPDATE OF stake_qty ON order_item_stakes
FOR EACH ROW EXECUTE FUNCTION apply_smallest_remainder_apportionment();

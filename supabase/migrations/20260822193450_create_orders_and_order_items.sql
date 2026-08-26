-- Orders: coordination records, not fulfillment records. Belong to syndicates.
CREATE TABLE orders (
    order_id      SERIAL PRIMARY KEY,
    syndicate_id  INTEGER NOT NULL REFERENCES syndicates(syndicate_id),
    opened_by     UUID NOT NULL REFERENCES auth.users(id),
    status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'executed')),
    opened_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    deadline_at   TIMESTAMPTZ NOT NULL,
    closed_at     TIMESTAMPTZ,
    closed_by     UUID REFERENCES auth.users(id),   -- NULL if closed automatically at deadline
    executed_at   TIMESTAMPTZ,
    executed_by   UUID REFERENCES auth.users(id),
    CHECK (deadline_at > opened_at),
    CHECK (executed_at IS NULL OR closed_at IS NULL OR executed_at >= closed_at)
);

-- Trigger: orders.status can only move forward (open -> closed -> executed)
CREATE OR REPLACE FUNCTION check_order_status_transition() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'open' AND NEW.status NOT IN ('open', 'closed') THEN
    RAISE EXCEPTION 'orders can only move from open to closed';
  ELSIF OLD.status = 'closed' AND NEW.status NOT IN ('closed', 'executed') THEN
    RAISE EXCEPTION 'orders can only move from closed to executed';
  ELSIF OLD.status = 'executed' AND NEW.status != 'executed' THEN
    RAISE EXCEPTION 'executed orders cannot change status';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_status_transition
BEFORE UPDATE OF status ON orders
FOR EACH ROW EXECUTE FUNCTION check_order_status_transition();

CREATE TABLE order_items (
    order_item_id     SERIAL PRIMARY KEY,
    order_id          INTEGER NOT NULL REFERENCES orders(order_id),
    product_id        INTEGER NOT NULL REFERENCES products(product_id),
    quantity          INTEGER NOT NULL DEFAULT 0,
    unit_price_cents  INTEGER NOT NULL,
    max_quantity      INTEGER CHECK (max_quantity IS NULL OR max_quantity > 0),
    -- tiered items only; NULL = uncapped. Threshold items are capped via threshold_qty instead.
    CHECK (quantity >= 0),
    CHECK (max_quantity IS NULL OR quantity <= max_quantity)
    -- quantity is trigger-maintained from order_item_stakes -- see next migration
    -- unit_price_cents: fixed at creation for threshold_bundle; live for tiered
);

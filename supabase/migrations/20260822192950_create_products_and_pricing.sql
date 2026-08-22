-- Products: external items being pooled for. This platform holds no inventory.
CREATE TABLE products (
    product_id    SERIAL PRIMARY KEY,
    name          TEXT NOT NULL,
    description   TEXT,
    pricing_type  TEXT NOT NULL CHECK (pricing_type IN ('threshold_bundle', 'tiered')),
    created_at    TIMESTAMPTZ DEFAULT now()
);

-- threshold_bundle products only
CREATE TABLE product_bundle_thresholds (
    product_id     INTEGER PRIMARY KEY REFERENCES products(product_id),
    threshold_qty  INTEGER NOT NULL CHECK (threshold_qty > 0),
    bundle_price   NUMERIC(10,2) NOT NULL
    -- per-unit price = bundle_price / threshold_qty
);

-- tiered products only
CREATE TABLE product_price_tier_plans (
    product_id  INTEGER PRIMARY KEY REFERENCES products(product_id),
    tiers       JSONB NOT NULL
    -- e.g. {"1": 24.99, "5": 21.50, "10": 18.00}
    -- keys = min cumulative qty (string), values = unit price at that qty and above
);

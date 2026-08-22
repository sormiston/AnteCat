-- Local dev fixtures: product catalog only. syndicates/orders/stakes need real
-- auth.users rows (GoTrue-managed) that don't exist at seed time -- create a
-- local test user via Studio (http://127.0.0.1:54323) or `supabase auth`
-- first, then insert those fixtures manually.

INSERT INTO products (product_id, name, description, pricing_type) VALUES
  (1, 'Widget 6-Pack', 'Bulk widgets sold in fixed 6-packs', 'threshold_bundle'),
  (2, 'Bulk Gizmos', 'Gizmos priced per-unit on a sliding scale', 'tiered');

INSERT INTO product_bundle_thresholds (product_id, threshold_qty, bundle_price) VALUES
  (1, 6, 59.94);

INSERT INTO product_price_tier_plans (product_id, tiers) VALUES
  (2, '{"1": 24.99, "5": 21.50, "10": 18.00}');

SELECT setval('products_product_id_seq', (SELECT MAX(product_id) FROM products));

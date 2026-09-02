-- service_role is used directly (not via PostgREST) by the integration test
-- suite in tests/db-client-integration -- these grants cover the tables and
-- view those tests read and write.
GRANT USAGE ON SCHEMA public TO service_role;

-- Read-only: order_items/order_item_stakes triggers look up pricing config
-- from these (SECURITY INVOKER, so they run as the calling role).
GRANT SELECT ON products TO service_role;
GRANT SELECT ON product_bundle_thresholds TO service_role;
GRANT SELECT ON product_price_tiers TO service_role;
GRANT SELECT ON syndicates TO service_role;
GRANT SELECT ON syndicate_members TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON orders TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON order_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON order_item_stakes TO service_role;
GRANT SELECT ON order_item_resolution TO service_role;

-- Derived resolution (not stored). Items resolve early on hitting their own
-- capacity ceiling, independent of the parent order's status; everything else
-- waits for the order to close.
CREATE TYPE order_item_resolution_status AS ENUM ('open', 'succeeded', 'maxed_out');

CREATE OR REPLACE VIEW order_item_resolution AS
SELECT
  oi.order_item_id,
  CASE
    WHEN p.pricing_type = 'threshold_bundle' AND oi.quantity >= pbt.threshold_qty THEN 'succeeded'
    WHEN p.pricing_type = 'tiered' AND oi.max_quantity IS NOT NULL AND oi.quantity >= oi.max_quantity THEN 'maxed_out'
    ELSE 'open'
  END::order_item_resolution_status AS resolution_status
FROM order_items oi
JOIN orders o ON o.order_id = oi.order_id
JOIN products p ON p.product_id = oi.product_id
LEFT JOIN product_bundle_thresholds pbt ON pbt.product_id = p.product_id;

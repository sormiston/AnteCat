-- Local dev fixtures: product catalog, one syndicate (admin + members), and
-- one order sitting in a semi-finished, still-open state.

INSERT INTO products (product_id, name, description, pricing_type) VALUES
  (1, 'Widget 6-Pack', 'Bulk widgets sold in fixed 6-packs', 'threshold_bundle'),
  (2, 'Bulk Gizmos', 'Gizmos priced per-unit on a sliding scale', 'tiered');

INSERT INTO product_bundle_thresholds (product_id, threshold_qty, bundle_price) VALUES
  (1, 6, 5000);

INSERT INTO product_price_tiers (product_id, qty_floor, unit_price) VALUES
  (2, 0, 2499),
  (2, 5, 2150),
  (2, 10, 1800);

SELECT setval('products_product_id_seq', (SELECT MAX(product_id) FROM products));

-- Fake auth users (GoTrue-managed, but local dev Postgres can seed them
-- directly): 1 admin + 4 members, all password 'password123'.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES
  ('00000000-0000-0000-0000-000000000000', 'a1111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'admin@example.test',   crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a2222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'member2@example.test', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a3333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'member3@example.test', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a4444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated', 'member4@example.test', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a5555555-5555-5555-5555-555555555555', 'authenticated', 'authenticated', 'member5@example.test', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

INSERT INTO auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) VALUES
  (gen_random_uuid(), 'a1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', jsonb_build_object('sub', 'a1111111-1111-1111-1111-111111111111', 'email', 'admin@example.test'),   'email', now(), now(), now()),
  (gen_random_uuid(), 'a2222222-2222-2222-2222-222222222222', 'a2222222-2222-2222-2222-222222222222', jsonb_build_object('sub', 'a2222222-2222-2222-2222-222222222222', 'email', 'member2@example.test'), 'email', now(), now(), now()),
  (gen_random_uuid(), 'a3333333-3333-3333-3333-333333333333', 'a3333333-3333-3333-3333-333333333333', jsonb_build_object('sub', 'a3333333-3333-3333-3333-333333333333', 'email', 'member3@example.test'), 'email', now(), now(), now()),
  (gen_random_uuid(), 'a4444444-4444-4444-4444-444444444444', 'a4444444-4444-4444-4444-444444444444', jsonb_build_object('sub', 'a4444444-4444-4444-4444-444444444444', 'email', 'member4@example.test'), 'email', now(), now(), now()),
  (gen_random_uuid(), 'a5555555-5555-5555-5555-555555555555', 'a5555555-5555-5555-5555-555555555555', jsonb_build_object('sub', 'a5555555-5555-5555-5555-555555555555', 'email', 'member5@example.test'), 'email', now(), now(), now());

-- Syndicate + membership. Inserted in one explicit transaction on the
-- convention that admin_user_id should also be a syndicate_members row,
-- even though nothing currently enforces that (see backend.md).
BEGIN;

INSERT INTO syndicates (syndicate_id, name, admin_user_id) VALUES
  (1, 'Widget & Gizmo Syndicate', 'a1111111-1111-1111-1111-111111111111');

INSERT INTO syndicate_members (syndicate_id, user_id) VALUES
  (1, 'a1111111-1111-1111-1111-111111111111'),
  (1, 'a2222222-2222-2222-2222-222222222222'),
  (1, 'a3333333-3333-3333-3333-333333333333'),
  (1, 'a4444444-4444-4444-4444-444444444444'),
  (1, 'a5555555-5555-5555-5555-555555555555');

COMMIT;

SELECT setval('syndicates_syndicate_id_seq', (SELECT MAX(syndicate_id) FROM syndicates));

-- One order, still open, deadline a few days out, sitting in a semi-finished
-- (pending) state on both items.
INSERT INTO orders (order_id, syndicate_id, status, deadline_at) VALUES
  (1, 1, 'open', now() + interval '4 days');

SELECT setval('orders_order_id_seq', (SELECT MAX(order_id) FROM orders));

-- unit_price is omitted deliberately: trg_init_order_item_unit_price derives it
-- from each product's pricing config (833 = 5000/6 for the bundle, 2499 from the
-- qty_floor = 0 tier for the tiered product).
INSERT INTO order_items (order_item_id, order_id, product_id, max_quantity) VALUES
  (1, 1, 1, NULL),   -- Widget 6-Pack
  (2, 1, 2, 2500);   -- Bulk Gizmos

SELECT setval('order_items_order_item_id_seq', (SELECT MAX(order_item_id) FROM order_items));

-- order_items.quantity is trigger-maintained off these stakes. stake_amount is
-- omitted for the same reason unit_price is above: trg_sync_stake_amount_on_stake_qty
-- derives it from the item's unit_price.
INSERT INTO order_item_stakes (order_item_id, user_id, stake_qty) VALUES
  (1, 'a2222222-2222-2222-2222-222222222222', 1),
  (1, 'a3333333-3333-3333-3333-333333333333', 2),
  (2, 'a4444444-4444-4444-4444-444444444444', 3),
  (1, 'a4444444-4444-4444-4444-444444444444', 2);

SELECT setval('order_item_stakes_stake_id_seq', (SELECT MAX(stake_id) FROM order_item_stakes));

-- Local dev fixtures: product catalog, one syndicate (admin + members), and
-- one order sitting in a semi-finished, still-open state.

INSERT INTO products (product_id, name, description, pricing_type, unit_of_quantity, qty_step) VALUES
  (1, 'Widget 6-Pack', 'Bulk widgets sold in fixed 6-packs', 'threshold_bundle', 'widget', 1),
  (2, 'Bulk Gizmos', 'Gizmos priced per-unit on a sliding scale', 'tiered', 'gram', 100);

INSERT INTO product_bundle_thresholds (product_id, threshold_qty, bundle_price_cents) VALUES
  (1, 6, 5994);

INSERT INTO product_price_tier_plans (product_id, tiers) VALUES
  (2, '{"100": 2499, "500": 2150, "1000": 1800}');

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

-- Syndicate + membership. check_admin_is_member() is a deferred constraint
-- trigger that only fires at COMMIT, so the syndicate row and its admin's
-- membership row must land in one explicit transaction.
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
INSERT INTO orders (order_id, syndicate_id, opened_by, status, deadline_at) VALUES
  (1, 1, 'a1111111-1111-1111-1111-111111111111', 'open', now() + interval '4 days');

SELECT setval('orders_order_id_seq', (SELECT MAX(order_id) FROM orders));

INSERT INTO order_items (order_item_id, order_id, product_id, unit_price_cents, max_quantity) VALUES
  (1, 1, 1, 999, NULL),   -- Widget 6-Pack
  (2, 1, 2, 2499, 2500);    -- Bulk Gizmos

SELECT setval('order_items_order_item_id_seq', (SELECT MAX(order_item_id) FROM order_items));

-- order_items.quantity is trigger-maintained off these stakes.
INSERT INTO order_item_stakes (order_item_id, user_id, stake_qty, stake_amount_cents) VALUES
  (1, 'a2222222-2222-2222-2222-222222222222', 2, 1998),
  (1, 'a3333333-3333-3333-3333-333333333333', 1, 999),
  (2, 'a4444444-4444-4444-4444-444444444444', 200, 4998);

SELECT setval('order_item_stakes_stake_id_seq', (SELECT MAX(stake_id) FROM order_item_stakes));

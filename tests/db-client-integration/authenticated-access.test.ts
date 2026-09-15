import { afterEach, describe, expect, it } from "vitest";
import {
  ADMIN_USER_ID,
  cleanupOrder,
  createAnonClient,
  createOrderItem,
  createServiceRoleClient,
  createTestOrder,
  MEMBER_2,
  MEMBER_3,
  signInAs,
  SYNDICATE_ID,
  THRESHOLD_PRODUCT_ID,
  TIERED_PRODUCT_ID,
} from "./helpers";

// Everything above this file talks to Postgres as service_role, which bypasses
// grants entirely. These tests use the anon key the app itself ships with, so
// they exercise what a signed-in demo user can actually reach through
// PostgREST -- the authenticated grants in
// supabase/migrations/20260901162710_grant_service_role_privileges.sql.
//
// There is no RLS (SPEC.md's Architectural Decisions), so these assert the
// role boundary only: which tables authenticated may touch at all, not which
// rows. Anything row-scoped is the trust call this phase accepts.
describe("authenticated role grants", () => {
  const service = createServiceRoleClient();
  let orderId: number;

  afterEach(async () => {
    await cleanupOrder(service, orderId);
  });

  it("gives an unauthenticated client nothing to read", async () => {
    orderId = await createTestOrder(service);
    const anon = createAnonClient();

    const { error } = await anon.from("order_items").select("order_item_id");
    expect(error).not.toBeNull();
  });

  it("reads an order, its items, and the nested pricing config in one request", async () => {
    orderId = await createTestOrder(service);
    const bundleItemId = await createOrderItem(
      service,
      orderId,
      THRESHOLD_PRODUCT_ID,
    );
    const tieredItemId = await createOrderItem(
      service,
      orderId,
      TIERED_PRODUCT_ID,
      { maxQuantity: 20 },
    );
    await service
      .from("order_item_stakes")
      .insert({ order_item_id: bundleItemId, user_id: MEMBER_3, stake_qty: 2 });

    const member = await signInAs("member2@example.test");

    // The shape the order list and detail screens both read under
    // ['order', orderId].
    const { data, error } = await member
      .from("orders")
      .select(
        `order_id, syndicate_id, status, opened_at, deadline_at, closed_at, executed_at,
         order_items (
           order_item_id, quantity, unit_price, max_quantity,
           products ( product_id, name, description, pricing_type,
                      product_bundle_thresholds ( threshold_qty, bundle_price ),
                      product_price_tiers ( qty_floor, unit_price ) ),
           order_item_stakes ( stake_id, user_id, stake_qty, stake_amount )
         )`,
      )
      .eq("order_id", orderId)
      .single();

    expect(error).toBeNull();
    expect(data?.status).toBe("open");
    expect(data?.order_items).toHaveLength(2);

    const bundle = data?.order_items.find(
      (item) => item.order_item_id === bundleItemId,
    );
    expect(bundle?.products?.pricing_type).toBe("threshold_bundle");
    expect(bundle?.products?.product_bundle_thresholds).not.toBeNull();
    expect(bundle?.order_item_stakes).toHaveLength(1);

    const tiered = data?.order_items.find(
      (item) => item.order_item_id === tieredItemId,
    );
    expect(tiered?.products?.product_price_tiers.length).toBeGreaterThan(0);
  });

  it("labels a stake's owner through syndicate_member_profiles", async () => {
    orderId = await createTestOrder(service);
    const member = await signInAs("member2@example.test");

    const { data, error } = await member
      .from("syndicate_member_profiles")
      .select("user_id, email")
      .eq("syndicate_id", SYNDICATE_ID);

    expect(error).toBeNull();
    expect(data?.find((row) => row.user_id === ADMIN_USER_ID)?.email).toBe(
      "admin@example.test",
    );
  });

  it("commits, adjusts, and withdraws a member's own stake", async () => {
    orderId = await createTestOrder(service);
    const itemId = await createOrderItem(service, orderId, TIERED_PRODUCT_ID, {
      maxQuantity: 20,
    });

    const member = await signInAs("member2@example.test");
    const stake = { order_item_id: itemId, user_id: MEMBER_2 };
    const onConflict = { onConflict: "order_item_id,user_id" };

    const { error: commitError } = await member
      .from("order_item_stakes")
      .upsert({ ...stake, stake_qty: 3 }, onConflict);
    expect(commitError).toBeNull();

    const { error: adjustError } = await member
      .from("order_item_stakes")
      .upsert({ ...stake, stake_qty: 7 }, onConflict);
    expect(adjustError).toBeNull();

    // sync_order_item_quantity's own UPDATE order_items runs as authenticated
    // too -- this is what the UPDATE grant on order_items is for.
    const { data: adjusted } = await member
      .from("order_items")
      .select("quantity")
      .eq("order_item_id", itemId)
      .single();
    expect(adjusted?.quantity).toBe(7);

    const { error: withdrawError } = await member
      .from("order_item_stakes")
      .delete()
      .eq("order_item_id", itemId)
      .eq("user_id", MEMBER_2);
    expect(withdrawError).toBeNull();

    const { data: withdrawn } = await member
      .from("order_items")
      .select("quantity")
      .eq("order_item_id", itemId)
      .single();
    expect(withdrawn?.quantity).toBe(0);
  });

  it("refuses to let a member create an order item", async () => {
    orderId = await createTestOrder(service);
    const member = await signInAs("member2@example.test");

    // Items come from seed.sql for this milestone -- no client creates one.
    const { error } = await member
      .from("order_items")
      .insert({ order_id: orderId, product_id: TIERED_PRODUCT_ID });
    expect(error).not.toBeNull();
  });

  it("lets the admin close an order, after which stakes stop being writable", async () => {
    orderId = await createTestOrder(service);
    const itemId = await createOrderItem(service, orderId, TIERED_PRODUCT_ID, {
      maxQuantity: 20,
    });
    await service
      .from("order_item_stakes")
      .insert({ order_item_id: itemId, user_id: MEMBER_2, stake_qty: 3 });

    // Nothing in the database ties this UPDATE to the syndicate's admin -- the
    // client gates it on roles.ts, and RLS would be what enforces it.
    const admin = await signInAs("admin@example.test");
    const { error: closeError } = await admin
      .from("orders")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("order_id", orderId);
    expect(closeError).toBeNull();

    const member = await signInAs("member2@example.test");
    const { error: lateStake } = await member
      .from("order_item_stakes")
      .upsert(
        { order_item_id: itemId, user_id: MEMBER_2, stake_qty: 5 },
        { onConflict: "order_item_id,user_id" },
      );
    expect(lateStake).not.toBeNull();

    // service_role's DELETE carve-out is what lets cleanup run past close.
    const { error: lateWithdraw } = await member
      .from("order_item_stakes")
      .delete()
      .eq("order_item_id", itemId)
      .eq("user_id", MEMBER_2);
    expect(lateWithdraw).not.toBeNull();
  });
});

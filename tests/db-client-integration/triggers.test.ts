import { formatISO } from "date-fns";
import { afterEach, describe, expect, it } from "vitest";
import {
  MEMBER_2,
  MEMBER_3,
  MEMBER_4,
  MEMBER_5,
  THRESHOLD_PRODUCT_ID,
  TIERED_PRODUCT_ID,
  cleanupOrder,
  closeOrder,
  createOrderItem,
  createServiceRoleClient,
  createTestOrder,
} from "./helpers";

// trg_init_order_item_unit_price: derives unit_price at creation from the
// product's pricing config, overwriting anything the caller supplied.
// threshold_bundle -> bundle_price / threshold_qty (integer floor).
// tiered -> the qty_floor = 0 baseline tier. A product with no covering
// pricing config is rejected outright.
describe("trg_init_order_item_unit_price", () => {
  const supabase = createServiceRoleClient();
  let orderId: number;

  afterEach(async () => {
    await cleanupOrder(supabase, orderId);
  });

  it("derives a threshold_bundle item's unit_price from bundle_price / threshold_qty, ignoring the caller-supplied value", async () => {
    orderId = await createTestOrder(supabase);
    const itemId = await createOrderItem(supabase, orderId, THRESHOLD_PRODUCT_ID, {
      unitPrice: 1,
    });

    const { data } = await supabase
      .from("order_items")
      .select("unit_price")
      .eq("order_item_id", itemId)
      .single();
    expect(data?.unit_price).toBe(833);
  });

  it("derives a tiered item's unit_price from the qty_floor = 0 baseline tier, ignoring the caller-supplied value", async () => {
    orderId = await createTestOrder(supabase);
    const itemId = await createOrderItem(supabase, orderId, TIERED_PRODUCT_ID, {
      unitPrice: 1,
    });

    const { data } = await supabase
      .from("order_items")
      .select("unit_price")
      .eq("order_item_id", itemId)
      .single();
    expect(data?.unit_price).toBe(2499);
  });

  it("rejects an order_item for a product with no pricing config", async () => {
    orderId = await createTestOrder(supabase);

    const { error } = await supabase.from("order_items").insert({
      order_id: orderId,
      product_id: 999_999,
      unit_price: 1,
    });
    expect(error).not.toBeNull();
  });
});

// trg_check_stake_capacity: a stake can't push order_items.quantity past its
// ceiling -- threshold_qty for threshold_bundle products, max_quantity for
// tiered products. Overflow is rejected outright, never clamped.
describe("trg_check_stake_capacity", () => {
  const supabase = createServiceRoleClient();
  let orderId: number;

  afterEach(async () => {
    await cleanupOrder(supabase, orderId);
  });

  it("accepts stakes from three members that exactly fill a threshold bundle", async () => {
    orderId = await createTestOrder(supabase);
    const itemId = await createOrderItem(supabase, orderId, THRESHOLD_PRODUCT_ID);

    for (const userId of [MEMBER_2, MEMBER_3, MEMBER_4]) {
      const { error } = await supabase.from("order_item_stakes").insert({
        order_item_id: itemId,
        user_id: userId,
        stake_qty: 2,
      });
      expect(error).toBeNull();
    }

    const { data } = await supabase
      .from("order_items")
      .select("quantity")
      .eq("order_item_id", itemId)
      .single();
    expect(data?.quantity).toBe(6);
  });

  it("rejects a stake insert past a filled threshold, quantity unchanged", async () => {
    orderId = await createTestOrder(supabase);
    const itemId = await createOrderItem(supabase, orderId, THRESHOLD_PRODUCT_ID);

    for (const userId of [MEMBER_2, MEMBER_3, MEMBER_4]) {
      await supabase.from("order_item_stakes").insert({
        order_item_id: itemId,
        user_id: userId,
        stake_qty: 2,
      });
    }

    const { error } = await supabase.from("order_item_stakes").insert({
      order_item_id: itemId,
      user_id: MEMBER_5,
      stake_qty: 1,
    });
    expect(error).not.toBeNull();

    const { data } = await supabase
      .from("order_items")
      .select("quantity")
      .eq("order_item_id", itemId)
      .single();
    expect(data?.quantity).toBe(6);
  });

  it("rejects an update that would push an existing stake past remaining capacity", async () => {
    orderId = await createTestOrder(supabase);
    const itemId = await createOrderItem(supabase, orderId, THRESHOLD_PRODUCT_ID);

    const { data: stake2 } = await supabase
      .from("order_item_stakes")
      .insert({ order_item_id: itemId, user_id: MEMBER_2, stake_qty: 2 })
      .select("stake_id")
      .single();
    await supabase.from("order_item_stakes").insert({
      order_item_id: itemId,
      user_id: MEMBER_3,
      stake_qty: 2,
    });

    // Current quantity is 4; pushing member 2's stake from 2 to 5 would make it 7 > 6.
    const { error } = await supabase
      .from("order_item_stakes")
      .update({ stake_qty: 5 })
      .eq("stake_id", stake2!.stake_id);
    expect(error).not.toBeNull();

    const { data: unchanged } = await supabase
      .from("order_item_stakes")
      .select("stake_qty")
      .eq("stake_id", stake2!.stake_id)
      .single();
    expect(unchanged?.stake_qty).toBe(2);

    const { data: item } = await supabase
      .from("order_items")
      .select("quantity")
      .eq("order_item_id", itemId)
      .single();
    expect(item?.quantity).toBe(4);
  });

  it("caps a tiered item at its per-item max_quantity", async () => {
    orderId = await createTestOrder(supabase);
    const itemId = await createOrderItem(supabase, orderId, TIERED_PRODUCT_ID, {
      maxQuantity: 10,
    });

    const { error: withinCap } = await supabase.from("order_item_stakes").insert({
      order_item_id: itemId,
      user_id: MEMBER_2,
      stake_qty: 8,
    });
    expect(withinCap).toBeNull();

    const { error: pastCap } = await supabase.from("order_item_stakes").insert({
      order_item_id: itemId,
      user_id: MEMBER_3,
      stake_qty: 5,
    });
    expect(pastCap).not.toBeNull();

    const { data } = await supabase
      .from("order_items")
      .select("quantity")
      .eq("order_item_id", itemId)
      .single();
    expect(data?.quantity).toBe(8);
  });

  it("leaves a tiered item with no max_quantity uncapped", async () => {
    orderId = await createTestOrder(supabase);
    const itemId = await createOrderItem(supabase, orderId, TIERED_PRODUCT_ID, {
      maxQuantity: null,
    });

    const { error } = await supabase.from("order_item_stakes").insert({
      order_item_id: itemId,
      user_id: MEMBER_2,
      stake_qty: 100_000,
    });
    expect(error).toBeNull();

    const { data } = await supabase
      .from("order_items")
      .select("quantity")
      .eq("order_item_id", itemId)
      .single();
    expect(data?.quantity).toBe(100_000);
  });

  it("serializes two concurrent stakes so a near-full threshold item never overflows", async () => {
    orderId = await createTestOrder(supabase);
    const itemId = await createOrderItem(supabase, orderId, THRESHOLD_PRODUCT_ID);

    // Pre-fill to 4/6.
    await supabase.from("order_item_stakes").insert({
      order_item_id: itemId,
      user_id: MEMBER_2,
      stake_qty: 2,
    });
    await supabase.from("order_item_stakes").insert({
      order_item_id: itemId,
      user_id: MEMBER_3,
      stake_qty: 2,
    });

    // Only room for one of these two qty=2 stakes to land without overflowing.
    const [first, second] = await Promise.all([
      supabase.from("order_item_stakes").insert({
        order_item_id: itemId,
        user_id: MEMBER_4,
        stake_qty: 2,
      }),
      supabase.from("order_item_stakes").insert({
        order_item_id: itemId,
        user_id: MEMBER_5,
        stake_qty: 2,
      }),
    ]);

    const errors = [first.error, second.error].filter((e) => e !== null);
    expect(errors.length).toBe(1);

    const { data } = await supabase
      .from("order_items")
      .select("quantity")
      .eq("order_item_id", itemId)
      .single();
    expect(data?.quantity).toBe(6);
  });
});

// trg_order_status_transition: orders.status may only move forward,
// open -> closed -> executed, never skip or reverse.
describe("trg_order_status_transition", () => {
  const supabase = createServiceRoleClient();
  let orderId: number;

  afterEach(async () => {
    await cleanupOrder(supabase, orderId);
  });

  it("allows open -> closed, then closed -> executed", async () => {
    orderId = await createTestOrder(supabase);

    const { error: closeError } = await supabase
      .from("orders")
      .update({ status: "closed", closed_at: formatISO(new Date()) })
      .eq("order_id", orderId);
    expect(closeError).toBeNull();

    const { data: closed } = await supabase
      .from("orders")
      .select("status")
      .eq("order_id", orderId)
      .single();
    expect(closed?.status).toBe("closed");

    const { error: executeError } = await supabase
      .from("orders")
      .update({ status: "executed", executed_at: formatISO(new Date()) })
      .eq("order_id", orderId);
    expect(executeError).toBeNull();

    const { data: executed } = await supabase
      .from("orders")
      .select("status")
      .eq("order_id", orderId)
      .single();
    expect(executed?.status).toBe("executed");
  });

  it("rejects open -> executed, skipping closed", async () => {
    orderId = await createTestOrder(supabase);

    const { error } = await supabase
      .from("orders")
      .update({ status: "executed", executed_at: formatISO(new Date()) })
      .eq("order_id", orderId);
    expect(error).not.toBeNull();

    const { data } = await supabase
      .from("orders")
      .select("status")
      .eq("order_id", orderId)
      .single();
    expect(data?.status).toBe("open");
  });

  it("rejects closed -> open, reversing", async () => {
    orderId = await createTestOrder(supabase);
    await supabase
      .from("orders")
      .update({ status: "closed", closed_at: formatISO(new Date()) })
      .eq("order_id", orderId);

    const { error } = await supabase
      .from("orders")
      .update({ status: "open" })
      .eq("order_id", orderId);
    expect(error).not.toBeNull();

    const { data } = await supabase
      .from("orders")
      .select("status")
      .eq("order_id", orderId)
      .single();
    expect(data?.status).toBe("closed");
  });

  it("rejects any transition once executed, a terminal state", async () => {
    orderId = await createTestOrder(supabase);
    await supabase
      .from("orders")
      .update({ status: "closed", closed_at: formatISO(new Date()) })
      .eq("order_id", orderId);
    await supabase
      .from("orders")
      .update({ status: "executed", executed_at: formatISO(new Date()) })
      .eq("order_id", orderId);

    const { error } = await supabase
      .from("orders")
      .update({ status: "open" })
      .eq("order_id", orderId);
    expect(error).not.toBeNull();

    const { data } = await supabase
      .from("orders")
      .select("status")
      .eq("order_id", orderId)
      .single();
    expect(data?.status).toBe("executed");
  });
});

// trg_sync_order_item_quantity: keeps order_items.quantity equal to
// SUM(order_item_stakes.stake_qty) for its order_item_id, on insert, update,
// and delete.
//
// Uses the tiered, uncapped product throughout so trg_check_stake_capacity
// never rejects a write here -- this describe block is purely about the
// sync trigger.
describe("trg_sync_order_item_quantity", () => {
  const supabase = createServiceRoleClient();
  let orderId: number;

  afterEach(async () => {
    await cleanupOrder(supabase, orderId);
  });

  it("matches the sum of stakes after inserts", async () => {
    orderId = await createTestOrder(supabase);
    const orderItemId = await createOrderItem(supabase, orderId, TIERED_PRODUCT_ID, {
      maxQuantity: null,
    });

    await supabase.from("order_item_stakes").insert({
      order_item_id: orderItemId,
      user_id: MEMBER_2,
      stake_qty: 10,
    });
    await supabase.from("order_item_stakes").insert({
      order_item_id: orderItemId,
      user_id: MEMBER_3,
      stake_qty: 15,
    });

    const { data } = await supabase
      .from("order_items")
      .select("quantity")
      .eq("order_item_id", orderItemId)
      .single();
    expect(data?.quantity).toBe(25);
  });

  it("decrements after a stake is deleted", async () => {
    orderId = await createTestOrder(supabase);
    const orderItemId = await createOrderItem(supabase, orderId, TIERED_PRODUCT_ID, {
      maxQuantity: null,
    });

    const { data: stake } = await supabase
      .from("order_item_stakes")
      .insert({ order_item_id: orderItemId, user_id: MEMBER_2, stake_qty: 10 })
      .select("stake_id")
      .single();
    await supabase.from("order_item_stakes").insert({
      order_item_id: orderItemId,
      user_id: MEMBER_3,
      stake_qty: 15,
    });

    await supabase.from("order_item_stakes").delete().eq("stake_id", stake!.stake_id);

    const { data } = await supabase
      .from("order_items")
      .select("quantity")
      .eq("order_item_id", orderItemId)
      .single();
    expect(data?.quantity).toBe(15);
  });

  it("reflects the new sum after a stake_qty update", async () => {
    orderId = await createTestOrder(supabase);
    const orderItemId = await createOrderItem(supabase, orderId, TIERED_PRODUCT_ID, {
      maxQuantity: null,
    });

    const { data: stake } = await supabase
      .from("order_item_stakes")
      .insert({ order_item_id: orderItemId, user_id: MEMBER_2, stake_qty: 10 })
      .select("stake_id")
      .single();

    await supabase
      .from("order_item_stakes")
      .update({ stake_qty: 40 })
      .eq("stake_id", stake!.stake_id);

    const { data } = await supabase
      .from("order_items")
      .select("quantity")
      .eq("order_item_id", orderItemId)
      .single();
    expect(data?.quantity).toBe(40);
  });
});

// trg_apply_smallest_remainder_apportionment: the instant a threshold_bundle
// item's stakes sum to threshold_qty, rewrites every stake's
// stake_amount via smallest-remainder-first apportionment so they sum
// exactly to bundle_price (ties broken by ascending stake_id).
//
// Also asserts order_item_resolution, the derived view that flips to
// 'succeeded'/'maxed_out' the instant an item hits its own capacity ceiling.
//
// Widget 6-Pack (THRESHOLD_PRODUCT_ID): threshold_qty=6, bundle_price=5000.
describe("trg_apply_smallest_remainder_apportionment + order_item_resolution", () => {
  const supabase = createServiceRoleClient();
  let orderId: number;

  afterEach(async () => {
    await cleanupOrder(supabase, orderId);
  });

  it("apportions a tied-remainder fill, ties broken by ascending stake_id", async () => {
    orderId = await createTestOrder(supabase);
    const itemId = await createOrderItem(supabase, orderId, THRESHOLD_PRODUCT_ID);

    const stakeIds: number[] = [];
    for (const userId of [MEMBER_2, MEMBER_3, MEMBER_4]) {
      const { data } = await supabase
        .from("order_item_stakes")
        .insert({ order_item_id: itemId, user_id: userId, stake_qty: 2 })
        .select("stake_id")
        .single();
      stakeIds.push(data!.stake_id);
    }

    // Apportionment only runs at close -- stake_amount stays the lossy
    // per-row value (1666 x 3 = 4998) until then.
    await closeOrder(supabase, orderId);

    const { data: stakes } = await supabase
      .from("order_item_stakes")
      .select("stake_id, stake_amount")
      .eq("order_item_id", itemId)
      .order("stake_id", { ascending: true });

    expect(stakes?.map((s) => s.stake_amount)).toEqual([1667, 1667, 1666]);
    expect(stakes?.reduce((sum, s) => sum + s.stake_amount, 0)).toBe(5000);

    const { data: resolution } = await supabase
      .from("order_item_resolution")
      .select("resolution_status")
      .eq("order_item_id", itemId)
      .single();
    expect(resolution?.resolution_status).toBe("succeeded");
  });

  it("apportions an uneven-remainder fill, the evenly-divisible stake absorbs the leftover cent", async () => {
    orderId = await createTestOrder(supabase);
    const itemId = await createOrderItem(supabase, orderId, THRESHOLD_PRODUCT_ID);

    const stakeQtyByUser: [string, number][] = [
      [MEMBER_2, 1],
      [MEMBER_3, 2],
      [MEMBER_4, 3],
    ];
    const stakeIdByQty = new Map<number, number>();
    for (const [userId, stakeQty] of stakeQtyByUser) {
      const { data } = await supabase
        .from("order_item_stakes")
        .insert({
          order_item_id: itemId,
          user_id: userId,
          stake_qty: stakeQty,
        })
        .select("stake_id")
        .single();
      stakeIdByQty.set(stakeQty, data!.stake_id);
    }

    await closeOrder(supabase, orderId);

    const { data: stakes } = await supabase
      .from("order_item_stakes")
      .select("stake_id, stake_amount")
      .eq("order_item_id", itemId);
    const amountByStakeId = new Map(stakes!.map((s) => [s.stake_id, s.stake_amount]));

    expect(amountByStakeId.get(stakeIdByQty.get(1)!)).toBe(833);
    expect(amountByStakeId.get(stakeIdByQty.get(2)!)).toBe(1666);
    expect(amountByStakeId.get(stakeIdByQty.get(3)!)).toBe(2501);
  });

  it("flips a tiered item's resolution to maxed_out once max_quantity is hit", async () => {
    orderId = await createTestOrder(supabase);
    const itemId = await createOrderItem(supabase, orderId, TIERED_PRODUCT_ID, {
      maxQuantity: 10,
    });

    await supabase.from("order_item_stakes").insert({
      order_item_id: itemId,
      user_id: MEMBER_2,
      stake_qty: 10,
      stake_amount: 2499,
    });

    const { data } = await supabase
      .from("order_item_resolution")
      .select("resolution_status")
      .eq("order_item_id", itemId)
      .single();
    expect(data?.resolution_status).toBe("maxed_out");
  });
});

// trg_check_stake_order_is_open: once the parent order leaves 'open', every
// stake write is rejected -- except a DELETE performed as service_role, which
// is what lets admin/test cleanup remove a closed order's rows.
describe("trg_check_stake_order_is_open", () => {
  const supabase = createServiceRoleClient();
  let orderId: number;

  afterEach(async () => {
    await cleanupOrder(supabase, orderId);
  });

  it("rejects insert/update once closed, but allows service_role delete", async () => {
    orderId = await createTestOrder(supabase);
    const itemId = await createOrderItem(supabase, orderId, TIERED_PRODUCT_ID, {
      maxQuantity: null,
    });

    const { data: stake } = await supabase
      .from("order_item_stakes")
      .insert({ order_item_id: itemId, user_id: MEMBER_2, stake_qty: 5 })
      .select("stake_id")
      .single();

    await closeOrder(supabase, orderId);

    const { error: insertError } = await supabase.from("order_item_stakes").insert({
      order_item_id: itemId,
      user_id: MEMBER_3,
      stake_qty: 5,
    });
    expect(insertError).not.toBeNull();

    const { error: updateError } = await supabase
      .from("order_item_stakes")
      .update({ stake_qty: 8 })
      .eq("stake_id", stake!.stake_id);
    expect(updateError).not.toBeNull();

    const { data: item } = await supabase
      .from("order_items")
      .select("quantity")
      .eq("order_item_id", itemId)
      .single();
    expect(item?.quantity).toBe(5);

    const { error: deleteError } = await supabase
      .from("order_item_stakes")
      .delete()
      .eq("stake_id", stake!.stake_id);
    expect(deleteError).toBeNull();
  });
});

// trg_sync_tiered_unit_price + trg_sync_stake_amounts_on_unit_price: as a
// tiered item's quantity crosses a product_price_tiers boundary, unit_price
// updates live and every existing stake on that item is retroactively
// repriced against the new unit_price.
//
// Bulk Gizmos (TIERED_PRODUCT_ID): tiers at qty_floor 0 (2499), 5 (2150), 10 (1800).
describe("trg_sync_tiered_unit_price + trg_sync_stake_amounts_on_unit_price", () => {
  const supabase = createServiceRoleClient();
  let orderId: number;

  afterEach(async () => {
    await cleanupOrder(supabase, orderId);
  });

  it("reprices unit_price and every existing stake when quantity crosses a tier boundary", async () => {
    orderId = await createTestOrder(supabase);
    const itemId = await createOrderItem(supabase, orderId, TIERED_PRODUCT_ID, {
      maxQuantity: null,
    });

    await supabase.from("order_item_stakes").insert({
      order_item_id: itemId,
      user_id: MEMBER_2,
      stake_qty: 3,
    });

    const { data: beforeCross } = await supabase
      .from("order_items")
      .select("unit_price")
      .eq("order_item_id", itemId)
      .single();
    expect(beforeCross?.unit_price).toBe(2499);

    await supabase.from("order_item_stakes").insert({
      order_item_id: itemId,
      user_id: MEMBER_3,
      stake_qty: 3,
    });

    const { data: afterCross } = await supabase
      .from("order_items")
      .select("unit_price")
      .eq("order_item_id", itemId)
      .single();
    expect(afterCross?.unit_price).toBe(2150);

    const { data: stakes } = await supabase
      .from("order_item_stakes")
      .select("user_id, stake_amount")
      .eq("order_item_id", itemId);
    const amountByUser = new Map(stakes!.map((s) => [s.user_id, s.stake_amount]));

    expect(amountByUser.get(MEMBER_2)).toBe(6450);
    expect(amountByUser.get(MEMBER_3)).toBe(6450);
  });
});

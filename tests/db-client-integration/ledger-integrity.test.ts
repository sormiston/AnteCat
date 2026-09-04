import { formatISO } from "date-fns";
import { afterEach, describe, expect, it } from "vitest";
import {
  apportionBundleStakes,
  bundleUnitIdealPrice,
  cleanupOrder,
  closeOrder,
  createOrderItem,
  createServiceRoleClient,
  createTestOrder,
  MEMBER_2,
  MEMBER_3,
  MEMBER_4,
  MEMBER_5,
  THRESHOLD_CONFIG,
  THRESHOLD_PRODUCT_ID,
  TIER_CONFIG,
  TIERED_PRODUCT_ID,
  tierUnitPriceForQty,
} from "./helpers";

describe("with UPSERT", () => {
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
      const itemId = await createOrderItem(
        supabase,
        orderId,
        THRESHOLD_PRODUCT_ID,
        {
          unitPrice: 1,
        },
      );

      const { data } = await supabase
        .from("order_items")
        .select("unit_price")
        .eq("order_item_id", itemId)
        .single();
      expect(data?.unit_price).toBe(bundleUnitIdealPrice(THRESHOLD_CONFIG));
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
      expect(data?.unit_price).toBe(tierUnitPriceForQty(0));
    });

    it("rejects an order_item for a product with no pricing config", async () => {
      orderId = await createTestOrder(supabase);

      const { error } = await supabase.from("order_items").upsert({
        order_id: orderId,
        product_id: 999_999,
        unit_price: 1,
      }, { onConflict: 'user_id,order_item_id'});

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
      const itemId = await createOrderItem(
        supabase,
        orderId,
        THRESHOLD_PRODUCT_ID,
      );

      // Assumes threshold_qty divides evenly by 3 (true for the seeded 6).
      const perMemberQty = THRESHOLD_CONFIG.thresholdQty / 3;
      for (const userId of [MEMBER_2, MEMBER_3, MEMBER_4]) {
        const { error } = await supabase.from("order_item_stakes").upsert(
          {
            order_item_id: itemId,
            user_id: userId,
            stake_qty: perMemberQty,
          },
          { onConflict: "order_item_id,user_id" },
        );

        expect(error).toBeNull();
      }

      const { data } = await supabase
        .from("order_items")
        .select("quantity")
        .eq("order_item_id", itemId)
        .single();
      expect(data?.quantity).toBe(THRESHOLD_CONFIG.thresholdQty);
    });

    it("rejects a stake insert past a filled threshold, quantity unchanged", async () => {
      orderId = await createTestOrder(supabase);
      const itemId = await createOrderItem(
        supabase,
        orderId,
        THRESHOLD_PRODUCT_ID,
      );

      const perMemberQty = THRESHOLD_CONFIG.thresholdQty / 3;
      for (const userId of [MEMBER_2, MEMBER_3, MEMBER_4]) {
        await supabase.from("order_item_stakes").upsert(
          {
            order_item_id: itemId,
            user_id: userId,
            stake_qty: perMemberQty,
          },
          { onConflict: "order_item_id,user_id" },
        );
      }

      const { error } = await supabase.from("order_item_stakes").upsert(
        {
          order_item_id: itemId,
          user_id: MEMBER_5,
          stake_qty: 1,
        },
        { onConflict: "order_item_id,user_id" },
      );

      expect(error).not.toBeNull();

      const { data } = await supabase
        .from("order_items")
        .select("quantity")
        .eq("order_item_id", itemId)
        .single();
      expect(data?.quantity).toBe(THRESHOLD_CONFIG.thresholdQty);
    });

    it("rejects an update that would push an existing stake past remaining capacity", async () => {
      orderId = await createTestOrder(supabase);
      const itemId = await createOrderItem(
        supabase,
        orderId,
        THRESHOLD_PRODUCT_ID,
      );

      const initialQty = Math.floor(THRESHOLD_CONFIG.thresholdQty / 3);
      const { data: stake2 } = await supabase
        .from("order_item_stakes")
        .upsert(
          {
            order_item_id: itemId,
            user_id: MEMBER_2,
            stake_qty: initialQty,
          },
          { onConflict: "order_item_id,user_id" },
        )
        .select("*")
        .single();

      await supabase.from("order_item_stakes").upsert(
        {
          order_item_id: itemId,
          user_id: MEMBER_3,
          stake_qty: initialQty,
        },
        { onConflict: "order_item_id,user_id" },
      );

      // Current quantity is 2 x initialQty; growing member 2's stake to one
      // past the remaining room overflows by exactly 1.
      const overflowQty = THRESHOLD_CONFIG.thresholdQty - initialQty + 1;
      const { error } = await supabase.from("order_item_stakes").upsert(
        { order_item_id: itemId, user_id: MEMBER_2, stake_qty: overflowQty },
        { onConflict: "order_item_id,user_id" },
      );
      expect(error).not.toBeNull();

      const { data: unchanged } = await supabase
        .from("order_item_stakes")
        .select("stake_qty")
        .eq("stake_id", stake2!.stake_id)
        .single();
      expect(unchanged?.stake_qty).toBe(initialQty);

      const { data: item } = await supabase
        .from("order_items")
        .select("quantity")
        .eq("order_item_id", itemId)
        .single();
      expect(item?.quantity).toBe(initialQty * 2);
    });

    it("accepts an update that grows an existing stake within remaining capacity", async () => {
      orderId = await createTestOrder(supabase);
      const itemId = await createOrderItem(
        supabase,
        orderId,
        THRESHOLD_PRODUCT_ID,
      );

      const initialQty = Math.floor(THRESHOLD_CONFIG.thresholdQty / 3);

      const otherQty = 1;
      const { data: stake2, error: stake2Error } = await supabase
        .from("order_item_stakes")
        .upsert(
          {
            order_item_id: itemId,
            user_id: MEMBER_2,
            stake_qty: initialQty,
          },
          { onConflict: "order_item_id,user_id" },
        )
        .select("stake_id")
        .single();
      
      await supabase.from("order_item_stakes").upsert(
        {
          order_item_id: itemId,
          user_id: MEMBER_3,
          stake_qty: otherQty,
        },
        { onConflict: "order_item_id,user_id" },
      );

      // Grow member 2's stake to just under the remaining room -- the true
      // total (grownQty + otherQty) stays within the threshold. The capacity
      // check must count member 2's own row at its old value here, not
      // exclude it outright, or this would falsely pass regardless of the new
      // value.
      const grownQty = THRESHOLD_CONFIG.thresholdQty - otherQty - 1;

      const { error } = await supabase
        .from("order_item_stakes")
        .upsert(
          { order_item_id: itemId, user_id: MEMBER_2, stake_qty: grownQty },
          { onConflict: "user_id,order_item_id" },
        );

      expect(error).toBeNull();

      const { data } = await supabase
        .from("order_items")
        .select("quantity")
        .eq("order_item_id", itemId)
        .single();
      expect(data?.quantity).toBe(grownQty + otherQty);
    });

    it("rejects a second stake row for a member who already holds a stake, once their existing stake is counted the true total overflows", async () => {
      orderId = await createTestOrder(supabase);
      const itemId = await createOrderItem(
        supabase,
        orderId,
        THRESHOLD_PRODUCT_ID,
      );

      const initialQty = Math.floor(THRESHOLD_CONFIG.thresholdQty / 3);
      const otherQty = 1;
      await supabase.from("order_item_stakes").upsert(
        {
          order_item_id: itemId,
          user_id: MEMBER_2,
          stake_qty: initialQty,
        },
        { onConflict: "order_item_id,user_id" },
      );
      await supabase.from("order_item_stakes").upsert(
        {
          order_item_id: itemId,
          user_id: MEMBER_3,
          stake_qty: otherQty,
        },
        { onConflict: "order_item_id,user_id" },
      );

      // True total is initialQty + otherQty. A check that excludes ALL of
      // member 2's rows, rather than just the row being replaced, would see
      // only member 3's otherQty and wrongly admit this second row, taking
      // quantity past the threshold.
      //
      // Left as a plain insert, not upsert: onConflict would route this into
      // an UPDATE of member 2's existing row, making the true total exactly
      // threshold_qty (not past it) -- the capacity trigger would then admit
      // it, and this test's expected error would never occur.
      const secondQty = THRESHOLD_CONFIG.thresholdQty - otherQty;
      const { error } = await supabase.from("order_item_stakes").insert({
        order_item_id: itemId,
        user_id: MEMBER_2,
        stake_qty: secondQty,
      });
      expect(error).not.toBeNull();

      const { data } = await supabase
        .from("order_items")
        .select("quantity")
        .eq("order_item_id", itemId)
        .single();
      expect(data?.quantity).toBe(initialQty + otherQty);
    });

    it("caps a tiered item at its per-item max_quantity", async () => {
      orderId = await createTestOrder(supabase);
      const itemId = await createOrderItem(supabase, orderId, TIERED_PRODUCT_ID, {
        maxQuantity: 10,
      });

      const { error: withinCap } = await supabase
        .from("order_item_stakes")
        .upsert(
          {
            order_item_id: itemId,
            user_id: MEMBER_2,
            stake_qty: 8,
          },
          { onConflict: "order_item_id,user_id" },
        );
      expect(withinCap).toBeNull();

      const { error: pastCap } = await supabase.from("order_item_stakes").upsert(
        {
          order_item_id: itemId,
          user_id: MEMBER_3,
          stake_qty: 5,
        },
        { onConflict: "order_item_id,user_id" },
      );
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

      const { error } = await supabase.from("order_item_stakes").upsert(
        {
          order_item_id: itemId,
          user_id: MEMBER_2,
          stake_qty: 100_000,
        },
        { onConflict: "order_item_id,user_id" },
      );
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
      const itemId = await createOrderItem(
        supabase,
        orderId,
        THRESHOLD_PRODUCT_ID,
      );

      const stakeQty = Math.floor(THRESHOLD_CONFIG.thresholdQty / 3);

      // Pre-fill to leave room for exactly one more stakeQty-sized stake.
      await supabase.from("order_item_stakes").upsert(
        {
          order_item_id: itemId,
          user_id: MEMBER_2,
          stake_qty: stakeQty,
        },
        { onConflict: "order_item_id,user_id" },
      );
      await supabase.from("order_item_stakes").upsert(
        {
          order_item_id: itemId,
          user_id: MEMBER_3,
          stake_qty: stakeQty,
        },
        { onConflict: "order_item_id,user_id" },
      );

      // Only room for one of these two same-sized stakes to land without overflowing.
      const [first, second] = await Promise.all([
        supabase.from("order_item_stakes").upsert(
          {
            order_item_id: itemId,
            user_id: MEMBER_4,
            stake_qty: stakeQty,
          },
          { onConflict: "order_item_id,user_id" },
        ),
        supabase.from("order_item_stakes").upsert(
          {
            order_item_id: itemId,
            user_id: MEMBER_5,
            stake_qty: stakeQty,
          },
          { onConflict: "order_item_id,user_id" },
        ),
      ]);

      const errors = [first.error, second.error].filter((e) => e !== null);
      expect(errors.length).toBe(1);

      const { data } = await supabase
        .from("order_items")
        .select("quantity")
        .eq("order_item_id", itemId)
        .single();
      expect(data?.quantity).toBe(stakeQty * 3);
    });
  });

  // order_item_stakes UNIQUE (order_item_id, user_id): a member's commitment to
  // one item is a single row, edited via UPDATE -- never a second INSERT.
  // trg_check_stake_capacity's own-stake exclusion assumes this; this
  // constraint is the backstop for the case that assumption alone can't cover
  // (a second stake small enough to still fit within remaining capacity).
  describe("order_item_stakes UNIQUE (order_item_id, user_id)", () => {
    const supabase = createServiceRoleClient();
    let orderId: number;

    afterEach(async () => {
      await cleanupOrder(supabase, orderId);
    });

    it("rejects a second stake row for a member who already holds a stake on the item, even within capacity", async () => {
      orderId = await createTestOrder(supabase);
      const itemId = await createOrderItem(
        supabase,
        orderId,
        THRESHOLD_PRODUCT_ID,
      );

      await supabase.from("order_item_stakes").upsert(
        {
          order_item_id: itemId,
          user_id: MEMBER_2,
          stake_qty: 2,
        },
        { onConflict: "order_item_id,user_id" },
      );

      // Room for 4 more (6 - 2) -- would pass trg_check_stake_capacity, so
      // rejection here comes from the constraint, not the trigger.
      //
      // Left as a plain insert, not upsert: this whole describe block exists to
      // prove the UNIQUE constraint backstops a second physical INSERT row --
      // upsert's onConflict would route this into an UPDATE instead, and there
      // would be nothing left here to reject.
      const { error } = await supabase.from("order_item_stakes").insert({
        order_item_id: itemId,
        user_id: MEMBER_2,
        stake_qty: 1,
      });
      expect(error).not.toBeNull();

      const { data } = await supabase
        .from("order_items")
        .select("quantity")
        .eq("order_item_id", itemId)
        .single();
      expect(data?.quantity).toBe(2);
    });

    it("allows the same member to hold stakes on two different order items", async () => {
      orderId = await createTestOrder(supabase);
      const bundleItemId = await createOrderItem(
        supabase,
        orderId,
        THRESHOLD_PRODUCT_ID,
      );
      const tieredItemId = await createOrderItem(
        supabase,
        orderId,
        TIERED_PRODUCT_ID,
        { maxQuantity: null },
      );

      const { error: firstError } = await supabase
        .from("order_item_stakes")
        .upsert(
          { order_item_id: bundleItemId, user_id: MEMBER_2, stake_qty: 2 },
          { onConflict: "order_item_id,user_id" },
        );
      expect(firstError).toBeNull();

      const { error: secondError } = await supabase
        .from("order_item_stakes")
        .upsert(
          { order_item_id: tieredItemId, user_id: MEMBER_2, stake_qty: 5 },
          { onConflict: "order_item_id,user_id" },
        );
      expect(secondError).toBeNull();
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
      const orderItemId = await createOrderItem(
        supabase,
        orderId,
        TIERED_PRODUCT_ID,
        {
          maxQuantity: null,
        },
      );

      await supabase.from("order_item_stakes").upsert(
        {
          order_item_id: orderItemId,
          user_id: MEMBER_2,
          stake_qty: 10,
        },
        { onConflict: "order_item_id,user_id" },
      );
      await supabase.from("order_item_stakes").upsert(
        {
          order_item_id: orderItemId,
          user_id: MEMBER_3,
          stake_qty: 15,
        },
        { onConflict: "order_item_id,user_id" },
      );

      const { data } = await supabase
        .from("order_items")
        .select("quantity")
        .eq("order_item_id", orderItemId)
        .single();
      expect(data?.quantity).toBe(25);
    });

    it("decrements after a stake is deleted", async () => {
      orderId = await createTestOrder(supabase);
      const orderItemId = await createOrderItem(
        supabase,
        orderId,
        TIERED_PRODUCT_ID,
        {
          maxQuantity: null,
        },
      );

      const { data: stake } = await supabase
        .from("order_item_stakes")
        .upsert(
          { order_item_id: orderItemId, user_id: MEMBER_2, stake_qty: 10 },
          { onConflict: "order_item_id,user_id" },
        )
        .select("stake_id")
        .single();
      await supabase.from("order_item_stakes").upsert(
        {
          order_item_id: orderItemId,
          user_id: MEMBER_3,
          stake_qty: 15,
        },
        { onConflict: "order_item_id,user_id" },
      );

      await supabase
        .from("order_item_stakes")
        .delete()
        .eq("stake_id", stake!.stake_id);

      const { data } = await supabase
        .from("order_items")
        .select("quantity")
        .eq("order_item_id", orderItemId)
        .single();
      expect(data?.quantity).toBe(15);
    });

    it("reflects the new sum after a stake_qty update", async () => {
      orderId = await createTestOrder(supabase);
      const orderItemId = await createOrderItem(
        supabase,
        orderId,
        TIERED_PRODUCT_ID,
        {
          maxQuantity: null,
        },
      );

      await supabase.from("order_item_stakes").upsert(
        { order_item_id: orderItemId, user_id: MEMBER_2, stake_qty: 10 },
        { onConflict: "order_item_id,user_id" },
      );

      await supabase.from("order_item_stakes").upsert(
        { order_item_id: orderItemId, user_id: MEMBER_2, stake_qty: 40 },
        { onConflict: "order_item_id,user_id" },
      );

      const { data } = await supabase
        .from("order_items")
        .select("quantity")
        .eq("order_item_id", orderItemId)
        .single();
      expect(data?.quantity).toBe(40);
    });
  });

  // trg_apportion_on_close: the instant a threshold_bundle item's stakes sum
  // to threshold_qty, rewrites every stake's stake_amount via Hamilton
  // (largest-remainder-first) apportionment so they sum exactly to
  // bundle_price (ties broken by ascending stake_id).
  //
  // Also asserts order_item_resolution, the derived view that flips to
  // 'succeeded'/'maxed_out' the instant an item hits its own capacity ceiling.
  //
  // Widget 6-Pack (THRESHOLD_PRODUCT_ID): threshold_qty=6, bundle_price=5000.
  describe("trg_apportion_on_close + order_item_resolution", () => {
    const supabase = createServiceRoleClient();
    let orderId: number;

    afterEach(async () => {
      await cleanupOrder(supabase, orderId);
    });

    it("apportions a tied-remainder fill, ties broken by ascending stake_id", async () => {
      orderId = await createTestOrder(supabase);
      const itemId = await createOrderItem(
        supabase,
        orderId,
        THRESHOLD_PRODUCT_ID,
      );

      // Equal stake_qtys always produce a tied fractional remainder across the
      // three rows, exercising the ties-broken-by-ascending-stake_id rule.
      const stakeQtys = Array(3).fill(THRESHOLD_CONFIG.thresholdQty / 3);

      const stakeIds: number[] = [];
      for (const [i, userId] of [MEMBER_2, MEMBER_3, MEMBER_4].entries()) {
        const { data } = await supabase
          .from("order_item_stakes")
          .upsert(
            {
              order_item_id: itemId,
              user_id: userId,
              stake_qty: stakeQtys[i],
            },
            { onConflict: "order_item_id,user_id" },
          )
          .select("stake_id")
          .single();
        stakeIds.push(data!.stake_id);
      }

      // Apportionment only runs at close -- stake_amount stays the lossy
      // per-row value until then.
      await closeOrder(supabase, orderId);

      const { data: stakes } = await supabase
        .from("order_item_stakes")
        .select("stake_id, stake_amount")
        .eq("order_item_id", itemId)
        .order("stake_id", { ascending: true });

      expect(stakes?.map((s) => s.stake_amount)).toEqual(
        apportionBundleStakes(stakeQtys),
      );
      expect(stakes?.reduce((sum, s) => sum + s.stake_amount, 0)).toBe(
        THRESHOLD_CONFIG.bundlePrice,
      );

      const { data: resolution } = await supabase
        .from("order_item_resolution")
        .select("resolution_status")
        .eq("order_item_id", itemId)
        .single();
      expect(resolution?.resolution_status).toBe("succeeded");
    });

    it("apportions an uneven-remainder fill, the largest-remainder stake absorbs the leftover cent", async () => {
      orderId = await createTestOrder(supabase);
      const itemId = await createOrderItem(
        supabase,
        orderId,
        THRESHOLD_PRODUCT_ID,
      );

      // Three distinct quantities summing exactly to threshold_qty, so their
      // remainders differ and only one absorbs the leftover cent.
      const stakeQtys = [1, 2, THRESHOLD_CONFIG.thresholdQty - 3];
      for (const [i, userId] of [MEMBER_2, MEMBER_3, MEMBER_4].entries()) {
        await supabase.from("order_item_stakes").upsert(
          {
            order_item_id: itemId,
            user_id: userId,
            stake_qty: stakeQtys[i],
          },
          { onConflict: "order_item_id,user_id" },
        );
      }

      await closeOrder(supabase, orderId);

      const { data: stakes } = await supabase
        .from("order_item_stakes")
        .select("stake_id, stake_amount")
        .eq("order_item_id", itemId)
        .order("stake_id", { ascending: true });

      expect(stakes?.map((s) => s.stake_amount)).toEqual(
        apportionBundleStakes(stakeQtys),
      );
    });

    it("flips a tiered item's resolution to maxed_out once max_quantity is hit", async () => {
      orderId = await createTestOrder(supabase);
      const itemId = await createOrderItem(supabase, orderId, TIERED_PRODUCT_ID, {
        maxQuantity: 10,
      });

      await supabase.from("order_item_stakes").upsert(
        {
          order_item_id: itemId,
          user_id: MEMBER_2,
          stake_qty: 10,
          stake_amount: 2499,
        },
        { onConflict: "order_item_id,user_id" },
      );

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
        .upsert(
          { order_item_id: itemId, user_id: MEMBER_2, stake_qty: 5 },
          { onConflict: "order_item_id,user_id" },
        )
        .select("stake_id")
        .single();

      await closeOrder(supabase, orderId);

      const { error: insertError } = await supabase.from("order_item_stakes").upsert(
        {
          order_item_id: itemId,
          user_id: MEMBER_3,
          stake_qty: 5,
        },
        { onConflict: "order_item_id,user_id" },
      );
      expect(insertError).not.toBeNull();

      const { error: updateError } = await supabase.from("order_item_stakes").upsert(
        { order_item_id: itemId, user_id: MEMBER_2, stake_qty: 8 },
        { onConflict: "order_item_id,user_id" },
      );
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

      // tier0/tier1 are the two lowest floors in the seeded ladder (0 and 5).
      // beforeQty stays under tier1's floor; crossQty brings the cumulative
      // total to exactly tier1's floor.
      const [tier0, tier1] = TIER_CONFIG;
      const beforeQty = Math.max(1, tier1.qtyFloor - 2);
      const crossQty = tier1.qtyFloor - beforeQty;

      await supabase.from("order_item_stakes").upsert(
        {
          order_item_id: itemId,
          user_id: MEMBER_2,
          stake_qty: beforeQty,
        },
        { onConflict: "order_item_id,user_id" },
      );

      const { data: beforeCross } = await supabase
        .from("order_items")
        .select("unit_price")
        .eq("order_item_id", itemId)
        .single();
      expect(beforeCross?.unit_price).toBe(tier0.unitPrice);

      await supabase.from("order_item_stakes").upsert(
        {
          order_item_id: itemId,
          user_id: MEMBER_3,
          stake_qty: crossQty,
        },
        { onConflict: "order_item_id,user_id" },
      );

      const { data: afterCross } = await supabase
        .from("order_items")
        .select("unit_price")
        .eq("order_item_id", itemId)
        .single();
      expect(afterCross?.unit_price).toBe(tier1.unitPrice);

      const { data: stakes } = await supabase
        .from("order_item_stakes")
        .select("user_id, stake_amount")
        .eq("order_item_id", itemId);
      const amountByUser = new Map(
        stakes!.map((s) => [s.user_id, s.stake_amount]),
      );

      // All-units pricing: the new tier price applies to each stake's full
      // stake_qty, not just the marginal units that crossed the boundary.
      expect(amountByUser.get(MEMBER_2)).toBe(beforeQty * tier1.unitPrice);
      expect(amountByUser.get(MEMBER_3)).toBe(crossQty * tier1.unitPrice);
    });
  });
});

describe("with INSERT and UPDATE", () => {
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
      const itemId = await createOrderItem(
        supabase,
        orderId,
        THRESHOLD_PRODUCT_ID,
        {
          unitPrice: 1,
        },
      );

      const { data } = await supabase
        .from("order_items")
        .select("unit_price")
        .eq("order_item_id", itemId)
        .single();
      expect(data?.unit_price).toBe(bundleUnitIdealPrice(THRESHOLD_CONFIG));
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
      expect(data?.unit_price).toBe(tierUnitPriceForQty(0));
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
      const itemId = await createOrderItem(
        supabase,
        orderId,
        THRESHOLD_PRODUCT_ID,
      );

      // Assumes threshold_qty divides evenly by 3 (true for the seeded 6).
      const perMemberQty = THRESHOLD_CONFIG.thresholdQty / 3;
      for (const userId of [MEMBER_2, MEMBER_3, MEMBER_4]) {
        const { error } = await supabase.from("order_item_stakes").insert({
          order_item_id: itemId,
          user_id: userId,
          stake_qty: perMemberQty,
        });

        expect(error).toBeNull();
      }

      const { data } = await supabase
        .from("order_items")
        .select("quantity")
        .eq("order_item_id", itemId)
        .single();
      expect(data?.quantity).toBe(THRESHOLD_CONFIG.thresholdQty);
    });

    it("rejects a stake insert past a filled threshold, quantity unchanged", async () => {
      orderId = await createTestOrder(supabase);
      const itemId = await createOrderItem(
        supabase,
        orderId,
        THRESHOLD_PRODUCT_ID,
      );

      const perMemberQty = THRESHOLD_CONFIG.thresholdQty / 3;
      for (const userId of [MEMBER_2, MEMBER_3, MEMBER_4]) {
        await supabase.from("order_item_stakes").insert({
          order_item_id: itemId,
          user_id: userId,
          stake_qty: perMemberQty,
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
      expect(data?.quantity).toBe(THRESHOLD_CONFIG.thresholdQty);
    });

    it("rejects an update that would push an existing stake past remaining capacity", async () => {
      orderId = await createTestOrder(supabase);
      const itemId = await createOrderItem(
        supabase,
        orderId,
        THRESHOLD_PRODUCT_ID,
      );

      const initialQty = Math.floor(THRESHOLD_CONFIG.thresholdQty / 3);
      const { data: stake2 } = await supabase
        .from("order_item_stakes")
        .insert({
          order_item_id: itemId,
          user_id: MEMBER_2,
          stake_qty: initialQty,
        })
        .select("*")
        .single();

      await supabase.from("order_item_stakes").insert({
        order_item_id: itemId,
        user_id: MEMBER_3,
        stake_qty: initialQty,
      });

      // Current quantity is 2 x initialQty; growing member 2's stake to one
      // past the remaining room overflows by exactly 1.
      const overflowQty = THRESHOLD_CONFIG.thresholdQty - initialQty + 1;
      const { error } = await supabase
        .from("order_item_stakes")
        .update({ stake_qty: overflowQty })
        .eq("stake_id", stake2!.stake_id);
      expect(error).not.toBeNull();

      const { data: unchanged } = await supabase
        .from("order_item_stakes")
        .select("stake_qty")
        .eq("stake_id", stake2!.stake_id)
        .single();
      expect(unchanged?.stake_qty).toBe(initialQty);

      const { data: item } = await supabase
        .from("order_items")
        .select("quantity")
        .eq("order_item_id", itemId)
        .single();
      expect(item?.quantity).toBe(initialQty * 2);
    });

    it("accepts an update that grows an existing stake within remaining capacity", async () => {
      orderId = await createTestOrder(supabase);
      const itemId = await createOrderItem(
        supabase,
        orderId,
        THRESHOLD_PRODUCT_ID,
      );

      const initialQty = Math.floor(THRESHOLD_CONFIG.thresholdQty / 3);

      const otherQty = 1;
      const { data: stake2 } = await supabase
        .from("order_item_stakes")
        .insert({
          order_item_id: itemId,
          user_id: MEMBER_2,
          stake_qty: initialQty,
        })
        .select("stake_id")
        .single();
      await supabase.from("order_item_stakes").insert({
        order_item_id: itemId,
        user_id: MEMBER_3,
        stake_qty: otherQty,
      });

      // Grow member 2's stake to just under the remaining room -- the true
      // total (grownQty + otherQty) stays within the threshold. The capacity
      // check must count member 2's own row at its old value here, not
      // exclude it outright, or this would falsely pass regardless of the new
      // value.
      const grownQty = THRESHOLD_CONFIG.thresholdQty - otherQty - 1;

      const { error } = await supabase
        .from("order_item_stakes")
        .update({ stake_qty: grownQty })
        .eq("stake_id", stake2!.stake_id);

      expect(error).toBeNull();

      const { data } = await supabase
        .from("order_items")
        .select("quantity")
        .eq("order_item_id", itemId)
        .single();
      expect(data?.quantity).toBe(grownQty + otherQty);
    });

    it("rejects a second stake row for a member who already holds a stake, once their existing stake is counted the true total overflows", async () => {
      orderId = await createTestOrder(supabase);
      const itemId = await createOrderItem(
        supabase,
        orderId,
        THRESHOLD_PRODUCT_ID,
      );

      const initialQty = Math.floor(THRESHOLD_CONFIG.thresholdQty / 3);
      const otherQty = 1;
      await supabase.from("order_item_stakes").insert({
        order_item_id: itemId,
        user_id: MEMBER_2,
        stake_qty: initialQty,
      });
      await supabase.from("order_item_stakes").insert({
        order_item_id: itemId,
        user_id: MEMBER_3,
        stake_qty: otherQty,
      });

      // True total is initialQty + otherQty. A check that excludes ALL of
      // member 2's rows, rather than just the row being replaced, would see
      // only member 3's otherQty and wrongly admit this second row, taking
      // quantity past the threshold.
      const secondQty = THRESHOLD_CONFIG.thresholdQty - otherQty;
      const { error } = await supabase.from("order_item_stakes").insert({
        order_item_id: itemId,
        user_id: MEMBER_2,
        stake_qty: secondQty,
      });
      expect(error).not.toBeNull();

      const { data } = await supabase
        .from("order_items")
        .select("quantity")
        .eq("order_item_id", itemId)
        .single();
      expect(data?.quantity).toBe(initialQty + otherQty);
    });

    it("caps a tiered item at its per-item max_quantity", async () => {
      orderId = await createTestOrder(supabase);
      const itemId = await createOrderItem(supabase, orderId, TIERED_PRODUCT_ID, {
        maxQuantity: 10,
      });

      const { error: withinCap } = await supabase
        .from("order_item_stakes")
        .insert({
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
      const itemId = await createOrderItem(
        supabase,
        orderId,
        THRESHOLD_PRODUCT_ID,
      );

      const stakeQty = Math.floor(THRESHOLD_CONFIG.thresholdQty / 3);

      // Pre-fill to leave room for exactly one more stakeQty-sized stake.
      await supabase.from("order_item_stakes").insert({
        order_item_id: itemId,
        user_id: MEMBER_2,
        stake_qty: stakeQty,
      });
      await supabase.from("order_item_stakes").insert({
        order_item_id: itemId,
        user_id: MEMBER_3,
        stake_qty: stakeQty,
      });

      // Only room for one of these two same-sized stakes to land without overflowing.
      const [first, second] = await Promise.all([
        supabase.from("order_item_stakes").insert({
          order_item_id: itemId,
          user_id: MEMBER_4,
          stake_qty: stakeQty,
        }),
        supabase.from("order_item_stakes").insert({
          order_item_id: itemId,
          user_id: MEMBER_5,
          stake_qty: stakeQty,
        }),
      ]);

      const errors = [first.error, second.error].filter((e) => e !== null);
      expect(errors.length).toBe(1);

      const { data } = await supabase
        .from("order_items")
        .select("quantity")
        .eq("order_item_id", itemId)
        .single();
      expect(data?.quantity).toBe(stakeQty * 3);
    });
  });

  // order_item_stakes UNIQUE (order_item_id, user_id): a member's commitment to
  // one item is a single row, edited via UPDATE -- never a second INSERT.
  // trg_check_stake_capacity's own-stake exclusion assumes this; this
  // constraint is the backstop for the case that assumption alone can't cover
  // (a second stake small enough to still fit within remaining capacity).
  describe("order_item_stakes UNIQUE (order_item_id, user_id)", () => {
    const supabase = createServiceRoleClient();
    let orderId: number;

    afterEach(async () => {
      await cleanupOrder(supabase, orderId);
    });

    it("rejects a second stake row for a member who already holds a stake on the item, even within capacity", async () => {
      orderId = await createTestOrder(supabase);
      const itemId = await createOrderItem(
        supabase,
        orderId,
        THRESHOLD_PRODUCT_ID,
      );

      await supabase.from("order_item_stakes").insert({
        order_item_id: itemId,
        user_id: MEMBER_2,
        stake_qty: 2,
      });

      // Room for 4 more (6 - 2) -- would pass trg_check_stake_capacity, so
      // rejection here comes from the constraint, not the trigger.
      const { error } = await supabase.from("order_item_stakes").insert({
        order_item_id: itemId,
        user_id: MEMBER_2,
        stake_qty: 1,
      });
      expect(error).not.toBeNull();

      const { data } = await supabase
        .from("order_items")
        .select("quantity")
        .eq("order_item_id", itemId)
        .single();
      expect(data?.quantity).toBe(2);
    });

    it("allows the same member to hold stakes on two different order items", async () => {
      orderId = await createTestOrder(supabase);
      const bundleItemId = await createOrderItem(
        supabase,
        orderId,
        THRESHOLD_PRODUCT_ID,
      );
      const tieredItemId = await createOrderItem(
        supabase,
        orderId,
        TIERED_PRODUCT_ID,
        { maxQuantity: null },
      );

      const { error: firstError } = await supabase
        .from("order_item_stakes")
        .insert({ order_item_id: bundleItemId, user_id: MEMBER_2, stake_qty: 2 });
      expect(firstError).toBeNull();

      const { error: secondError } = await supabase
        .from("order_item_stakes")
        .insert({ order_item_id: tieredItemId, user_id: MEMBER_2, stake_qty: 5 });
      expect(secondError).toBeNull();
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
      const orderItemId = await createOrderItem(
        supabase,
        orderId,
        TIERED_PRODUCT_ID,
        {
          maxQuantity: null,
        },
      );

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
      const orderItemId = await createOrderItem(
        supabase,
        orderId,
        TIERED_PRODUCT_ID,
        {
          maxQuantity: null,
        },
      );

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

      await supabase
        .from("order_item_stakes")
        .delete()
        .eq("stake_id", stake!.stake_id);

      const { data } = await supabase
        .from("order_items")
        .select("quantity")
        .eq("order_item_id", orderItemId)
        .single();
      expect(data?.quantity).toBe(15);
    });

    it("reflects the new sum after a stake_qty update", async () => {
      orderId = await createTestOrder(supabase);
      const orderItemId = await createOrderItem(
        supabase,
        orderId,
        TIERED_PRODUCT_ID,
        {
          maxQuantity: null,
        },
      );

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

  // trg_apportion_on_close: the instant a threshold_bundle item's stakes sum
  // to threshold_qty, rewrites every stake's stake_amount via Hamilton
  // (largest-remainder-first) apportionment so they sum exactly to
  // bundle_price (ties broken by ascending stake_id).
  //
  // Also asserts order_item_resolution, the derived view that flips to
  // 'succeeded'/'maxed_out' the instant an item hits its own capacity ceiling.
  //
  // Widget 6-Pack (THRESHOLD_PRODUCT_ID): threshold_qty=6, bundle_price=5000.
  describe("trg_apportion_on_close + order_item_resolution", () => {
    const supabase = createServiceRoleClient();
    let orderId: number;

    afterEach(async () => {
      await cleanupOrder(supabase, orderId);
    });

    it("apportions a tied-remainder fill, ties broken by ascending stake_id", async () => {
      orderId = await createTestOrder(supabase);
      const itemId = await createOrderItem(
        supabase,
        orderId,
        THRESHOLD_PRODUCT_ID,
      );

      // Equal stake_qtys always produce a tied fractional remainder across the
      // three rows, exercising the ties-broken-by-ascending-stake_id rule.
      const stakeQtys = Array(3).fill(THRESHOLD_CONFIG.thresholdQty / 3);

      const stakeIds: number[] = [];
      for (const [i, userId] of [MEMBER_2, MEMBER_3, MEMBER_4].entries()) {
        const { data } = await supabase
          .from("order_item_stakes")
          .insert({
            order_item_id: itemId,
            user_id: userId,
            stake_qty: stakeQtys[i],
          })
          .select("stake_id")
          .single();
        stakeIds.push(data!.stake_id);
      }

      // Apportionment only runs at close -- stake_amount stays the lossy
      // per-row value until then.
      await closeOrder(supabase, orderId);

      const { data: stakes } = await supabase
        .from("order_item_stakes")
        .select("stake_id, stake_amount")
        .eq("order_item_id", itemId)
        .order("stake_id", { ascending: true });

      expect(stakes?.map((s) => s.stake_amount)).toEqual(
        apportionBundleStakes(stakeQtys),
      );
      expect(stakes?.reduce((sum, s) => sum + s.stake_amount, 0)).toBe(
        THRESHOLD_CONFIG.bundlePrice,
      );

      const { data: resolution } = await supabase
        .from("order_item_resolution")
        .select("resolution_status")
        .eq("order_item_id", itemId)
        .single();
      expect(resolution?.resolution_status).toBe("succeeded");
    });

    it("apportions an uneven-remainder fill, the largest-remainder stake absorbs the leftover cent", async () => {
      orderId = await createTestOrder(supabase);
      const itemId = await createOrderItem(
        supabase,
        orderId,
        THRESHOLD_PRODUCT_ID,
      );

      // Three distinct quantities summing exactly to threshold_qty, so their
      // remainders differ and only one absorbs the leftover cent.
      const stakeQtys = [1, 2, THRESHOLD_CONFIG.thresholdQty - 3];
      for (const [i, userId] of [MEMBER_2, MEMBER_3, MEMBER_4].entries()) {
        await supabase.from("order_item_stakes").insert({
          order_item_id: itemId,
          user_id: userId,
          stake_qty: stakeQtys[i],
        });
      }

      await closeOrder(supabase, orderId);

      const { data: stakes } = await supabase
        .from("order_item_stakes")
        .select("stake_id, stake_amount")
        .eq("order_item_id", itemId)
        .order("stake_id", { ascending: true });

      expect(stakes?.map((s) => s.stake_amount)).toEqual(
        apportionBundleStakes(stakeQtys),
      );
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

      const { error: insertError } = await supabase
        .from("order_item_stakes")
        .insert({
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

      // tier0/tier1 are the two lowest floors in the seeded ladder (0 and 5).
      // beforeQty stays under tier1's floor; crossQty brings the cumulative
      // total to exactly tier1's floor.
      const [tier0, tier1] = TIER_CONFIG;
      const beforeQty = Math.max(1, tier1.qtyFloor - 2);
      const crossQty = tier1.qtyFloor - beforeQty;

      await supabase.from("order_item_stakes").insert({
        order_item_id: itemId,
        user_id: MEMBER_2,
        stake_qty: beforeQty,
      });

      const { data: beforeCross } = await supabase
        .from("order_items")
        .select("unit_price")
        .eq("order_item_id", itemId)
        .single();
      expect(beforeCross?.unit_price).toBe(tier0.unitPrice);

      await supabase.from("order_item_stakes").insert({
        order_item_id: itemId,
        user_id: MEMBER_3,
        stake_qty: crossQty,
      });

      const { data: afterCross } = await supabase
        .from("order_items")
        .select("unit_price")
        .eq("order_item_id", itemId)
        .single();
      expect(afterCross?.unit_price).toBe(tier1.unitPrice);

      const { data: stakes } = await supabase
        .from("order_item_stakes")
        .select("user_id, stake_amount")
        .eq("order_item_id", itemId);
      const amountByUser = new Map(
        stakes!.map((s) => [s.user_id, s.stake_amount]),
      );

      // All-units pricing: the new tier price applies to each stake's full
      // stake_qty, not just the marginal units that crossed the boundary.
      expect(amountByUser.get(MEMBER_2)).toBe(beforeQty * tier1.unitPrice);
      expect(amountByUser.get(MEMBER_3)).toBe(crossQty * tier1.unitPrice);
    });
  });
});

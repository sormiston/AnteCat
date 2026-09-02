import type { Database } from "@/lib/database.types";
import { createClient } from "@supabase/supabase-js";
import { addDays, formatISO } from "date-fns";

// Not a runnable test file matched by vitest's tests/**/*.test.ts glob -- shared setup only.

// service_role, not anon: these tests only check that triggers fire and
// behave correctly, not end-user-facing RLS/client behavior, so they talk to
// Postgres with RLS bypassed.
export function createServiceRoleClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export type TestClient = ReturnType<typeof createServiceRoleClient>;

export type ThresholdConfig = { thresholdQty: number; bundlePrice: number };
export type TierRow = { qtyFloor: number; unitPrice: number };

// Fixture identity/config below is read from supabase/seed.sql's actual
// effect on the DB, once, at module load -- rather than copied as literals
// that can silently drift from what the seed file really produces. Requires
// supabase db reset to have been run against the local stack already.
async function loadFixtures(client: TestClient) {
  const { data: products, error: productsError } = await client
    .from("products")
    .select("product_id, pricing_type");
  if (productsError || !products) {
    throw new Error(
      `loadFixtures: failed to load products: ${productsError?.message}`,
    );
  }
  const thresholdProduct = products.find(
    (p) => p.pricing_type === "threshold_bundle",
  );
  const tieredProduct = products.find((p) => p.pricing_type === "tiered");
  if (!thresholdProduct || !tieredProduct) {
    throw new Error(
      "loadFixtures: seed.sql must seed exactly one threshold_bundle and one tiered product",
    );
  }

  const { data: threshold, error: thresholdError } = await client
    .from("product_bundle_thresholds")
    .select("threshold_qty, bundle_price")
    .eq("product_id", thresholdProduct.product_id)
    .single();
  if (thresholdError || !threshold) {
    throw new Error(
      `loadFixtures: failed to load threshold config: ${thresholdError?.message}`,
    );
  }

  const { data: tiers, error: tiersError } = await client
    .from("product_price_tiers")
    .select("qty_floor, unit_price")
    .eq("product_id", tieredProduct.product_id)
    .order("qty_floor", { ascending: true });
  if (tiersError || !tiers || tiers.length === 0) {
    throw new Error(
      `loadFixtures: failed to load tier config: ${tiersError?.message}`,
    );
  }

  const { data: syndicate, error: syndicateError } = await client
    .from("syndicates")
    .select("syndicate_id")
    .single();
  if (syndicateError || !syndicate) {
    throw new Error(
      `loadFixtures: no seeded syndicate found: ${syndicateError?.message}`,
    );
  }

  // auth.users isn't exposed over PostgREST -- the Admin API is the
  // supported way to look users up from a service-role test client.
  const { data: usersPage, error: usersError } =
    await client.auth.admin.listUsers();
  if (usersError || !usersPage) {
    throw new Error(
      `loadFixtures: failed to list auth users: ${usersError?.message}`,
    );
  }
  const idByEmail = new Map(usersPage.users.map((u) => [u.email, u.id]));
  const requireUser = (email: string): string => {
    const id = idByEmail.get(email);
    if (!id) {
      throw new Error(
        `loadFixtures: seed.sql must seed an auth.users row for ${email}`,
      );
    }
    return id;
  };

  return {
    SYNDICATE_ID: syndicate.syndicate_id,
    ADMIN_USER_ID: requireUser("admin@example.test"),
    MEMBER_2: requireUser("member2@example.test"),
    MEMBER_3: requireUser("member3@example.test"),
    MEMBER_4: requireUser("member4@example.test"),
    MEMBER_5: requireUser("member5@example.test"),
    THRESHOLD_PRODUCT_ID: thresholdProduct.product_id,
    TIERED_PRODUCT_ID: tieredProduct.product_id,
    THRESHOLD_CONFIG: {
      thresholdQty: threshold.threshold_qty,
      bundlePrice: threshold.bundle_price,
    } satisfies ThresholdConfig,
    TIER_CONFIG: tiers.map((t) => ({
      qtyFloor: t.qty_floor,
      unitPrice: t.unit_price,
    })) satisfies TierRow[],
  };
}

export const {
  SYNDICATE_ID,
  ADMIN_USER_ID,
  MEMBER_2,
  MEMBER_3,
  MEMBER_4,
  MEMBER_5,
  THRESHOLD_PRODUCT_ID,
  TIERED_PRODUCT_ID,
  THRESHOLD_CONFIG,
  TIER_CONFIG,
} = await loadFixtures(createServiceRoleClient());

// trg_init_order_item_unit_price's threshold_bundle formula: bundle_price /
// threshold_qty, integer floor.
// "Ideal" price because this is floor of division, before apportionment of leftover cents.
export function bundleUnitIdealPrice(
  config: ThresholdConfig = THRESHOLD_CONFIG,
): number {
  return Math.floor(config.bundlePrice / config.thresholdQty);
}

// trg_sync_tiered_unit_price's lookup: the highest qty_floor <= qty.
export function tierUnitPriceForQty(
  qty: number,
  tiers: TierRow[] = TIER_CONFIG,
): number {
  const covering = [...tiers].reverse().find((t) => t.qtyFloor <= qty);
  if (!covering) {
    throw new Error(`tierUnitPriceForQty: no covering tier for qty ${qty}`);
  }
  return covering.unitPrice;
}

export const TIER_UNIT_PRICE_MAP = Object.fromEntries(
  TIER_CONFIG.map((t) => [Number(t.qtyFloor), t.unitPrice]),
);

// Mirrors apportion_bundle_stakes's Hamilton (largest-remainder)
// apportionment (supabase/migrations/20260822221600_..._triggers.sql), so
// tests can assert against a computed split instead of hand-derived cent
// values. stakeQtys must be passed in ascending stake_id order -- ties break
// the same way the SQL does, by position, since ascending stake_id is
// exactly the insertion order these tests use.
export function apportionBundleStakes(
  stakeQtys: number[],
  config: ThresholdConfig = THRESHOLD_CONFIG,
): number[] {
  const shares = stakeQtys.map((qty, index) => {
    const raw = config.bundlePrice * qty;
    return {
      index,
      base: Math.floor(raw / config.thresholdQty),
      remainder: raw % config.thresholdQty,
    };
  });
  const leftoverCents =
    config.bundlePrice - shares.reduce((sum, s) => sum + s.base, 0);
  const bumped = new Set(
    [...shares]
      .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
      .slice(0, leftoverCents)
      .map((s) => s.index),
  );
  return shares.map((s) => s.base + (bumped.has(s.index) ? 1 : 0));
}

export async function createTestOrder(supabase: TestClient): Promise<number> {
  const deadlineAt = formatISO(addDays(new Date(), 4));
  const { data, error } = await supabase
    .from("orders")
    .insert({ syndicate_id: SYNDICATE_ID, deadline_at: deadlineAt })
    .select("order_id")
    .single();
  if (error || !data) {
    throw new Error(`createTestOrder failed: ${error?.message}`);
  }
  return data.order_id;
}

export async function createOrderItem(
  supabase: TestClient,
  orderId: number,
  productId: number,
  opts: { unitPrice?: number; maxQuantity?: number | null } = {},
): Promise<number> {
  const { data, error } = await supabase
    .from("order_items")
    .insert({
      order_id: orderId,
      product_id: productId,
      max_quantity: opts.maxQuantity ?? null,
    })
    .select("order_item_id")
    .single();
  if (error || !data) {
    throw new Error(`createOrderItem failed: ${error?.message}`);
  }
  return data.order_item_id;
}

export async function closeOrder(
  supabase: TestClient,
  orderId: number,
): Promise<void> {
  const { error } = await supabase
    .from("orders")
    .update({ status: "closed", closed_at: formatISO(new Date()) })
    .eq("order_id", orderId);
  if (error) {
    throw new Error(`closeOrder failed: ${error.message}`);
  }
}

// Deletes stakes -> items -> order, in that order (no ON DELETE CASCADE exists).
export async function cleanupOrder(
  supabase: TestClient,
  orderId: number,
): Promise<void> {
  const { data: items } = await supabase
    .from("order_items")
    .select("order_item_id")
    .eq("order_id", orderId);

  const itemIds = (items ?? []).map((item) => item.order_item_id);
  if (itemIds.length > 0) {
    await supabase
      .from("order_item_stakes")
      .delete()
      .in("order_item_id", itemIds);
    await supabase.from("order_items").delete().in("order_item_id", itemIds);
  }
  await supabase.from("orders").delete().eq("order_id", orderId);
}

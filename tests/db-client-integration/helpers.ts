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

// Seeded in supabase/seed.sql.
export const SYNDICATE_ID = 1;
export const ADMIN_USER_ID = "a1111111-1111-1111-1111-111111111111";
export const MEMBER_2 = "a2222222-2222-2222-2222-222222222222";
export const MEMBER_3 = "a3333333-3333-3333-3333-333333333333";
export const MEMBER_4 = "a4444444-4444-4444-4444-444444444444";
export const MEMBER_5 = "a5555555-5555-5555-5555-555555555555";

// Widget 6-Pack: threshold_bundle, threshold_qty=6, bundle_price=5000.
export const THRESHOLD_PRODUCT_ID = 1;
// Bulk Gizmos: tiered, no product-level cap (capacity is per order_item).
export const TIERED_PRODUCT_ID = 2;

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
      unit_price: opts.unitPrice ?? 833,
      max_quantity: opts.maxQuantity ?? null,
    })
    .select("order_item_id")
    .single();
  if (error || !data) {
    throw new Error(`createOrderItem failed: ${error?.message}`);
  }
  return data.order_item_id;
}

export async function closeOrder(supabase: TestClient, orderId: number): Promise<void> {
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

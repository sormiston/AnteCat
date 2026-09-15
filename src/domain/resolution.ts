// Mirrors the order_item_resolution view
// (supabase/migrations/20260822221625_create_order_item_resolution_view.sql).
//
// The client reads this rather than the view itself: the view would be a
// second query key for one badge, and the SPEC's Realtime section pins the
// screen to a single request. Keep this function and that view identical --
// the view is the authority, this is the copy.

import type { PricingType } from "@/domain/capacity";

export type OrderItemResolution = "open" | "succeeded" | "maxed_out";

export type ResolutionInput = {
  quantity: number;
  pricingType: PricingType;
  /** product_bundle_thresholds.threshold_qty, absent for a tiered product. */
  thresholdQty?: number | null;
  /** order_items.max_quantity, null when uncapped. */
  maxQuantity?: number | null;
};

export function resolveOrderItem({
  quantity,
  pricingType,
  thresholdQty = null,
  maxQuantity = null,
}: ResolutionInput): OrderItemResolution {
  // Equality, not >=, matching the view. A bundle cannot overshoot:
  // check_stake_capacity rejects the stake that would take it past the pack.
  if (pricingType === "threshold_bundle") {
    return thresholdQty !== null && quantity === thresholdQty
      ? "succeeded"
      : "open";
  }

  if (maxQuantity !== null && quantity >= maxQuantity) return "maxed_out";
  return "open";
}

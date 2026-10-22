export type PricingType = "threshold_bundle" | "tiered";

/**
 * Units the item can still take, or null when nothing caps it.
 *
 * `ceiling` is whichever ceiling the pricing type uses: threshold_qty for a
 * bundle, max_quantity for a tiered item. A bundle with no threshold config is
 * uncapped here for the same reason it never resolves in resolution.ts -- the
 * rule it would be measured against is missing, so there is nothing to report.
 *
 * Never negative: quantity can only exceed a ceiling if one was lowered after
 * the fact, which admins may do during the open window, and "-3 left" is not a
 * thing to tell anyone.
 */
export function capacityRemaining(
  pricingType: PricingType,
  currentQty: number,
  ceiling: number | null,
): number | null {
  if (ceiling === null) return null;
  if (pricingType === "threshold_bundle" && ceiling <= 0) return null;
  return Math.max(0, ceiling - currentQty);
}

/** How full the item is, 0 to 1. Null when nothing caps it, so there is no fraction to draw. */
export function capacityFraction(
  pricingType: PricingType,
  currentQty: number,
  ceiling: number | null,
): number | null {
  const remaining = capacityRemaining(pricingType, currentQty, ceiling);
  if (remaining === null || ceiling === null || ceiling <= 0) return null;
  return Math.min(1, Math.max(0, currentQty / ceiling));
}

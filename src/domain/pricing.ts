// Price math. Pure, no React, no Supabase types -- the server is the authority
// on every figure this file computes; these exist to project a price the
// viewer hasn't committed to yet (the stake stepper) and to mark which tier is
// live. Nothing here writes anything.

import { groupDigits } from "@/lib/format";

export type PriceTier = { qtyFloor: number; unitPrice: number };

/**
 * The covering tier's unit price at a cumulative quantity: the highest
 * qty_floor <= quantity, mirroring sync_tiered_unit_price's lookup.
 *
 * Returns null where the SQL raises -- a quantity below every tier's floor,
 * which for a ladder that starts at 0 (the working assumption in
 * docs/technical/backend.md) can only happen on misconfigured pricing. A
 * render path is the wrong place to throw, so callers show the gap instead.
 */
export function tierPriceForQuantity(
  tiers: PriceTier[],
  cumulativeQty: number,
): number | null {
  let covering: PriceTier | null = null;
  for (const tier of tiers) {
    if (tier.qtyFloor > cumulativeQty) continue;
    if (!covering || tier.qtyFloor > covering.qtyFloor) covering = tier;
  }
  return covering?.unitPrice ?? null;
}

export type TierBreak = {
  tier: PriceTier;
  /** Units the whole item still needs before this price takes effect. */
  unitsAway: number;
};

/**
 * The next tier down the ladder, and how far off it is -- "3 more units and
 * everyone pays 21.50". Null once the item sits on the cheapest tier.
 *
 * Only tiers strictly cheaper than the current one count: a ladder is allowed
 * to repeat a price, and "2 more units to save nothing" is not worth saying.
 */
export function nextTierBreak(
  tiers: PriceTier[],
  cumulativeQty: number,
): TierBreak | null {
  const current = tierPriceForQuantity(tiers, cumulativeQty);
  const ahead = tiers
    .filter((tier) => tier.qtyFloor > cumulativeQty)
    .filter((tier) => current === null || tier.unitPrice < current)
    .sort((a, b) => a.qtyFloor - b.qtyFloor);

  const next = ahead[0];
  return next ? { tier: next, unitsAway: next.qtyFloor - cumulativeQty } : null;
}

/**
 * A bundle unit's display price: bundle_price / threshold_qty, floored, the
 * same integer division trg_init_order_item_unit_price does.
 *
 * Display only, and deliberately lossy -- 5000/6 is 833, and 833 x 6 is two
 * cents short of the pack. apportion_bundle_stakes settles that at close; this
 * never tries to.
 */
export function bundleUnitIdealPrice(
  bundlePriceCents: number,
  thresholdQty: number,
): number | null {
  if (thresholdQty <= 0) return null;
  return Math.floor(bundlePriceCents / thresholdQty);
}

/**
 * Integer cents to euros. Hand-rolled rather than Intl.NumberFormat, which
 * varies by platform ICU build -- three devices have to agree on a figure, and
 * a ledger's job is that they do.
 */
export function formatEuroCents(cents: number): string {
  const negative = cents < 0;
  const absolute = Math.abs(Math.trunc(cents));
  const remainder = (absolute % 100).toString().padStart(2, "0");
  const euros = groupDigits(Math.floor(absolute / 100));
  return `${negative ? "-" : ""}€${euros}.${remainder}`;
}

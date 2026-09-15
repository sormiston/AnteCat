// What a stake the viewer has not committed yet would cost, and how far they
// are allowed to go. Pure -- the server is the authority on every figure that
// ends up in the ledger (trg_sync_stake_amount_on_stake_qty overwrites
// whatever a client sends), so this exists only to answer "what happens if I
// press +" before anyone presses anything.

import type { PricingType } from "@/domain/capacity";
import {
  bundleUnitIdealPrice,
  tierPriceForQuantity,
  type PriceTier,
} from "@/domain/pricing";

export type StakeProjection = {
  /** What one unit would cost once this draft is in. Null on unpriceable config. */
  unitPriceCents: number | null;
  /** What the viewer would owe. Null for the same reason. */
  amountCents: number | null;
  /** The item's total quantity if they commit. */
  itemQuantity: number;
  /**
   * True when committing this draft is what drops the item onto a cheaper
   * tier -- the one moment a tiered item's whole pitch becomes concrete, and
   * worth saying out loud.
   */
  unlocksCheaperTier: boolean;
};

/**
 * A tiered item is priced on the item's whole quantity, so the viewer's own
 * draft moves the price they are being quoted. A bundle's per-unit figure is
 * fixed and floored, and stays a hair under the true share until
 * apportion_bundle_stakes settles it at close -- so this never claims to be
 * the final figure for a bundle that fills.
 */
export function projectStake({
  pricingType,
  draftQty,
  committedQty,
  itemQuantity,
  tiers,
  bundle,
}: {
  pricingType: PricingType;
  draftQty: number;
  /** The viewer's stake as the server currently holds it; 0 when they are not in. */
  committedQty: number;
  /** order_items.quantity, which already includes committedQty. */
  itemQuantity: number;
  tiers: PriceTier[];
  bundle: { thresholdQty: number; bundlePriceCents: number } | null;
}): StakeProjection {
  const nextQuantity = itemQuantity - committedQty + draftQty;

  if (pricingType === "threshold_bundle") {
    const unitPriceCents = bundle
      ? bundleUnitIdealPrice(bundle.bundlePriceCents, bundle.thresholdQty)
      : null;
    return {
      unitPriceCents,
      amountCents: unitPriceCents === null ? null : unitPriceCents * draftQty,
      itemQuantity: nextQuantity,
      unlocksCheaperTier: false,
    };
  }

  const unitPriceCents = tierPriceForQuantity(tiers, nextQuantity);
  const currentPrice = tierPriceForQuantity(tiers, itemQuantity);

  return {
    unitPriceCents,
    amountCents: unitPriceCents === null ? null : unitPriceCents * draftQty,
    itemQuantity: nextQuantity,
    unlocksCheaperTier:
      unitPriceCents !== null &&
      currentPrice !== null &&
      unitPriceCents < currentPrice,
  };
}

/**
 * The largest stake the viewer may hold on this item, or null when nothing
 * caps it. Their own committed units are already inside the item's quantity,
 * so they count toward their own headroom rather than against it -- otherwise
 * the last member to fill a pack could never adjust their own share.
 *
 * Never negative: an admin may lower max_quantity below what is already
 * committed, and the honest answer there is "you cannot add to this", not a
 * negative ceiling.
 */
export function stakeHeadroom(
  ceiling: number | null,
  itemQuantity: number,
  committedQty: number,
): number | null {
  if (ceiling === null) return null;
  return Math.max(committedQty, ceiling - itemQuantity + committedQty);
}

import { formatEuroCents } from "@/domain/pricing";
import type { OrderItemView } from "@/features/orders/view";
import { groupDigits, unitCount } from "@/lib/format";

/**
 * Where the item stands, then what follows from it. Two short sentences in
 * that order, so the pair reads the same way whichever pricing model produced
 * it -- and so the list and the detail screen cannot come to say different
 * things about the same item.
 *
 * Once the order is closed nothing is still to come, so the second sentence
 * switches from a prospect to an outcome rather than inviting a move nobody
 * can make.
 */
export const SETTLED_TO_THE_CENT = "Settled to the cent.";

export function standing(item: OrderItemView, settled: boolean): string {
  const taken =
    item.ceiling === null
      ? `${unitCount(item.quantity)} in.`
      : `${groupDigits(item.quantity)} of ${groupDigits(item.ceiling)} taken.`;

  if (isSettledToTheCent(item, settled)) {
    return `${taken} ${SETTLED_TO_THE_CENT}\nThese are the final shares.`;
  }
  if (item.resolution === "succeeded") {
    return `${taken} It settles the moment the order closes.`;
  }
  if (item.resolution === "maxed_out") {
    return `${taken} There is nothing left to take.`;
  }

  if (settled) {
    return item.pricingType === "threshold_bundle"
      ? `${taken} The pack never completed.`
      : `${taken} That was the closing price.`;
  }

  if (item.pricingType === "threshold_bundle") {
    if (item.remaining === null) return `${taken} This pack has no size set yet.`;
    return `${taken} ${unitCount(item.remaining)} more completes it.`;
  }
  if (item.nextBreak) {
    const { tier, unitsAway } = item.nextBreak;
    return `${taken} ${unitsAway} more and everyone pays ${formatEuroCents(tier.unitPrice)} each.`;
  }
  return `${taken} This is the best price on offer.`;
}

/**
 * A filled pack on a closed order: apportion_bundle_stakes has restated every
 * share so they sum to exactly the pack price.
 */
export function isSettledToTheCent(item: OrderItemView, settled: boolean) {
  return settled && item.resolution === "succeeded";
}

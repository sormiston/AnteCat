import {
  capacityFraction,
  capacityRemaining,
  type PricingType,
} from "@/domain/capacity";
import {
  bundleUnitIdealPrice,
  nextTierBreak,
  tierPriceForQuantity,
  type PriceTier,
  type TierBreak,
} from "@/domain/pricing";
import { resolveOrderItem, type OrderItemResolution } from "@/domain/resolution";
import type { OrderItem } from "@/features/orders/api";

/**
 * One order item, flattened from its PostgREST shape and run through the
 * domain functions once, so components read values instead of computing them.
 *
 * Everything here is derived from the single ['order', orderId] query. Nothing
 * is fetched, nothing is written.
 */
export type OrderItemView = {
  orderItemId: number;
  name: string;
  description: string | null;
  pricingType: PricingType;
  quantity: number;
  /** order_items.unit_price -- the server's figure, never recomputed here. */
  unitPriceCents: number;
  /** threshold_qty for a bundle, max_quantity for a tiered item, null when uncapped. */
  ceiling: number | null;
  remaining: number | null;
  fraction: number | null;
  resolution: OrderItemResolution;
  bundle: { thresholdQty: number; bundlePriceCents: number } | null;
  /** Sorted by qty_floor -- PostgREST guarantees no order on embedded rows. */
  tiers: PriceTier[];
  activeTier: PriceTier | null;
  nextBreak: TierBreak | null;
  /** The viewer's own commitment on this item, null when they are not in. */
  viewerStake: { stakeId: number; qty: number; amountCents: number } | null;
  /** How many members are in, the viewer included. */
  backerCount: number;
};

export function toOrderItemView(
  item: OrderItem,
  viewerId: string | null,
): OrderItemView {
  const product = item.products;
  const pricingType = product.pricing_type;
  const threshold = product.product_bundle_thresholds;
  const tiers: PriceTier[] = product.product_price_tiers
    .map((tier) => ({ qtyFloor: tier.qty_floor, unitPrice: tier.unit_price }))
    .sort((a, b) => a.qtyFloor - b.qtyFloor);

  const ceiling =
    pricingType === "threshold_bundle"
      ? (threshold?.threshold_qty ?? null)
      : item.max_quantity;

  const own = viewerId
    ? item.order_item_stakes.find((stake) => stake.user_id === viewerId)
    : undefined;

  return {
    orderItemId: item.order_item_id,
    name: product.name,
    description: product.description,
    pricingType,
    quantity: item.quantity,
    unitPriceCents: item.unit_price,
    ceiling,
    remaining: capacityRemaining(pricingType, item.quantity, ceiling),
    fraction: capacityFraction(pricingType, item.quantity, ceiling),
    resolution: resolveOrderItem({
      quantity: item.quantity,
      pricingType,
      thresholdQty: threshold?.threshold_qty ?? null,
      maxQuantity: item.max_quantity,
    }),
    bundle: threshold
      ? {
          thresholdQty: threshold.threshold_qty,
          bundlePriceCents: threshold.bundle_price,
        }
      : null,
    tiers,
    activeTier:
      pricingType === "tiered"
        ? (tiers.find(
            (tier) =>
              tier.unitPrice === tierPriceForQuantity(tiers, item.quantity),
          ) ?? null)
        : null,
    nextBreak:
      pricingType === "tiered" ? nextTierBreak(tiers, item.quantity) : null,
    viewerStake: own
      ? {
          stakeId: own.stake_id,
          qty: own.stake_qty,
          amountCents: own.stake_amount,
        }
      : null,
    backerCount: item.order_item_stakes.length,
  };
}

/**
 * What a unit of this item costs right now, for the card's headline figure.
 *
 * A bundle quotes its floored per-unit share rather than order_items.unit_price
 * so the pack price it sits beside is the figure it actually divides; the two
 * are the same value, derived the same way.
 */
export function unitPriceOf(item: OrderItemView): number | null {
  if (item.pricingType === "threshold_bundle") {
    return item.bundle
      ? bundleUnitIdealPrice(item.bundle.bundlePriceCents, item.bundle.thresholdQty)
      : null;
  }
  return item.activeTier?.unitPrice ?? item.unitPriceCents;
}

/** Items in a stable order -- PostgREST does not order embedded rows. */
export function toOrderItemViews(
  items: OrderItem[],
  viewerId: string | null,
): OrderItemView[] {
  return items
    .map((item) => toOrderItemView(item, viewerId))
    .sort((a, b) => a.orderItemId - b.orderItemId);
}

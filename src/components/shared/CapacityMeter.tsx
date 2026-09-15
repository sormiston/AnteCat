import type { PricingType } from "@/domain/capacity";
import { View } from "react-native";

/**
 * Capacity, drawn as what it actually is. Marks only -- the card says the
 * numbers in words beside it, so this never labels itself.
 *
 * A threshold bundle is an indivisible pack split between a countable number
 * of members, so it gets countable marks: one per unit, and a glance says two
 * are still going spare. A tiered item's ceiling is a supply limit that can run
 * to thousands, where marks mean nothing, so it gets a proportional bar. An
 * uncapped tiered item has no ceiling to draw and gets neither.
 *
 * The viewer's own units are the orange ones, here and everywhere.
 */

/** Past this many, marks stop being countable and turn into texture. */
const MAX_COUNTABLE = 14;

/**
 * Below this, a bar is a hairline against an empty track -- it reads as a
 * broken element rather than as "barely started", and the figures say it
 * better anyway. A tiered item's supply cap only becomes the story near it.
 */
const MIN_DRAWABLE_FRACTION = 0.05;

export function CapacityMeter({
  pricingType,
  quantity,
  ceiling,
  viewerQty = 0,
}: {
  pricingType: PricingType;
  quantity: number;
  ceiling: number | null;
  viewerQty?: number;
}) {
  if (ceiling === null || ceiling <= 0) return null;

  if (pricingType === "threshold_bundle" && ceiling <= MAX_COUNTABLE) {
    return <Chips total={ceiling} taken={quantity} yours={viewerQty} />;
  }

  if (quantity / ceiling < MIN_DRAWABLE_FRACTION) return null;
  return <Bar total={ceiling} taken={quantity} yours={viewerQty} />;
}

function Chips({
  total,
  taken,
  yours,
}: {
  total: number;
  taken: number;
  yours: number;
}) {
  const mine = Math.min(yours, total);
  const others = Math.min(Math.max(taken - mine, 0), total - mine);

  return (
    <View className="flex-row flex-wrap items-center gap-[6px]">
      {Array.from({ length: total }, (_, index) => {
        // Yours first, so your units sit against the card's own orange edge.
        const state =
          index < mine ? "mine" : index < mine + others ? "theirs" : "open";
        return (
          <View
            key={index}
            className={`h-[15px] w-[15px] rounded-full border-2 ${
              state === "mine"
                ? "border-ante bg-ante"
                : state === "theirs"
                  ? "border-ink bg-ink"
                  : "border-rule bg-transparent"
            }`}
          />
        );
      })}
    </View>
  );
}

function Bar({
  total,
  taken,
  yours,
}: {
  total: number;
  taken: number;
  yours: number;
}) {
  const percent = (value: number): `${number}%` =>
    `${Math.min(100, Math.max(0, (value / total) * 100))}%`;
  const mine = Math.min(yours, taken);

  return (
    <View className="h-[7px] flex-row overflow-hidden rounded-[1px] bg-rule">
      <View className="h-full bg-ante" style={{ width: percent(mine) }} />
      <View className="h-full bg-ink" style={{ width: percent(taken - mine) }} />
    </View>
  );
}

import { Numeral } from "@/components/shared/Numeral";
import { formatEuroCents, type PriceTier } from "@/domain/pricing";
import { Text, View } from "react-native";

/**
 * The price ladder for a tiered item, with the live rung marked.
 *
 * A tiered product's whole appeal is that the price can only fall as more
 * members join, so the rungs still ahead are drawn as open (dashed) rather
 * than as something unavailable -- they are the offer, not a locked state. The
 * rungs already passed are settled and recede.
 */
export function TierLadder({
  tiers,
  activeFloor,
}: {
  tiers: PriceTier[];
  /** qty_floor of the tier currently in force, or null if none covers the quantity. */
  activeFloor: number | null;
}) {
  if (tiers.length === 0) return null;

  return (
    <View className="flex-row flex-wrap gap-[6px]" testID="TierLadder">
      {tiers.map((tier, index) => {
        const next = tiers[index + 1];
        const state =
          activeFloor === null
            ? "ahead"
            : tier.qtyFloor === activeFloor
              ? "live"
              : tier.qtyFloor < activeFloor
                ? "passed"
                : "ahead";

        return (
          <View
            key={tier.qtyFloor}
            className={`rounded-[3px] border px-2 py-[5px] ${
              state === "live"
                ? "border-ink bg-white"
                : state === "ahead"
                  ? "border-dashed border-rule"
                  : "border-rule"
            }`}
          >
            <Numeral
              className={`text-[13px] ${
                state === "live" ? "font-semibold text-ink" : "text-dusk"
              }`}
            >
              {formatEuroCents(tier.unitPrice)}
            </Numeral>
            <Text className="text-[11px] text-dusk">
              {next ? `${tier.qtyFloor}\u2013${next.qtyFloor - 1}` : `${tier.qtyFloor}+`}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

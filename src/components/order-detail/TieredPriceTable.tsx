import { Numeral } from "@/components/shared/Numeral";
import { formatEuroCents, type PriceTier } from "@/domain/pricing";
import { groupDigits } from "@/lib/format";
import { Text, View } from "react-native";

/**
 * The full ladder, one rung per row.
 *
 * The list screen's TierLadder compresses this into chips because a card has
 * no room for it; here there is room, and the ladder is the item's whole
 * proposition -- the price falls as the group grows, and a member deciding how
 * much to take needs to see how far the next rung is, not just that one exists.
 *
 * The rung in force is drawn solid. Rungs ahead stay open rather than
 * disabled: they are the offer, not a locked state.
 */
export function TieredPriceTable({
  tiers,
  activeFloor,
  quantity,
}: {
  tiers: PriceTier[];
  /** qty_floor of the tier currently in force, or null if none covers the quantity. */
  activeFloor: number | null;
  /** The item's committed quantity, for the "you are here" marker. */
  quantity: number;
}) {
  if (tiers.length === 0) return null;

  return (
    <View className="gap-[2px]">
      {tiers.map((tier, index) => {
        const next = tiers[index + 1];
        const live = tier.qtyFloor === activeFloor;
        const passed = activeFloor !== null && tier.qtyFloor < activeFloor;
        const away = tier.qtyFloor - quantity;

        return (
          <View
            key={tier.qtyFloor}
            className={`flex-row items-baseline gap-3 rounded-[3px] px-[10px] py-[7px] ${
              live ? "bg-ink/[0.06]" : ""
            }`}
          >
            <Numeral
              className={`w-[68px] text-[13px] ${
                live ? "font-semibold text-ink" : "text-dusk"
              }`}
            >
              {next
                ? `${groupDigits(tier.qtyFloor)}–${groupDigits(next.qtyFloor - 1)}`
                : `${groupDigits(tier.qtyFloor)}+`}
            </Numeral>

            <Text
              className={`flex-1 text-[12px] ${live ? "text-ink-soft" : "text-dusk"}`}
            >
              {live
                ? "what everyone pays now"
                : passed
                  ? "passed"
                  : `${groupDigits(away)} more to reach`}
            </Text>

            <Numeral
              className={`text-[15px] ${
                live ? "font-semibold text-ink" : "text-dusk"
              }`}
            >
              {formatEuroCents(tier.unitPrice)}
            </Numeral>
          </View>
        );
      })}
    </View>
  );
}

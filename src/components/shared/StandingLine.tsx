import {
  isSettledToTheCent,
  SETTLED_TO_THE_CENT,
  standing,
} from "@/components/shared/standing";
import type { OrderItemView } from "@/features/orders/view";
import { useState } from "react";
import { Text, View, type GestureResponderEvent } from "react-native";

const HAMILTON =
  "A pack price rarely divides evenly between shares. Everyone first pays " +
  "their exact share rounded down to the cent. The cents left over go one " +
  "each to the shares that lost the most in rounding, ties going to whoever " +
  "committed first. This is the Hamilton (largest remainder) method: the " +
  "shares add up to exactly the pack price, and nobody pays more than a cent " +
  "over their exact share.";

/**
 * The standing sentence, with an info tip right after "Settled to the cent"
 * explaining how the cents were split.
 */
export function StandingLine({
  item,
  settled,
  className,
}: {
  item: OrderItemView;
  settled: boolean;
  className: string;
}) {
  const [open, setOpen] = useState(false);
  const sentence = standing(item, settled);

  if (!isSettledToTheCent(item, settled)) {
    return <Text className={className}>{sentence}</Text>;
  }

  const at = sentence.indexOf(SETTLED_TO_THE_CENT) + SETTLED_TO_THE_CENT.length;

  // The list card is itself a link; keep the tap from navigating on web.
  const toggle = (e: GestureResponderEvent) => {
    e.preventDefault?.();
    e.stopPropagation?.();
    setOpen((o) => !o);
  };

  return (
    <View data-test-id="StandingLine" className="gap-2">
      <Text className={className}>
        {sentence.slice(0, at)}{" "}
        <Text
          onPress={toggle}
          suppressHighlighting
          accessibilityRole="button"
          accessibilityLabel="How the cents were split"
          accessibilityState={{ expanded: open }}
          className={`font-semibold ${open ? "text-ink" : "text-dusk"}`}
        >
          ⓘ
        </Text>
        {sentence.slice(at)}
      </Text>
      {open ? (
        <View className="rounded-[4px] border border-rule bg-ground px-3 py-2">
          <Text className="text-[12px] leading-[17px] text-ink-soft">
            {HAMILTON}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

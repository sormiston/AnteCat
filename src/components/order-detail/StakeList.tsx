import { Numeral } from "@/components/shared/Numeral";
import { formatEuroCents } from "@/domain/pricing";
import type { OrderItemView } from "@/features/orders/view";
import { labelFor, type SyndicateMember } from "@/features/syndicates/api";
import { unitCount } from "@/lib/format";
import { Text, View } from "react-native";

/**
 * Who is in, and for how much. The record the whole product exists to replace
 * a group chat with -- so it shows everyone's share, not a count of them.
 *
 * Amounts are provisional while the order is open: a filled bundle's stakes
 * sum to a little under the pack price until apportion_bundle_stakes settles
 * them at close (docs/technical/backend.md). The total row says which state
 * these figures are in rather than presenting a sum as final when it isn't.
 */
export function StakeList({
  item,
  members,
  settled,
}: {
  item: OrderItemView;
  members: SyndicateMember[] | undefined;
  settled: boolean;
}) {
  if (item.stakes.length === 0) {
    return (
      <Text
        className="text-[14px] leading-[21px] text-ink-soft"
        testID="StakeList"
      >
        Nobody has taken a share yet. Whoever goes first sets this one moving.
      </Text>
    );
  }

  const total = item.stakes.reduce((sum, stake) => sum + stake.amountCents, 0);

  return (
    <View className="gap-[2px]" testID="StakeList">
      {item.stakes.map((stake) => (
        <View
          key={stake.stakeId}
          className={`flex-row items-baseline gap-3 rounded-[3px] px-[10px] py-[8px] ${
            stake.isViewer ? "bg-ante-wash" : ""
          }`}
        >
          <Text
            className={`flex-1 text-[14px] ${
              stake.isViewer ? "font-semibold text-ante-deep" : "text-ink"
            }`}
            numberOfLines={1}
          >
            {stake.isViewer ? "You" : labelFor(members, stake.userId)}
          </Text>
          <Numeral
            className={`text-[13px] ${stake.isViewer ? "text-ante-deep" : "text-dusk"}`}
          >
            {unitCount(stake.qty)}
          </Numeral>
          <Numeral
            className={`w-[84px] text-right text-[15px] font-semibold ${
              stake.isViewer ? "text-ante-deep" : "text-ink"
            }`}
          >
            {formatEuroCents(stake.amountCents)}
          </Numeral>
        </View>
      ))}

      <View className="mt-2 flex-row items-baseline gap-3 border-t border-rule px-[10px] pt-[10px]">
        <Text className="flex-1 text-[13px] text-dusk">
          {item.stakes.length === 1 ? "1 member" : `${item.stakes.length} members`}
          {settled ? ", settled" : ", so far"}
        </Text>
        <Numeral className="text-[13px] text-dusk">
          {unitCount(item.quantity)}
        </Numeral>
        <Numeral className="w-[84px] text-right text-[15px] font-semibold text-ink">
          {formatEuroCents(total)}
        </Numeral>
      </View>
    </View>
  );
}

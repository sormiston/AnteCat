import { CapacityMeter } from "@/components/shared/CapacityMeter";
import { Numeral } from "@/components/shared/Numeral";
import { ResolutionBadge } from "@/components/shared/ResolutionBadge";
import { standing } from "@/components/shared/standing";
import { TierLadder } from "@/components/shared/TierLadder";
import { formatEuroCents } from "@/domain/pricing";
import { unitPriceOf, type OrderItemView } from "@/features/orders/view";
import type { Database } from "@/lib/database.types";
import { unitCount } from "@/lib/format";
import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

type OrderStatus = Database["public"]["Enums"]["order_status"];

/**
 * One item, summarised. A summary only -- stakes are committed on the detail
 * screen, and one screen owns that (SPEC.md's Component Inventory).
 *
 * The two pricing models get structurally different cards because they mean
 * different things: a bundle is a fixed pack with countable shares left, a
 * tiered item is an open quantity whose price falls as the group grows. One
 * shared card shape would flatten that into a progress bar and lose it.
 */
export function OrderItemCard({
  item,
  orderStatus,
}: {
  item: OrderItemView;
  orderStatus: OrderStatus;
}) {
  const settled = orderStatus !== "open";
  const unitPrice = unitPriceOf(item);
  const mine = item.viewerStake;
  const isBundle = item.pricingType === "threshold_bundle";

  return (
    <Link href={`/order/${item.orderItemId}`} asChild testID="OrderItemCard">
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${item.name}, ${item.quantity} units taken`}
        // The left edge is the only place a card says whether you're in.
        className={`gap-[10px] rounded-[6px] border border-l-[3px] border-rule bg-paper px-4 py-[14px] active:bg-ground ${
          mine ? "border-l-ante" : ""
        }`}
      >
        <View className="flex-row items-start justify-between gap-3">
          <Text className="flex-1 text-[17px] font-semibold leading-[21px] text-ink">
            {item.name}
          </Text>
          <ResolutionBadge resolution={item.resolution} />
        </View>

        {item.description ? (
          <Text className="text-[12px] leading-[17px] text-dusk">
            {item.description}
          </Text>
        ) : null}

        {item.pricingType === "tiered" ? (
          <TierLadder
            tiers={item.tiers}
            activeFloor={item.activeTier?.qtyFloor ?? null}
          />
        ) : null}

        <CapacityMeter
          pricingType={item.pricingType}
          quantity={item.quantity}
          ceiling={item.ceiling}
          viewerQty={mine?.qty ?? 0}
        />

        <Text className="text-[13px] leading-[18px] text-ink-soft">
          {standing(item, settled)}
        </Text>

        <View className="gap-[6px] border-t border-rule pt-[10px]">
          <Figure
            label={isBundle ? "The pack" : "Each unit"}
            value={
              isBundle
                ? item.bundle
                  ? formatEuroCents(item.bundle.bundlePriceCents)
                  : "—"
                : unitPrice !== null
                  ? formatEuroCents(unitPrice)
                  : "—"
            }
          />
          {isBundle && unitPrice !== null ? (
            <Figure label="Each unit" value={formatEuroCents(unitPrice)} muted />
          ) : null}

          {mine ? (
            <Figure
              label={`${settled ? "You took" : "You're in for"} ${unitCount(mine.qty)}`}
              value={formatEuroCents(mine.amountCents)}
              mine
            />
          ) : (
            <Text className="text-[13px] text-dusk">
              {settled ? "You sat this one out" : "No share of this one yet"}
            </Text>
          )}
        </View>
      </Pressable>
    </Link>
  );
}

function Figure({
  label,
  value,
  muted = false,
  mine = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
  mine?: boolean;
}) {
  return (
    <View
      className="flex-row items-baseline justify-between gap-3"
      testID="Figure"
    >
      <Text className={`text-[13px] ${mine ? "text-ante-deep" : "text-dusk"}`}>
        {label}
      </Text>
      <Numeral
        className={`text-[15px] ${
          mine
            ? "font-semibold text-ante-deep"
            : muted
              ? "text-dusk"
              : "font-semibold text-ink"
        }`}
      >
        {value}
      </Numeral>
    </View>
  );
}

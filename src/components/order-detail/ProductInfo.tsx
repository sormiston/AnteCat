import { TieredPriceTable } from "@/components/order-detail/TieredPriceTable";
import { Numeral } from "@/components/shared/Numeral";
import { formatEuroCents } from "@/domain/pricing";
import { unitPriceOf, type OrderItemView } from "@/features/orders/view";
import { Text, View } from "react-native";

/**
 * What is being bought, and what it costs.
 *
 * Name and description are all the schema carries today (products has no image
 * column), so the block is arranged to take one later without anything below
 * it moving: description sits under the name, the price block under that.
 *
 * The price is drawn as the pricing model actually works. A bundle quotes one
 * pack price and the share it divides into; a tiered item quotes its whole
 * ladder, because "what it costs" has no single answer there -- it depends on
 * how many people turn up.
 */
export function ProductInfo({
  item,
  settled,
}: {
  item: OrderItemView;
  /** True once the order has closed, when nothing here is still to come. */
  settled: boolean;
}) {
  const unitPrice = unitPriceOf(item);

  return (
    <View className="gap-4">
      {item.description ? (
        <Text className="max-w-[560px] text-[14px] leading-[21px] text-ink-soft">
          {item.description}
        </Text>
      ) : null}

      {item.pricingType === "tiered" ? (
        <TieredPriceTable
          tiers={item.tiers}
          activeFloor={item.activeTier?.qtyFloor ?? null}
          quantity={item.quantity}
        />
      ) : (
        <View className="gap-[6px]">
          <PriceRow
            label="The pack"
            value={
              item.bundle ? formatEuroCents(item.bundle.bundlePriceCents) : "—"
            }
          />
          <PriceRow
            label={
              item.bundle
                ? `Each of its ${item.bundle.thresholdQty} units`
                : "Each unit"
            }
            value={unitPrice !== null ? formatEuroCents(unitPrice) : "—"}
            muted
          />
          {/* The two cents trg_init_order_item_unit_price floors away are
              real, and members watch them move at close -- better to say so
              than to let a figure change under them unexplained. Once it has
              happened the stake list shows the result, so the warning goes. */}
          {item.bundle && !settled ? (
            <Text className="pt-1 text-[12px] leading-[17px] text-dusk">
              Per-unit is rounded down while the order is open. When it closes,
              the shares are restated to add up to exactly{" "}
              {formatEuroCents(item.bundle.bundlePriceCents)}.
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

function PriceRow({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <View className="flex-row items-baseline justify-between gap-3">
      <Text className="text-[13px] text-dusk">{label}</Text>
      <Numeral
        className={
          muted
            ? "text-[15px] text-dusk"
            : "text-[19px] font-semibold text-ink"
        }
      >
        {value}
      </Numeral>
    </View>
  );
}

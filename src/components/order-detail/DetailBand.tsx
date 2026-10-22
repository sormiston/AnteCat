import {
  DeadlineCountdown,
  WindowRule,
} from "@/components/order-list/DeadlineCountdown";
import { OrderStatusBadge } from "@/components/shared/OrderStatusBadge";
import type { Order } from "@/features/orders/api";
import type { Database } from "@/lib/database.types";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * The detail screen's own header, in the same field of colour as the list's,
 * rather than the navigator's stock bar above it.
 *
 * The countdown comes along deliberately: this is the screen where somebody
 * decides how much to commit, so how long they have to decide belongs in front
 * of them, not one screen back.
 */
export function DetailBand({
  order,
  status,
  title,
}: {
  order: Order;
  /** The drawn status, which turns over on the deadline rather than on the write. */
  status: Database["public"]["Enums"]["order_status"];
  /** The product's name. Absent while the item resolves, or if there is none. */
  title: string | undefined;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View className="bg-table" testID="DetailBand">
      <View
        className="mx-auto w-full max-w-[640px] gap-4 px-5 pb-5"
        style={{ paddingTop: insets.top + 14 }}
      >
        <View className="flex-row items-center justify-between gap-3">
          <BackToOrder />
          <OrderStatusBadge status={status} onBand />
        </View>

        {title ? (
          <Text className="text-[24px] font-semibold leading-[29px] text-white">
            {title}
          </Text>
        ) : null}

        {status === "open" ? (
          <DeadlineCountdown deadlineAt={order.deadline_at} />
        ) : null}
      </View>

      {status === "open" ? (
        <WindowRule openedAt={order.opened_at} deadlineAt={order.deadline_at} />
      ) : null}
    </View>
  );
}

/**
 * Hand-built rather than the navigator's back button, since this screen draws
 * its own header. It falls back to the list instead of going nowhere: on web
 * this URL is directly typable, so there is often no history behind it.
 */
function BackToOrder() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back to the order"
      onPress={() =>
        router.canGoBack() ? router.back() : router.replace("/order")
      }
      className="-ml-1 flex-row items-center gap-1 px-1 py-1"
      testID="BackToOrder"
    >
      <Text className="text-[17px] leading-[20px] text-ground/80">
        {"‹"}
      </Text>
      <Text className="text-[13px] text-ground/80">Order</Text>
    </Pressable>
  );
}

import { Stack, useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";

// Placeholder. Ticket 5 replaces the body with ProductInfo, the price display,
// ResolutionBadge, CapacityMeter, the stake list, and StakeStepper.
export default function OrderItemDetailScreen() {
  const { orderItemId } = useLocalSearchParams<{ orderItemId: string }>();

  return (
    <>
      <Stack.Screen options={{ title: "Item" }} />
      <View className="flex-1 items-center justify-center gap-2 p-6">
        <Text className="text-lg font-semibold">Order item {orderItemId}</Text>
        <Text className="text-center text-base text-neutral-500">
          Ticket 5 renders the item detail and stake controls here.
        </Text>
      </View>
    </>
  );
}

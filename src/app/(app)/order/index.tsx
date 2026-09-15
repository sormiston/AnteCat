import { supabase } from "@/lib/supabase";
import { Stack } from "expo-router";
import { Pressable, Text, View } from "react-native";

// Placeholder. Ticket 4 replaces the body with OrderStatusBadge,
// DeadlineCountdown, the admin close/execute action, and OrderItemCard list.
export default function OrderScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          title: "Order",
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              onPress={() => supabase.auth.signOut()}
            >
              <Text className="text-base text-blue-600 px-2">Sign out</Text>
            </Pressable>
          ),
        }}
      />
      <View className="flex-1 items-center justify-center gap-2 p-6">
        <Text className="text-lg font-semibold">No order items yet</Text>
        <Text className="text-center text-base text-neutral-500">
          Ticket 4 renders the seeded order here.
        </Text>
      </View>
    </>
  );
}

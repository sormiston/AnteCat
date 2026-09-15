import { Link, Stack } from "expo-router";
import { Text, View } from "react-native";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Not found" }} />
      <View className="flex-1 items-center justify-center gap-3 p-6">
        <Text className="text-lg font-semibold">This screen doesn&apos;t exist.</Text>
        <Link href="/order" className="text-base text-blue-600 underline">
          Go to the order
        </Link>
      </View>
    </>
  );
}

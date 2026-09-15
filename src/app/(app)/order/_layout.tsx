import { DEMO_ORDER_ID } from "@/features/orders/api";
import { useOrderRealtime } from "@/features/orders/useOrderRealtime";
import { Stack } from "expo-router";

/**
 * The subscription mounts here, not on either screen, so a change lands
 * whether the viewer is looking at the list or at one item's detail -- and so
 * moving between the two neither drops the channel nor opens a second one.
 *
 * <Stack />, not <Slot />: a Slot would collapse both screens into one screen
 * of the parent stack, losing the push animation and the back button that
 * both user journeys rely on (docs/technical/frontend.md).
 */
export default function OrderLayout() {
  useOrderRealtime(DEMO_ORDER_ID);

  return <Stack screenOptions={{ headerShown: false }} />;
}

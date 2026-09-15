import { AdminOrderActions } from "@/components/order-list/AdminOrderActions";
import {
  DeadlineCountdown,
  WindowRule,
} from "@/components/order-list/DeadlineCountdown";
import { OrderItemCard } from "@/components/order-list/OrderItemCard";
import { OrderStatusBadge } from "@/components/shared/OrderStatusBadge";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/shared/states";
import { isAdminOfSyndicate, isMemberOfSyndicate } from "@/domain/roles";
import { DEMO_ORDER_ID, useOrder, type Order } from "@/features/orders/api";
import { toOrderItemViews } from "@/features/orders/view";
import { useMemberships } from "@/features/syndicates/api";
import { failureKindOf } from "@/lib/queryErrors";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth/AuthProvider";
import { Stack } from "expo-router";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function OrderScreen() {
  const { user } = useAuth();
  const order = useOrder(DEMO_ORDER_ID);
  const memberships = useMemberships(user?.id);

  // Resolved once and used twice: the band shows an order's name and deadline
  // only to someone entitled to see them, so it can never sit above its own
  // "not your table" message.
  const viewerIsMember =
    order.data && memberships.data
      ? isMemberOfSyndicate(memberships.data, order.data.syndicate_id)
      : false;

  const body = () => {
    if (order.isPending || memberships.isPending) return <LoadingSkeleton />;

    if (order.error) {
      return (
        <ErrorState
          kind={failureKindOf(order.error)}
          onRetry={() => order.refetch()}
        />
      );
    }
    if (memberships.error) {
      return (
        <ErrorState
          kind={failureKindOf(memberships.error)}
          onRetry={() => memberships.refetch()}
        />
      );
    }

    // Route guards only keep the signed-out away; on web these URLs are
    // typable, so a signed-in stranger reaches this screen and is told so.
    if (!viewerIsMember) return <ErrorState kind="notAuthorized" />;

    return (
      <OrderBoard
        order={order.data}
        viewerId={user?.id ?? null}
        isAdmin={isAdminOfSyndicate(memberships.data, order.data.syndicate_id)}
      />
    );
  };

  return (
    <View className="flex-1 bg-ground">
      <Stack.Screen options={{ headerShown: false }} />
      <Band order={viewerIsMember ? order.data : undefined} />
      {body()}
    </View>
  );
}

function OrderBoard({
  order,
  viewerId,
  isAdmin,
}: {
  order: Order;
  viewerId: string | null;
  isAdmin: boolean;
}) {
  const items = toOrderItemViews(order.order_items, viewerId);

  if (items.length === 0) {
    return (
      <EmptyState
        title="Nothing on the table"
        message="This order is open but has no items yet. Your admin adds them; they'll appear here as soon as they do."
      />
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => String(item.orderItemId)}
      contentContainerClassName="mx-auto w-full max-w-[640px] gap-3 p-4"
      ListHeaderComponent={
        <Text className="pb-1 text-[13px] text-dusk">
          {items.length === 1 ? "1 item" : `${items.length} items`} on the table
        </Text>
      }
      renderItem={({ item }) => (
        <OrderItemCard item={item} orderStatus={order.status} />
      )}
      ListFooterComponent={
        isAdmin ? (
          <View className="pt-4">
            <AdminOrderActions orderId={order.order_id} status={order.status} />
          </View>
        ) : null
      }
    />
  );
}

/**
 * The header band. Rendered instead of the navigator's own header, not under
 * it: the countdown belongs in the same field of colour as the title, and a
 * stock header above it would cut that field in two.
 */
function Band({ order }: { order: Order | undefined }) {
  const insets = useSafeAreaInsets();

  return (
    <View className="bg-table">
      <View
        className="mx-auto w-full max-w-[640px] gap-5 px-5 pb-5"
        style={{ paddingTop: insets.top + 14 }}
      >
        <View className="flex-row items-center justify-between gap-3">
          <Text className="flex-1 text-[15px] font-semibold text-ground">
            {order?.syndicates.name ?? "AnteCat"}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => supabase.auth.signOut()}
            className="px-1 py-1"
          >
            <Text className="text-[13px] text-ground/70">Sign out</Text>
          </Pressable>
        </View>

        {order ? (
          <View className="flex-row items-end justify-between gap-3">
            <View className="flex-1">
              {order.status === "open" ? (
                <DeadlineCountdown deadlineAt={order.deadline_at} />
              ) : (
                <ClosedNote status={order.status} />
              )}
            </View>
            <OrderStatusBadge status={order.status} onBand />
          </View>
        ) : null}
      </View>

      {/* The band's bottom edge doubles as the window's own progress. */}
      {order && order.status === "open" ? (
        <WindowRule
          openedAt={order.opened_at}
          deadlineAt={order.deadline_at}
        />
      ) : null}
    </View>
  );
}

/**
 * A closed order has no countdown, so the band has no hero and shrinks to one
 * line. The badge beside it already says "Closed", so this says what that
 * means instead of repeating the word.
 */
function ClosedNote({ status }: { status: "closed" | "executed" }) {
  return (
    <Text className="text-[15px] leading-[21px] text-ground/80">
      {status === "executed"
        ? "Paid for off-platform. Every share below is what each member owes."
        : "Every share below is final. Nobody can change theirs now."}
    </Text>
  );
}

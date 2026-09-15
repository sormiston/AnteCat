import { DetailBand } from "@/components/order-detail/DetailBand";
import { ProductInfo } from "@/components/order-detail/ProductInfo";
import { StakeList } from "@/components/order-detail/StakeList";
import { StakeStepper } from "@/components/order-detail/StakeStepper";
import { CapacityMeter } from "@/components/shared/CapacityMeter";
import { ResolutionBadge } from "@/components/shared/ResolutionBadge";
import { standing } from "@/components/shared/standing";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/shared/states";
import { isMemberOfSyndicate } from "@/domain/roles";
import {
  DEMO_ORDER_ID,
  useCommitStake,
  useOrder,
  useWithdrawStake,
  type Order,
} from "@/features/orders/api";
import { findOrderItemView, type OrderItemView } from "@/features/orders/view";
import { useMemberships, useSyndicateMembers } from "@/features/syndicates/api";
import { failureKindOf } from "@/lib/queryErrors";
import { useAuth } from "@/providers/auth/AuthProvider";
import { useLocalSearchParams } from "expo-router";
import { ScrollView, Text, View } from "react-native";

/**
 * One item, and the only screen that writes a stake.
 *
 * It reads the same ['order', orderId] query the list does and picks its item
 * out of it, so arriving here from the list costs no request, and one Realtime
 * invalidation refreshes both screens at once (SPEC.md's Realtime section).
 */
export default function OrderItemDetailScreen() {
  const { orderItemId } = useLocalSearchParams<{ orderItemId: string }>();
  const itemId = Number(orderItemId);

  const { user } = useAuth();
  const order = useOrder(DEMO_ORDER_ID);
  const memberships = useMemberships(user?.id);

  const viewerIsMember =
    order.data && memberships.data
      ? isMemberOfSyndicate(memberships.data, order.data.syndicate_id)
      : false;

  const item =
    viewerIsMember && order.data
      ? findOrderItemView(order.data, itemId, user?.id ?? null)
      : undefined;

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
    // On web this URL is typable and bookmarkable, so both of these are
    // reachable without ever passing the list screen.
    if (!viewerIsMember) return <ErrorState kind="notAuthorized" />;
    // Not a failure: the order loaded and simply has no such item, which on
    // web is a typed or stale URL rather than anything going wrong.
    if (!item) {
      return (
        <EmptyState
          title="Not on this table"
          message="This order has no item at that address. It may have been removed, or the link points somewhere that never existed."
        />
      );
    }

    return (
      <ItemDetail
        order={order.data}
        item={item}
        viewerId={user?.id ?? null}
      />
    );
  };

  return (
    <View className="flex-1 bg-ground">
      {/* The band needs the order, not the item, so it is up before the item
          resolves -- which keeps the countdown steady rather than flashing in
          after everything else. */}
      {viewerIsMember && order.data ? (
        <DetailBand order={order.data} title={item?.name} />
      ) : (
        <View className="h-2 bg-table" />
      )}
      {body()}
    </View>
  );
}

function ItemDetail({
  order,
  item,
  viewerId,
}: {
  order: Order;
  item: OrderItemView;
  viewerId: string | null;
}) {
  const settled = order.status !== "open";
  const members = useSyndicateMembers(order.syndicate_id);
  const commit = useCommitStake(order.order_id);
  const withdraw = useWithdrawStake(order.order_id);

  const pending = commit.isPending || withdraw.isPending;
  const writeError = commit.error ?? withdraw.error;

  return (
    <ScrollView contentContainerClassName="mx-auto w-full max-w-[640px] gap-3 p-4 pb-10">
      <Section>
        <ProductInfo item={item} settled={settled} />
      </Section>

      <Section>
        <View className="flex-row items-start justify-between gap-3">
          <SectionTitle>Where it stands</SectionTitle>
          <ResolutionBadge resolution={item.resolution} />
        </View>
        <CapacityMeter
          pricingType={item.pricingType}
          quantity={item.quantity}
          ceiling={item.ceiling}
          viewerQty={item.viewerStake?.qty ?? 0}
        />
        <Text className="text-[14px] leading-[20px] text-ink-soft">
          {standing(item, settled)}
        </Text>
      </Section>

      <Section>
        <SectionTitle>Your share</SectionTitle>
        {settled ? (
          <ClosedShare item={item} status={order.status} />
        ) : viewerId ? (
          <StakeStepper
            item={item}
            isPending={pending}
            error={writeError}
            // Each write clears the other's failure, so a withdrawal never
            // lands under the error left by a commit that lost a race.
            onEdit={() => {
              commit.reset();
              withdraw.reset();
            }}
            onCommit={(qty) => {
              withdraw.reset();
              commit.mutate({
                orderItemId: item.orderItemId,
                userId: viewerId,
                qty,
              });
            }}
            onWithdraw={() => {
              commit.reset();
              withdraw.mutate({
                orderItemId: item.orderItemId,
                userId: viewerId,
              });
            }}
          />
        ) : null}
      </Section>

      <Section>
        <SectionTitle>Who&apos;s in</SectionTitle>
        <StakeList item={item} members={members.data} settled={settled} />
      </Section>
    </ScrollView>
  );
}

/**
 * A closed order's stakes are read-only, enforced by
 * trg_check_stake_order_is_open rather than by hiding the controls -- but
 * there is no reason to show a stepper that the database will refuse.
 */
function ClosedShare({
  item,
  status,
}: {
  item: OrderItemView;
  status: Order["status"];
}) {
  if (!item.viewerStake) {
    return (
      <Text className="text-[14px] leading-[21px] text-ink-soft">
        You didn&apos;t take a share of this one, and the order has closed.
      </Text>
    );
  }

  return (
    <Text className="text-[14px] leading-[21px] text-ink-soft">
      {status === "executed"
        ? "This has been bought. Your share below is what you owe."
        : "The order is closed, so your share is fixed at what's below."}
    </Text>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <View className="gap-[10px] rounded-[6px] border border-rule bg-paper px-4 py-[14px]">
      {children}
    </View>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text className="text-[13px] text-dusk">{children}</Text>;
}

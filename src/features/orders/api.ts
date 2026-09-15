import { supabase } from "@/lib/supabase";
import { toDataError } from "@/lib/queryErrors";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";

/**
 * The demo runs on one seeded order (supabase/seed.sql), and this milestone
 * ships no order picker or order list -- so the id is pinned here rather than
 * resolved.
 *
 * This constant is the whole of that shortcut. Anything that needs an order id
 * reads it from here, so the day a picker exists, this file is what changes.
 */
export const DEMO_ORDER_ID = 1;

export function orderQueryKey(orderId: number) {
  return ["order", orderId] as const;
}

// One request, one key -- the order, its items, each item's product and
// pricing config, and every stake on it (SPEC.md's Realtime section). The
// Realtime subscription invalidates this single key, so everything the two
// order screens draw refreshes together.
const ORDER_SELECT = `
  order_id, syndicate_id, status, opened_at, deadline_at, closed_at, executed_at,
  syndicates ( syndicate_id, name ),
  order_items (
    order_item_id, quantity, unit_price, max_quantity,
    products (
      product_id, name, description, pricing_type,
      product_bundle_thresholds ( threshold_qty, bundle_price ),
      product_price_tiers ( qty_floor, unit_price )
    ),
    order_item_stakes ( stake_id, user_id, stake_qty, stake_amount )
  )
` as const;

export async function fetchOrder(orderId: number) {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("order_id", orderId)
    .single();

  if (error) throw toDataError(error, `Loading order ${orderId}`);
  return data;
}

export type Order = Awaited<ReturnType<typeof fetchOrder>>;
export type OrderItem = Order["order_items"][number];
export type OrderStake = OrderItem["order_item_stakes"][number];

export function useOrder(orderId: number): UseQueryResult<Order> {
  return useQuery({
    queryKey: orderQueryKey(orderId),
    queryFn: () => fetchOrder(orderId),
  });
}

/**
 * Close the order early. The database only ever moves status forward
 * (trg_order_status_transition), and closing is what fires
 * apportion_bundle_stakes over every filled bundle -- so this is the one
 * action that turns provisional stake amounts into final ones.
 *
 * Nothing in the database ties this to the syndicate's admin. The screen gates
 * it on domain/roles.ts, which is a UX affordance until RLS exists.
 */
export function useCloseOrder(orderId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("orders")
        .update({ status: "closed", closed_at: new Date().toISOString() })
        .eq("order_id", orderId);
      if (error) throw toDataError(error, "Closing the order");
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: orderQueryKey(orderId) }),
  });
}

/** Marks a closed order paid for off-platform. An audit flag, nothing else resolves differently. */
export function useExecuteOrder(orderId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("orders")
        .update({ status: "executed", executed_at: new Date().toISOString() })
        .eq("order_id", orderId);
      if (error) throw toDataError(error, "Marking the order executed");
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: orderQueryKey(orderId) }),
  });
}

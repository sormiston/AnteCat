import { orderQueryKey } from "@/features/orders/api";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

/**
 * Keeps the one ['order', orderId] query fresh across devices.
 *
 * This is what the demo is for: three people, three devices, and nobody
 * pulling to refresh. The subscription invalidates a query key rather than
 * driving a live-state store of its own, so a change that arrives over the
 * socket and a change the viewer made themselves both end at the same refetch
 * and there is only ever one copy of the order on screen.
 *
 * Never order_item_stakes. Every stake write rolls up into
 * order_items.quantity through trg_sync_order_item_quantity, so the item row
 * reports it; subscribing to stakes as well would only wake the same refetch
 * twice. This is also why the publication carries just these two tables
 * (docs/technical/backend.md).
 */

/**
 * A stake write lands as several changes in quick succession -- the item's
 * quantity, then its unit_price if a tier boundary moved -- and a tiered
 * reprice touches every sibling stake. One refetch should serve the lot.
 */
const DEBOUNCE_MS = 150;

export function useOrderRealtime(orderId: number) {
  const queryClient = useQueryClient();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefetch = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        queryClient.invalidateQueries({ queryKey: orderQueryKey(orderId) });
      }, DEBOUNCE_MS);
    };

    // Each event is named rather than '*': the order row only ever changes
    // status, and an item is only ever added or updated -- nothing in this
    // milestone deletes either, so a delete arriving would mean something
    // happened that this screen has no story for.
    const channel = supabase
      .channel(`order:${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `order_id=eq.${orderId}`,
        },
        scheduleRefetch,
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "order_items",
          filter: `order_id=eq.${orderId}`,
        },
        scheduleRefetch,
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "order_items",
          filter: `order_id=eq.${orderId}`,
        },
        scheduleRefetch,
      )
      .subscribe((status) => {
        // Changes made between the screen mounting and the socket being ready
        // are never replayed, so the moment it is ready is the moment to ask
        // what was missed.
        if (status === "SUBSCRIBED") scheduleRefetch();
      });

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [orderId, queryClient]);
}

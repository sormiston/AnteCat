import { effectiveOrderStatus } from "@/domain/deadlines";
import type { Order } from "@/features/orders/api";
import type { Database } from "@/lib/database.types";
import { useEffect, useState } from "react";

type OrderStatus = Database["public"]["Enums"]["order_status"];

/** setTimeout stores its delay in a signed 32-bit int and fires at once past it. */
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

/**
 * The order's status as the screen should draw it, flipping to 'closed' the
 * instant the deadline passes rather than when close_lapsed_orders gets to it.
 *
 * One timer set to the exact distance to the deadline, not a ticking clock: the
 * value only ever changes once, and a per-second tick this high in the tree
 * would re-render the whole item list every second to say the same thing.
 * DeadlineCountdown keeps its own tick, because a countdown really does change
 * every second.
 *
 * The clock is held in state and passed to effectiveOrderStatus rather than
 * read inside it. Reading the time during render would make this hook impure,
 * and the React Compiler is on -- it would memoize the status against a
 * deadline that never changes and the flip would never arrive.
 *
 * A deadline further out than a timer can hold is left unscheduled -- nothing
 * stays mounted for twenty-five days, and the scheduled close arriving over
 * Realtime is the backstop in any case. Same for a device asleep past the
 * deadline: the timer fires late, the socket does not.
 */
export function useEffectiveOrderStatus(
  order: Order | undefined,
): OrderStatus | undefined {
  const status = order?.status;
  const deadlineAt = order?.deadline_at;
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (status !== "open" || !deadlineAt) return;

    const msLeft = new Date(deadlineAt).getTime() - Date.now();
    if (msLeft > MAX_TIMEOUT_MS) return;

    // Floored at zero rather than skipped when the deadline is already behind
    // us, so a deadline that moves under a mounted screen is re-read on the
    // next tick instead of leaving this holding the clock it started with.
    // +1 so the timer cannot land a hair before the instant it waits for,
    // which would re-read the same 'open' and then never try again.
    const timer = setTimeout(() => setNow(new Date()), Math.max(0, msLeft) + 1);
    return () => clearTimeout(timer);
  }, [status, deadlineAt]);

  if (!status || !deadlineAt) return undefined;
  return effectiveOrderStatus(status, deadlineAt, now);
}

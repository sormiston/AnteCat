import { Tag } from "@/components/shared/Tag";
import type { Database } from "@/lib/database.types";

type OrderStatus = Database["public"]["Enums"]["order_status"];

// Said from the member's side of the table: what they can do, not what the
// column holds.
const LABELS: Record<OrderStatus, string> = {
  open: "Taking stakes",
  closed: "Closed",
  executed: "Bought",
};

export function OrderStatusBadge({
  status,
  onBand = false,
}: {
  status: OrderStatus;
  /** True where this sits on the dark header band and needs its own contrast. */
  onBand?: boolean;
}) {
  return (
    <Tag
      label={LABELS[status]}
      tone={onBand ? "onTable" : status === "open" ? "table" : "dusk"}
    />
  );
}

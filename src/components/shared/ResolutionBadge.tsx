import { Tag, type TagTone } from "@/components/shared/Tag";
import type { OrderItemResolution } from "@/domain/resolution";

// An item resolves on its own terms, whatever the order is doing (the
// order_item_resolution view). "Open" is the quiet default and gets no tag at
// all -- a tag on every card would say nothing.
const RESOLVED: Record<
  Exclude<OrderItemResolution, "open">,
  { label: string; tone: TagTone }
> = {
  succeeded: { label: "Pack complete", tone: "table" },
  maxed_out: { label: "Fully taken", tone: "table" },
};

export function ResolutionBadge({
  resolution,
}: {
  resolution: OrderItemResolution;
}) {
  if (resolution === "open") return null;
  const { label, tone } = RESOLVED[resolution];
  return <Tag label={label} tone={tone} />;
}

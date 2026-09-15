import { resolveOrderItem } from "@/domain/resolution";
import { describe, expect, it } from "vitest";

// These cases are the contract between this function and the
// order_item_resolution view. If one changes, both change.
describe("resolveOrderItem", () => {
  it("succeeds a bundle the instant it fills", () => {
    expect(
      resolveOrderItem({
        pricingType: "threshold_bundle",
        quantity: 6,
        thresholdQty: 6,
      }),
    ).toBe("succeeded");
  });

  it("leaves a part-filled bundle open", () => {
    expect(
      resolveOrderItem({
        pricingType: "threshold_bundle",
        quantity: 5,
        thresholdQty: 6,
      }),
    ).toBe("open");
  });

  it("leaves a bundle with no threshold config open", () => {
    expect(
      resolveOrderItem({ pricingType: "threshold_bundle", quantity: 4 }),
    ).toBe("open");
  });

  it("never reads a bundle as maxed_out, whatever max_quantity says", () => {
    // max_quantity belongs to tiered items. A bundle's ceiling is its pack.
    expect(
      resolveOrderItem({
        pricingType: "threshold_bundle",
        quantity: 9,
        thresholdQty: 10,
        maxQuantity: 9,
      }),
    ).toBe("open");
  });

  it("maxes out a tiered item the instant it hits its cap", () => {
    expect(
      resolveOrderItem({ pricingType: "tiered", quantity: 20, maxQuantity: 20 }),
    ).toBe("maxed_out");
  });

  it("stays maxed_out if quantity somehow sits above a lowered cap", () => {
    expect(
      resolveOrderItem({ pricingType: "tiered", quantity: 25, maxQuantity: 20 }),
    ).toBe("maxed_out");
  });

  it("leaves an uncapped tiered item open however large it grows", () => {
    expect(
      resolveOrderItem({ pricingType: "tiered", quantity: 999, maxQuantity: null }),
    ).toBe("open");
  });

  it("leaves an empty item open", () => {
    expect(
      resolveOrderItem({
        pricingType: "threshold_bundle",
        quantity: 0,
        thresholdQty: 6,
      }),
    ).toBe("open");
    expect(
      resolveOrderItem({ pricingType: "tiered", quantity: 0, maxQuantity: 20 }),
    ).toBe("open");
  });
});

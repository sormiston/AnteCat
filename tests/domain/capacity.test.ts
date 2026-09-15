import { capacityFraction, capacityRemaining } from "@/domain/capacity";
import { describe, expect, it } from "vitest";

describe("capacityRemaining", () => {
  it("counts a bundle down toward its pack size", () => {
    expect(capacityRemaining("threshold_bundle", 0, 6)).toBe(6);
    expect(capacityRemaining("threshold_bundle", 5, 6)).toBe(1);
  });

  it("reaches zero exactly when the pack fills", () => {
    expect(capacityRemaining("threshold_bundle", 6, 6)).toBe(0);
  });

  it("counts a tiered item down toward its own max_quantity", () => {
    expect(capacityRemaining("tiered", 3, 2500)).toBe(2497);
  });

  it("reports no cap for a tiered item with max_quantity null", () => {
    expect(capacityRemaining("tiered", 40, null)).toBeNull();
  });

  it("reports no cap for a bundle with no threshold config", () => {
    // Same reasoning as resolution.ts: the rule it would be measured against
    // is missing, so there is no number to give.
    expect(capacityRemaining("threshold_bundle", 2, null)).toBeNull();
    expect(capacityRemaining("threshold_bundle", 2, 0)).toBeNull();
  });

  it("never goes negative when an admin lowers a cap under what is committed", () => {
    // max_quantity is editable during the open window, so quantity can end up
    // above it. "-3 left" is not a thing to show anyone.
    expect(capacityRemaining("tiered", 12, 9)).toBe(0);
  });
});

describe("capacityFraction", () => {
  it("measures how full a pack is", () => {
    expect(capacityFraction("threshold_bundle", 3, 6)).toBe(0.5);
    expect(capacityFraction("threshold_bundle", 0, 6)).toBe(0);
    expect(capacityFraction("threshold_bundle", 6, 6)).toBe(1);
  });

  it("has no fraction to draw without a cap", () => {
    expect(capacityFraction("tiered", 40, null)).toBeNull();
  });

  it("clamps at full rather than overflowing its own meter", () => {
    expect(capacityFraction("tiered", 12, 9)).toBe(1);
  });
});

import {
  bundleUnitIdealPrice,
  formatEuroCents,
  nextTierBreak,
  tierPriceForQuantity,
  type PriceTier,
} from "@/domain/pricing";
import { describe, expect, it } from "vitest";

// The seeded ladder (supabase/seed.sql), deliberately out of qty_floor order:
// PostgREST returns embedded rows in no guaranteed order, so the lookup has to
// find the covering tier rather than trust the array's shape.
const TIERS: PriceTier[] = [
  { qtyFloor: 5, unitPrice: 2150 },
  { qtyFloor: 0, unitPrice: 2499 },
  { qtyFloor: 10, unitPrice: 1800 },
];

describe("tierPriceForQuantity", () => {
  it("takes the baseline tier at zero, where an item with no stakes sits", () => {
    expect(tierPriceForQuantity(TIERS, 0)).toBe(2499);
  });

  it("holds the current tier right up to the next breakpoint", () => {
    expect(tierPriceForQuantity(TIERS, 4)).toBe(2499);
  });

  it("switches exactly at a breakpoint, not one past it", () => {
    expect(tierPriceForQuantity(TIERS, 5)).toBe(2150);
    expect(tierPriceForQuantity(TIERS, 10)).toBe(1800);
  });

  it("holds the cheapest tier above the whole ladder", () => {
    expect(tierPriceForQuantity(TIERS, 1000)).toBe(1800);
  });

  it("reports no covering tier rather than throwing, where the SQL raises", () => {
    // A ladder that starts above 0 makes an empty item unpriceable --
    // sync_tiered_unit_price rejects the write; a render path says nothing.
    expect(tierPriceForQuantity([{ qtyFloor: 5, unitPrice: 2150 }], 0)).toBeNull();
    expect(tierPriceForQuantity([], 12)).toBeNull();
  });
});

describe("nextTierBreak", () => {
  it("costs the next break from where the item stands", () => {
    expect(nextTierBreak(TIERS, 3)).toEqual({
      tier: { qtyFloor: 5, unitPrice: 2150 },
      unitsAway: 2,
    });
  });

  it("looks past the tier just reached, to the one after it", () => {
    expect(nextTierBreak(TIERS, 5)).toEqual({
      tier: { qtyFloor: 10, unitPrice: 1800 },
      unitsAway: 5,
    });
  });

  it("has nothing left to promise on the cheapest tier", () => {
    expect(nextTierBreak(TIERS, 10)).toBeNull();
    expect(nextTierBreak(TIERS, 40)).toBeNull();
  });

  it("skips a break that saves nothing", () => {
    const flat: PriceTier[] = [
      { qtyFloor: 0, unitPrice: 2499 },
      { qtyFloor: 5, unitPrice: 2499 },
      { qtyFloor: 8, unitPrice: 2000 },
    ];
    expect(nextTierBreak(flat, 1)?.tier.qtyFloor).toBe(8);
  });
});

describe("bundleUnitIdealPrice", () => {
  it("floors the division, exactly as trg_init_order_item_unit_price does", () => {
    // 5000/6 is 833.33 -- 833 x 6 is 4998, two cents short of the pack. That
    // gap is apportion_bundle_stakes's to close at order close, not this
    // function's to hide.
    expect(bundleUnitIdealPrice(5000, 6)).toBe(833);
  });

  it("divides evenly where it can", () => {
    expect(bundleUnitIdealPrice(5000, 5)).toBe(1000);
  });

  it("has no price for a pack of nothing", () => {
    expect(bundleUnitIdealPrice(5000, 0)).toBeNull();
  });
});

describe("formatEuroCents", () => {
  it("writes whole and part euros", () => {
    expect(formatEuroCents(5000)).toBe("€50.00");
    expect(formatEuroCents(833)).toBe("€8.33");
    expect(formatEuroCents(7)).toBe("€0.07");
    expect(formatEuroCents(0)).toBe("€0.00");
  });

  it("groups thousands", () => {
    expect(formatEuroCents(123456)).toBe("€1,234.56");
    expect(formatEuroCents(100000000)).toBe("€1,000,000.00");
  });

  it("keeps a negative readable, for a ledger that ever shows one", () => {
    expect(formatEuroCents(-250)).toBe("-€2.50");
  });
});

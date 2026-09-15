import { projectStake, stakeHeadroom } from "@/domain/stakes";
import type { PriceTier } from "@/domain/pricing";
import { describe, expect, it } from "vitest";

// The seeded ladder (supabase/seed.sql): 0-4 at 24.99, 5-9 at 21.50, 10+ at 18.00.
const TIERS: PriceTier[] = [
  { qtyFloor: 0, unitPrice: 2499 },
  { qtyFloor: 5, unitPrice: 2150 },
  { qtyFloor: 10, unitPrice: 1800 },
];

const BUNDLE = { thresholdQty: 6, bundlePriceCents: 5000 };

describe("projectStake, tiered", () => {
  const tiered = {
    pricingType: "tiered" as const,
    tiers: TIERS,
    bundle: null,
  };

  it("quotes the price the item would sit at, not the one it sits at now", () => {
    // 3 units in, none of them the viewer's. Taking 2 lands the item on 5.
    expect(
      projectStake({ ...tiered, itemQuantity: 3, committedQty: 0, draftQty: 2 }),
    ).toMatchObject({
      unitPriceCents: 2150,
      amountCents: 4300,
      itemQuantity: 5,
      unlocksCheaperTier: true,
    });
  });

  it("does not claim a saving when the draft stays on the same tier", () => {
    expect(
      projectStake({ ...tiered, itemQuantity: 3, committedQty: 0, draftQty: 1 }),
    ).toMatchObject({
      unitPriceCents: 2499,
      amountCents: 2499,
      unlocksCheaperTier: false,
    });
  });

  it("replaces the viewer's own committed units rather than adding to them", () => {
    // Of the 5 units in, 2 are the viewer's. Moving 2 -> 3 makes the item 6.
    expect(
      projectStake({ ...tiered, itemQuantity: 5, committedQty: 2, draftQty: 3 }),
    ).toMatchObject({ itemQuantity: 6, unitPriceCents: 2150 });
  });

  it("prices a withdrawal at what the item falls back to", () => {
    // The viewer's 2 units are what hold the item on the 5+ tier; leaving
    // drops it to 3, and the quote reflects that rather than today's price.
    expect(
      projectStake({ ...tiered, itemQuantity: 5, committedQty: 2, draftQty: 0 }),
    ).toMatchObject({
      itemQuantity: 3,
      unitPriceCents: 2499,
      amountCents: 0,
      unlocksCheaperTier: false,
    });
  });

  it("reports no price where the SQL would raise, instead of guessing one", () => {
    expect(
      projectStake({
        pricingType: "tiered",
        tiers: [{ qtyFloor: 5, unitPrice: 2150 }],
        bundle: null,
        itemQuantity: 0,
        committedQty: 0,
        draftQty: 1,
      }),
    ).toMatchObject({ unitPriceCents: null, amountCents: null });
  });
});

describe("projectStake, threshold_bundle", () => {
  const bundled = {
    pricingType: "threshold_bundle" as const,
    tiers: [],
    bundle: BUNDLE,
  };

  it("quotes the floored per-unit share, the same figure the insert trigger derives", () => {
    expect(
      projectStake({ ...bundled, itemQuantity: 5, committedQty: 0, draftQty: 1 }),
    ).toMatchObject({ unitPriceCents: 833, amountCents: 833, itemQuantity: 6 });
  });

  it("never reports a tier unlock -- a bundle has no ladder to fall down", () => {
    expect(
      projectStake({ ...bundled, itemQuantity: 5, committedQty: 0, draftQty: 1 })
        .unlocksCheaperTier,
    ).toBe(false);
  });

  it("has no price to quote when the pack has no threshold configured", () => {
    expect(
      projectStake({
        ...bundled,
        bundle: null,
        itemQuantity: 0,
        committedQty: 0,
        draftQty: 2,
      }),
    ).toMatchObject({ unitPriceCents: null, amountCents: null });
  });
});

describe("stakeHeadroom", () => {
  it("is uncapped where the item is", () => {
    expect(stakeHeadroom(null, 400, 12)).toBeNull();
  });

  it("counts the viewer's own units toward their ceiling, not against it", () => {
    // 5 of 6 taken, 2 of them theirs: they may hold up to 3.
    expect(stakeHeadroom(6, 5, 2)).toBe(3);
  });

  it("lets a newcomer take only what is spare", () => {
    expect(stakeHeadroom(6, 5, 0)).toBe(1);
  });

  it("lets the last member to fill a pack still adjust their own share", () => {
    expect(stakeHeadroom(6, 6, 2)).toBe(2);
  });

  it("holds a stake that a lowered cap has already overshot, rather than going negative", () => {
    // The admin cut max_quantity to 4 with 10 already committed, 3 of them
    // the viewer's. They keep their 3 and cannot add.
    expect(stakeHeadroom(4, 10, 3)).toBe(3);
  });
});

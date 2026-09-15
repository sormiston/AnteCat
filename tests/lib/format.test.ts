import { groupDigits, memberLabel, unitCount } from "@/lib/format";
import { describe, expect, it } from "vitest";

describe("groupDigits", () => {
  it("separates thousands and leaves smaller numbers alone", () => {
    expect(groupDigits(2500)).toBe("2,500");
    expect(groupDigits(999)).toBe("999");
    expect(groupDigits(1234567)).toBe("1,234,567");
  });
});

describe("unitCount", () => {
  it("agrees with itself on one", () => {
    expect(unitCount(1)).toBe("1 unit");
    expect(unitCount(0)).toBe("0 units");
    expect(unitCount(2500)).toBe("2,500 units");
  });
});

describe("memberLabel", () => {
  it("names a member by the part of their address that is theirs", () => {
    expect(memberLabel("member4@example.test")).toBe("member4");
    expect(memberLabel("admin@example.test")).toBe("admin");
  });

  it("keeps something readable when there is no address to cut", () => {
    expect(memberLabel(null)).toBe("A member");
    expect(memberLabel("")).toBe("A member");
    expect(memberLabel("nobody")).toBe("nobody");
  });
});

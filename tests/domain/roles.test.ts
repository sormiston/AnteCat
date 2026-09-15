import {
  isAdminOfSyndicate,
  isMemberOfSyndicate,
  roleFor,
  type Membership,
} from "@/domain/roles";
import { describe, expect, it } from "vitest";

const ADMIN = "a1111111-1111-1111-1111-111111111111";
const MEMBER = "a2222222-2222-2222-2222-222222222222";

const asAdmin: Membership = {
  syndicateId: 1,
  userId: ADMIN,
  adminUserId: ADMIN,
};
const asMember: Membership = {
  syndicateId: 1,
  userId: MEMBER,
  adminUserId: ADMIN,
};

describe("roleFor", () => {
  it("reads the syndicate's own admin as admin", () => {
    expect(roleFor([asAdmin], 1)).toBe("admin");
  });

  it("reads everyone else as a member", () => {
    expect(roleFor([asMember], 1)).toBe("member");
  });

  it("has no role for a syndicate the viewer does not belong to", () => {
    expect(roleFor([asMember], 2)).toBeNull();
    expect(roleFor([], 1)).toBeNull();
  });

  it("resolves per syndicate, not per person", () => {
    // Admin of one syndicate, an ordinary member of another. Today's schema
    // allows one membership each, but role has always been a per-syndicate
    // question and a picker must not have to relearn that.
    const memberships: Membership[] = [
      { syndicateId: 1, userId: MEMBER, adminUserId: ADMIN },
      { syndicateId: 2, userId: MEMBER, adminUserId: MEMBER },
    ];
    expect(roleFor(memberships, 1)).toBe("member");
    expect(roleFor(memberships, 2)).toBe("admin");
  });
});

describe("isAdminOfSyndicate", () => {
  it("gates the close and execute actions on the syndicate's admin", () => {
    expect(isAdminOfSyndicate([asAdmin], 1)).toBe(true);
    expect(isAdminOfSyndicate([asMember], 1)).toBe(false);
  });

  it("is false for a non-member, never null", () => {
    expect(isAdminOfSyndicate([], 1)).toBe(false);
  });
});

describe("isMemberOfSyndicate", () => {
  it("separates 'not the admin' from 'not in this syndicate at all'", () => {
    expect(isMemberOfSyndicate([asMember], 1)).toBe(true);
    expect(isMemberOfSyndicate([asMember], 2)).toBe(false);
  });
});

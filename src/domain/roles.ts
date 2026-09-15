// The one place "what is this person to this syndicate" is decided, even
// though exactly one syndicate exists today (SPEC.md's Component Inventory).
// A syndicate picker later reads more memberships; it does not change this.
//
// Role is derived, not stored: syndicates.admin_user_id names the single admin
// (docs/technical/backend.md), so a membership row plus that id is the whole
// input. Nothing here is a security boundary -- the database has no RLS, and
// an admin-gated control is a UX affordance until it does.

export type SyndicateRole = "admin" | "member";

export type Membership = {
  syndicateId: number;
  /** The member this row belongs to -- the signed-in viewer, in every current caller. */
  userId: string;
  /** syndicates.admin_user_id for that syndicate. */
  adminUserId: string;
};

/** Null when the viewer is not a member of that syndicate at all. */
export function roleFor(
  memberships: Membership[],
  syndicateId: number,
): SyndicateRole | null {
  const membership = memberships.find((m) => m.syndicateId === syndicateId);
  if (!membership) return null;
  return membership.userId === membership.adminUserId ? "admin" : "member";
}

export function isAdminOfSyndicate(
  memberships: Membership[],
  syndicateId: number,
): boolean {
  return roleFor(memberships, syndicateId) === "admin";
}

export function isMemberOfSyndicate(
  memberships: Membership[],
  syndicateId: number,
): boolean {
  return roleFor(memberships, syndicateId) !== null;
}

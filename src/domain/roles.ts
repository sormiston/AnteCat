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

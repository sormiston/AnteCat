import type { Membership } from "@/domain/roles";
import { memberLabel } from "@/lib/format";
import { toDataError } from "@/lib/queryErrors";
import { supabase } from "@/lib/supabase";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

/**
 * The viewer's own memberships, shaped for domain/roles.ts.
 *
 * A member belongs to exactly one syndicate today, but this returns a list --
 * role has always been a per-syndicate question, and a picker should be a
 * screen reading this hook, not a rewrite of how role is resolved.
 */
export function membershipsQueryKey(userId: string) {
  return ["memberships", userId] as const;
}

export async function fetchMemberships(userId: string): Promise<Membership[]> {
  const { data, error } = await supabase
    .from("syndicate_members")
    .select("syndicate_id, user_id, syndicates ( admin_user_id )")
    .eq("user_id", userId);

  if (error) throw toDataError(error, "Loading your syndicates");

  return data.map((row) => ({
    syndicateId: row.syndicate_id,
    userId: row.user_id,
    adminUserId: row.syndicates.admin_user_id,
  }));
}

export function useMemberships(
  userId: string | undefined,
): UseQueryResult<Membership[]> {
  return useQuery({
    queryKey: membershipsQueryKey(userId ?? "anonymous"),
    queryFn: () => fetchMemberships(userId!),
    enabled: Boolean(userId),
    // Membership does not change during a demo, and both order screens ask for
    // it -- refetching it on every focus would be noise.
    staleTime: 5 * 60_000,
  });
}

/** One member of a syndicate, as the app can name them. */
export type SyndicateMember = { userId: string; label: string };

export function syndicateMembersQueryKey(syndicateId: number) {
  return ["syndicateMembers", syndicateId] as const;
}

export async function fetchSyndicateMembers(
  syndicateId: number,
): Promise<SyndicateMember[]> {
  const { data, error } = await supabase
    .from("syndicate_member_profiles")
    .select("user_id, email")
    .eq("syndicate_id", syndicateId);

  if (error) throw toDataError(error, "Loading who's in this syndicate");

  return data
    .filter((row): row is typeof row & { user_id: string } => row.user_id !== null)
    .map((row) => ({ userId: row.user_id, label: memberLabel(row.email) }));
}

/**
 * Who the stakes on an item belong to.
 *
 * A second query key, and deliberately so: order_item_stakes.user_id points at
 * auth.users, which PostgREST will not embed, so identity cannot ride along on
 * the ['order', orderId] request the way products and pricing config do. It is
 * also the opposite kind of data -- a roster that does not move while an order
 * is open, so Realtime has no reason to touch it.
 */
export function useSyndicateMembers(
  syndicateId: number | undefined,
): UseQueryResult<SyndicateMember[]> {
  return useQuery({
    queryKey: syndicateMembersQueryKey(syndicateId ?? -1),
    queryFn: () => fetchSyndicateMembers(syndicateId!),
    enabled: syndicateId !== undefined,
    staleTime: 5 * 60_000,
  });
}

/** Look up one member's label, falling back to something readable. */
export function labelFor(
  members: SyndicateMember[] | undefined,
  userId: string,
): string {
  return members?.find((m) => m.userId === userId)?.label ?? "A member";
}

import type { Membership } from "@/domain/roles";
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

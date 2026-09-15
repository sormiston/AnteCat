import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Why a read failed, in the only terms the screens act on.
 *
 * `notAuthorized` and `network` are kept apart deliberately: on web both the
 * list and detail URLs are typable and bookmarkable, so a stranger landing on
 * one needs to be told they can't see it -- not handed a retry button that
 * will never work (SPEC.md's Component Inventory).
 */
export type FailureKind = "network" | "notAuthorized" | "notFound" | "unknown";

export class DataError extends Error {
  readonly kind: FailureKind;

  constructor(kind: FailureKind, message: string, cause?: unknown) {
    super(message);
    this.name = "DataError";
    this.kind = kind;
    this.cause = cause;
  }
}

export function classifyPostgrestError(error: PostgrestError): FailureKind {
  // 42501 is Postgres's insufficient_privilege, which is what a missing grant
  // looks like from here. PGRST301 is an expired or unusable JWT.
  if (error.code === "42501" || error.code === "PGRST301") return "notAuthorized";
  // .single() with no row.
  if (error.code === "PGRST116") return "notFound";
  // supabase-js surfaces a failed fetch as an error with no Postgres code.
  if (!error.code && /fetch|network|timeout/i.test(error.message)) return "network";
  return "unknown";
}

/** Turns a PostgREST result into something React Query can carry as an error. */
export function toDataError(error: PostgrestError, context: string): DataError {
  return new DataError(
    classifyPostgrestError(error),
    `${context}: ${error.message}`,
    error,
  );
}

export function failureKindOf(error: unknown): FailureKind {
  return error instanceof DataError ? error.kind : "unknown";
}

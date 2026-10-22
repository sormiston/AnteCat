/**
 * Thousands separators. The locale tag is pinned rather than left to the
 * device: the demo runs on three devices, and a shared ledger where two people
 * read a different figure is worse than one that ignores their locale.
 */
export function groupDigits(value: number): string {
  return Math.trunc(Math.abs(value)).toLocaleString("en-US");
}

/** "1 unit" / "12 units", grouped. */
export function unitCount(value: number): string {
  return `${groupDigits(value)} ${value === 1 ? "unit" : "units"}`;
}

/**
 * A member's name, as the app has one. `syndicate_member_profiles` exposes an
 * email and nothing else, so the local part is the whole of it -- five copies
 * of the same domain on one screen is noise, not identity.
 *
 * Falls back to the raw string rather than an empty label, so a profile the
 * view didn't cover still reads as somebody.
 */
export function memberLabel(email: string | null | undefined): string {
  const local = email?.split("@")[0]?.trim();
  return local || email?.trim() || "A member";
}

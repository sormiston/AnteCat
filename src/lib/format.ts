/**
 * Thousands separators, hand-rolled.
 *
 * Not toLocaleString or Intl: the demo runs on three devices with three ICU
 * builds, and a shared ledger where two people read a different figure is
 * worse than one that ignores their locale.
 */
export function groupDigits(value: number): string {
  return Math.trunc(Math.abs(value))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** "1 unit" / "12 units", grouped. */
export function unitCount(value: number): string {
  return `${groupDigits(value)} ${value === 1 ? "unit" : "units"}`;
}

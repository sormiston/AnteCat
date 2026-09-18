// Deadline math for the countdown. Pure and now-injectable, so tests drive it
// with a fixed clock rather than fake timers plus real Date.

export type TimeRemaining = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** Whole milliseconds left, floored at 0 once the deadline has passed. */
  totalMs: number;
  expired: boolean;
};

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function timeRemaining(
  deadlineAt: string | Date,
  now: Date = new Date(),
): TimeRemaining {
  const remaining = Math.max(
    0,
    new Date(deadlineAt).getTime() - now.getTime(),
  );

  return {
    days: Math.floor(remaining / DAY),
    hours: Math.floor((remaining % DAY) / HOUR),
    minutes: Math.floor((remaining % HOUR) / MINUTE),
    seconds: Math.floor((remaining % MINUTE) / SECOND),
    totalMs: remaining,
    expired: remaining === 0,
  };
}

export function isPastDeadline(
  deadlineAt: string | Date,
  now: Date = new Date(),
): boolean {
  return now.getTime() >= new Date(deadlineAt).getTime();
}

/**
 * How much of the order's window is gone, 0 to 1 -- the countdown's rule is
 * drawn from this, so a deadline four days out doesn't look identical to one
 * four minutes out.
 *
 * A window that opened at or after its own deadline reads as fully elapsed;
 * the orders table's CHECK makes that unreachable, but the caller still gets a
 * number it can draw.
 */
export function windowElapsedFraction(
  openedAt: string | Date,
  deadlineAt: string | Date,
  now: Date = new Date(),
): number {
  const opened = new Date(openedAt).getTime();
  const deadline = new Date(deadlineAt).getTime();
  if (deadline <= opened) return 1;
  const elapsed = (now.getTime() - opened) / (deadline - opened);
  return Math.min(1, Math.max(0, elapsed));
}

/**
 * The countdown, split so the days can be set smaller than the clock rather
 * than sitting behind a full monospace space.
 *
 * The clock always runs to seconds, so the figure is visibly moving whatever
 * the distance to the deadline -- a still number reads as a stale screen.
 * Above a day the hours are padded, so the clock keeps one width as it counts
 * down rather than shifting under the days beside it.
 */
export function timeRemainingParts(remaining: TimeRemaining): {
  days: string | null;
  clock: string;
} {
  const pad = (value: number) => value.toString().padStart(2, "0");
  const seconds = pad(remaining.seconds);

  if (remaining.expired) return { days: null, clock: "0:00:00" };
  if (remaining.days > 0) {
    return {
      days: `${remaining.days}d`,
      clock: `${pad(remaining.hours)}:${pad(remaining.minutes)}:${seconds}`,
    };
  }
  return {
    days: null,
    clock: `${remaining.hours}:${pad(remaining.minutes)}:${seconds}`,
  };
}

/** The same countdown as one string, for a screen reader and for tests. */
export function formatTimeRemaining(remaining: TimeRemaining): string {
  const { days, clock } = timeRemainingParts(remaining);
  return days ? `${days} ${clock}` : clock;
}

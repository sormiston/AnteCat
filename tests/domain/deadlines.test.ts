import {
  formatTimeRemaining,
  timeRemainingParts,
  isPastDeadline,
  timeRemaining,
  windowElapsedFraction,
} from "@/domain/deadlines";
import { describe, expect, it } from "vitest";

const NOW = new Date("2026-09-15T12:00:00.000Z");
const at = (iso: string) => new Date(iso);

describe("timeRemaining", () => {
  it("breaks the gap into days, hours, minutes and seconds", () => {
    const remaining = timeRemaining(at("2026-09-18T14:30:45.000Z"), NOW);
    expect(remaining).toMatchObject({
      days: 3,
      hours: 2,
      minutes: 30,
      seconds: 45,
      expired: false,
    });
  });

  it("floors at zero once the deadline has passed, rather than counting up", () => {
    const remaining = timeRemaining(at("2026-09-15T11:59:00.000Z"), NOW);
    expect(remaining.totalMs).toBe(0);
    expect(remaining.expired).toBe(true);
    expect(remaining).toMatchObject({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });

  it("treats the deadline's own instant as expired", () => {
    expect(timeRemaining(NOW, NOW).expired).toBe(true);
  });

  it("reads an ISO string, which is what PostgREST returns", () => {
    expect(timeRemaining("2026-09-15T12:01:30.000Z", NOW)).toMatchObject({
      minutes: 1,
      seconds: 30,
    });
  });
});

describe("isPastDeadline", () => {
  it("is false while time is left and true from the deadline on", () => {
    expect(isPastDeadline(at("2026-09-15T12:00:01.000Z"), NOW)).toBe(false);
    expect(isPastDeadline(NOW, NOW)).toBe(true);
    expect(isPastDeadline(at("2026-09-15T11:59:59.000Z"), NOW)).toBe(true);
  });
});

describe("windowElapsedFraction", () => {
  const opened = at("2026-09-15T00:00:00.000Z");

  it("measures how much of the window is gone", () => {
    expect(windowElapsedFraction(opened, at("2026-09-16T00:00:00.000Z"), NOW)).toBe(0.5);
  });

  it("is 0 at the open and 1 at the deadline", () => {
    const deadline = at("2026-09-16T00:00:00.000Z");
    expect(windowElapsedFraction(opened, deadline, opened)).toBe(0);
    expect(windowElapsedFraction(opened, deadline, deadline)).toBe(1);
  });

  it("stays clamped past the deadline", () => {
    expect(
      windowElapsedFraction(opened, at("2026-09-15T06:00:00.000Z"), NOW),
    ).toBe(1);
  });

  it("reads a window that opened at its own deadline as fully elapsed", () => {
    expect(windowElapsedFraction(opened, opened, NOW)).toBe(1);
  });
});

describe("formatTimeRemaining", () => {
  it("counts seconds above a day, with the hours padded", () => {
    expect(
      formatTimeRemaining(timeRemaining(at("2026-09-18T14:30:45.000Z"), NOW)),
    ).toBe("3d 02:30:45");
  });

  it("drops the days part inside the last day", () => {
    expect(
      formatTimeRemaining(timeRemaining(at("2026-09-15T14:05:09.000Z"), NOW)),
    ).toBe("2:05:09");
  });

  it("reads zero once expired", () => {
    expect(formatTimeRemaining(timeRemaining(NOW, NOW))).toBe("0:00:00");
  });
});

describe("timeRemainingParts", () => {
  it("splits the days off, so they can be set apart from the clock", () => {
    expect(
      timeRemainingParts(timeRemaining(at("2026-09-18T14:30:45.000Z"), NOW)),
    ).toEqual({ days: "3d", clock: "02:30:45" });
  });

  it("has no days part inside the last day", () => {
    expect(
      timeRemainingParts(timeRemaining(at("2026-09-15T14:05:09.000Z"), NOW)),
    ).toEqual({ days: null, clock: "2:05:09" });
  });

  it("reads zero once expired", () => {
    expect(timeRemainingParts(timeRemaining(NOW, NOW))).toEqual({
      days: null,
      clock: "0:00:00",
    });
  });
});

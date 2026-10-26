import { describe, it, expect } from "vitest";
import {
  formatDueCaption,
  formatDueDate,
  isOverdue,
  parseDateInput,
  todayKey,
} from "../../utils/time";

const pad = (n: number) => String(n).padStart(2, "0");
const expectedKey = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

describe("todayKey", () => {
  it("returns the local calendar day in YYYY-MM-DD format", () => {
    const now = new Date(2026, 4, 9, 15, 30, 0);
    expect(todayKey(now)).toBe("2026-05-09");
  });

  it("matches the local day for an arbitrary instant", () => {
    const instant = new Date(2024, 0, 2, 3, 4, 5);
    expect(todayKey(instant)).toBe(expectedKey(instant));
  });

  it("rolls over exactly at local midnight (boundary lock)", () => {
    const justBefore = new Date(2026, 7, 20, 23, 59, 59, 999);
    const justAfter = new Date(2026, 7, 21, 0, 0, 0, 0);
    expect(todayKey(justBefore)).toBe("2026-08-20");
    expect(todayKey(justAfter)).toBe("2026-08-21");
    expect(todayKey(justAfter)).not.toBe(todayKey(justBefore));
  });

  it("stays on the local day across the UTC-midnight instant", () => {
    // At 2026-01-01T00:30:00Z a UTC-day key would already read 2026-01-01,
    // while local time west of UTC is still Dec 31. todayKey must follow the
    // device calendar, not UTC, so missions/XP roll over at local midnight.
    const utcMidnightPlus30m = new Date("2026-01-01T00:30:00.000Z");
    expect(todayKey(utcMidnightPlus30m)).toBe(expectedKey(utcMidnightPlus30m));
    expect(todayKey(utcMidnightPlus30m)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("defaults to now and is stable within the same day", () => {
    expect(todayKey()).toBe(expectedKey(new Date()));
  });
});

const DATE_ONLY_TODAY = "2026-09-28";
const localTodayNoon = () => new Date(2026, 8, 28, 12, 2, 0);
const expectedDueLabel = () =>
  new Date(2026, 8, 28).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

describe("parseDateInput date-only local calendar", () => {
  it("parses YYYY-MM-DD as local midnight, not UTC", () => {
    const parsed = parseDateInput(DATE_ONLY_TODAY);
    expect(parsed).not.toBeNull();
    expect(parsed!.getFullYear()).toBe(2026);
    expect(parsed!.getMonth()).toBe(8);
    expect(parsed!.getDate()).toBe(28);
    expect(parsed!.getHours()).toBe(0);
    expect(parsed!.getMinutes()).toBe(0);
    expect(parsed!.getTime()).toBe(new Date(2026, 8, 28).getTime());
  });

  it("does not follow Date.parse UTC midnight for date-only strings", () => {
    const parsed = parseDateInput(DATE_ONLY_TODAY)!;
    const utcParsed = new Date(DATE_ONLY_TODAY);
    expect(utcParsed.toISOString()).toBe("2026-09-28T00:00:00.000Z");
    // East of UTC (and after local midnight on UTC hosts) the UTC-parsed
    // instant is already in the past at 12:02 local — the trap that made
    // Today tasks look overdue.
    expect(utcParsed.getTime() < localTodayNoon().getTime()).toBe(true);
    expect(parsed.getHours()).toBe(0);
    expect(parsed.getDate()).toBe(28);
  });
});

describe("formatDueDate / formatDueCaption", () => {
  it("formats a date-only due date without a time", () => {
    const label = formatDueDate(DATE_ONLY_TODAY);
    expect(label).toBe(expectedDueLabel());
    expect(label).not.toMatch(/\d{1,2}:\d{2}/);
    expect(label).not.toMatch(/\b(?:AM|PM)\b/i);
    expect(formatDueCaption(DATE_ONLY_TODAY)).toBe(`Due ${expectedDueLabel()}`);
    expect(formatDueCaption(undefined)).toBe("No due date");
    expect(formatDueCaption(null)).toBe("No due date");
    expect(formatDueCaption("")).toBe("No due date");
  });
});

describe("isOverdue local-date semantics", () => {
  it("does not mark a date-only due of today as overdue at 12:02 local", () => {
    const now = localTodayNoon();
    expect(isOverdue(DATE_ONLY_TODAY, now)).toBe(false);
    expect(isOverdue(todayKey(now), now)).toBe(false);
  });

  it("marks a date-only due of yesterday as overdue", () => {
    expect(isOverdue("2026-09-27", localTodayNoon())).toBe(true);
  });

  it("treats missing or invalid due dates as not overdue", () => {
    expect(isOverdue(undefined, localTodayNoon())).toBe(false);
    expect(isOverdue(null, localTodayNoon())).toBe(false);
    expect(isOverdue("", localTodayNoon())).toBe(false);
    expect(isOverdue("not-a-date", localTodayNoon())).toBe(false);
  });
});

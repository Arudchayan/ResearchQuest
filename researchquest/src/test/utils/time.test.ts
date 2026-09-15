import { describe, it, expect } from "vitest";
import { todayKey } from "../../utils/time";

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

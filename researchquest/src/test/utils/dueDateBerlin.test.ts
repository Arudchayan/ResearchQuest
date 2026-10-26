import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const DATE_ONLY = "2026-09-28";
const BERLIN = "Europe/Berlin";
const TIME_MODULE = pathToFileURL(
  path.join(process.cwd(), "src/utils/time.ts"),
).href;

/**
 * Vitest workers on CI are UTC. Date-only `new Date("YYYY-MM-DD")` is UTC
 * midnight, which is 02:00 CEST — the live wine bug. Spawn children with
 * TZ=Europe/Berlin so the offset-sensitive claims actually observe CEST.
 */
function berlinEval(args: string[], script: string): Record<string, unknown> {
  const result = spawnSync(process.execPath, [...args, script], {
    env: { ...process.env, TZ: BERLIN },
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "berlin eval failed");
  }
  return JSON.parse(result.stdout) as Record<string, unknown>;
}

describe("date-only due dates under Europe/Berlin", () => {
  it("UTC-parses YYYY-MM-DD as 02:00 CEST, the display trap", () => {
    const out = berlinEval(["-e"], `
      const utc = new Date("${DATE_ONLY}");
      const now = new Date(2026, 8, 28, 12, 2, 0);
      process.stdout.write(JSON.stringify({
        hours: utc.getHours(),
        minutes: utc.getMinutes(),
        iso: utc.toISOString(),
        localeWithTime: utc.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        naiveOverdue: utc.getTime() < now.getTime(),
      }));
    `);
    expect(out.hours).toBe(2);
    expect(out.minutes).toBe(0);
    expect(out.iso).toBe("2026-09-28T00:00:00.000Z");
    expect(String(out.localeWithTime)).toMatch(/2:00/);
    expect(out.naiveOverdue).toBe(true);
  });

  it("formats without time and today is not overdue under Europe/Berlin", () => {
    const out = berlinEval(
      [
        "--experimental-strip-types",
        "--no-warnings=ExperimentalWarning",
        "--input-type=module",
        "-e",
      ],
      `
        import { formatDueCaption, formatDueDate, isOverdue, parseDateInput } from ${JSON.stringify(TIME_MODULE)};
        const DATE_ONLY = "${DATE_ONLY}";
        const parsed = parseDateInput(DATE_ONLY);
        const now = new Date(2026, 8, 28, 12, 2, 0);
        process.stdout.write(JSON.stringify({
          hours: parsed?.getHours() ?? null,
          utcHours: new Date(DATE_ONLY).getHours(),
          formatted: formatDueDate(DATE_ONLY),
          caption: formatDueCaption(DATE_ONLY),
          overdueToday: isOverdue(DATE_ONLY, now),
          overdueYesterday: isOverdue("2026-09-27", now),
        }));
      `,
    );
    expect(out.hours).toBe(0);
    expect(out.utcHours).toBe(2);
    expect(String(out.formatted)).not.toMatch(/\d{1,2}:\d{2}/);
    expect(out.caption).toBe(`Due ${out.formatted}`);
    expect(String(out.caption)).not.toMatch(/02:00|2:00 AM/i);
    expect(out.overdueToday).toBe(false);
    expect(out.overdueYesterday).toBe(true);
  });
});

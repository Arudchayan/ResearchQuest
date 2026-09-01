import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("static first-run gate (index.html)", () => {
  const html = readFileSync(
    resolve(__dirname, "../../../index.html"),
    "utf8",
  );

  it("ships an immediately clickable Use demo workspace control before React", () => {
    expect(html).toContain('id="rq-static-gate"');
    expect(html).toContain("Use demo workspace");
    expect(html).toContain('data-rq-demo-entry');
    expect(html).toContain('href="/topics/topic-ai-agents"');
    expect(html).toContain("One topic. Three papers. A note. A focus session.");
    expect(html).toContain("Scholar Access");
  });

  it("arms rq_demo_mode before the module bundle so first click is not lost", () => {
    expect(html).toContain('localStorage.setItem(KEY, "1")');
    expect(html).toContain("[data-rq-demo-entry]");
    // Sync script must appear before the deferred module entry.
    const armIdx = html.indexOf("rq_demo_mode");
    const moduleIdx = html.indexOf('type="module"');
    expect(armIdx).toBeGreaterThan(-1);
    expect(moduleIdx).toBeGreaterThan(armIdx);
  });
});

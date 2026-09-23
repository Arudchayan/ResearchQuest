import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const files = [
  "supabase/functions/api/_shared/cors.ts",
  "supabase/functions/fetch-paper/index.ts",
  "supabase/functions/deep-research/index.ts",
  "supabase/functions/create-admin-user/index.ts",
];

describe("production CORS fallback origins", () => {
    it.each(files)("includes both live app origins in %s", (rel) => {
    const text = readFileSync(resolve(__dirname, "../../../..", rel), "utf8");
    expect(text).toContain("https://research-quest-wine.vercel.app");
    expect(text).toContain("https://rq.arudchayan.com");
  });
});

describe("create-admin-user retirement", () => {
  it("is a 410 stub with JWT verification on", () => {
    const fn = readFileSync(
      resolve(__dirname, "../../../..", "supabase/functions/create-admin-user/index.ts"),
      "utf8",
    );
    const config = readFileSync(
      resolve(__dirname, "../../../..", "supabase/config.toml"),
      "utf8",
    );
    expect(fn).toContain("status: 410");
    expect(fn).toContain("GONE");
    expect(config).toMatch(/\[functions\.create-admin-user\][\s\S]*verify_jwt = true/);
  });

  it("keeps the 410 stub in the deploy runbook", () => {
    const runbook = readFileSync(
      resolve(__dirname, "../../../..", "docs/deploy-runbook.md"),
      "utf8",
    );
    expect(runbook).toContain("create-admin-user");
    expect(runbook).toContain("410");
    expect(runbook).toContain("supabase functions deploy create-admin-user");
  });
});

describe("hygiene", () => {
  it("does not ship unused react-router types without a runtime router", () => {
    const pkg = readFileSync(
      resolve(__dirname, "../../../package.json"),
      "utf8",
    );
    expect(pkg).not.toContain("react-router-dom");
  });
});

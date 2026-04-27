import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";

describe("Supabase client configuration", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock("../../lib/supabase");
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not throw during import when Supabase env vars are missing", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");

    await expect(import("../../lib/supabase")).resolves.toMatchObject({
      hasSupabaseConfig: false,
    });
  });

  it("reports configured state when Supabase env vars are present", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");

    const module = await import("../../lib/supabase");

    expect(module.hasSupabaseConfig).toBe(true);
    await expect(module.supabase.auth.getSession()).resolves.toHaveProperty(
      "data",
    );
  });
});

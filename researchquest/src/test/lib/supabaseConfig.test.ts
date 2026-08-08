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
    vi.stubEnv("VITE_DEMO_MODE", "");

    await expect(import("../../lib/supabase")).resolves.toMatchObject({
      hasSupabaseConfig: false,
      isDemoMode: false,
    });
  });

  it("reports configured state when Supabase env vars are present", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubEnv("VITE_DEMO_MODE", "");

    const module = await import("../../lib/supabase");

    expect(module.hasSupabaseConfig).toBe(true);
    expect(module.isDemoMode).toBe(false);
    await expect(module.supabase.auth.getSession()).resolves.toHaveProperty(
      "data",
    );
  });

  it("reports demo mode as configured without a Supabase project", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    vi.stubEnv("VITE_DEMO_MODE", "1");

    const module = await import("../../lib/supabase");

    expect(module.hasSupabaseConfig).toBe(true);
    expect(module.isDemoMode).toBe(true);
  });
});

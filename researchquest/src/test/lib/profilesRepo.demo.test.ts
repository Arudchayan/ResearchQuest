import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSupabaseClient } from "../mocks/supabase";

// Demo engine on: the RPC must never fire, the legacy update must.
vi.mock("../../lib/supabase", () => ({
  supabase: mockSupabaseClient,
  isDemoMode: true,
}));

import { writeXpUpdate } from "../../lib/repos/profilesRepo";

function chainable(resolved: unknown) {
  const builder: any = {};
  for (const method of ["select", "eq", "insert", "update", "upsert"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.single = vi.fn(() => Promise.resolve(resolved));
  builder.then = (onFulfilled?: (value: any) => any) =>
    Promise.resolve(resolved).then(onFulfilled);
  return builder;
}

describe("profilesRepo demo-mode fallback (PR15 item 36)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves demo XP behavior: direct update, no RPC", async () => {
    const builder = chainable({ error: null });
    mockSupabaseClient.from.mockImplementation(() => builder);
    const payload = {
      total_xp: 130,
      current_level: 1,
      current_streak: 4,
    } as any;

    const result = await writeXpUpdate("demo-user", 30, payload);

    expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();
    expect(mockSupabaseClient.from).toHaveBeenCalledWith("user_profiles");
    expect(builder.update).toHaveBeenCalledWith(payload);
    expect(builder.eq).toHaveBeenCalledWith("id", "demo-user");
    expect(result).toEqual({ totalXp: 130, level: 1, streak: 4 });
  });

  it("returns null in demo mode when the direct update fails", async () => {
    mockSupabaseClient.from.mockImplementation(() =>
      chainable({ error: { message: "down" } }),
    );

    const result = await writeXpUpdate("demo-user", 30, {
      total_xp: 1,
    } as any);

    expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });
});

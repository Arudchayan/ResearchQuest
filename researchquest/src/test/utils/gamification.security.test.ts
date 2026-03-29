import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mockSupabaseClient } from "../mocks/supabase";

// Mock supabase module - MUST be before imports that use it
vi.mock("../../lib/supabase", () => ({
  supabase: mockSupabaseClient,
}));

// Import after mock
import { awardXP } from "../../utils/gamification";

describe("Gamification Security", () => {
  const consoleErrorSpy = vi
    .spyOn(console, "error")
    .mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should not log full error objects when fetching profile fails", async () => {
    // Setup mock to fail
    const errorObj = {
      message: "Database error",
      details: "Column secret_info does not exist",
      hint: "Check your schema",
      code: "42703",
    };

    // Mock the chain: from -> select -> eq -> single
    // The implementation of awardXP:
    // supabase.from('user_profiles').select('*').eq('id', userId).single()

    const singleMock = vi.fn().mockResolvedValue({
      data: null,
      error: errorObj,
    });

    const eqMock = vi.fn().mockReturnValue({ single: singleMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });

    // We need to handle the specific call in awardXP
    mockSupabaseClient.from.mockReturnValue({
      select: selectMock,
    });

    await awardXP("user-123", 10, "test_action");

    // Check calls to console.error
    // Current insecure code calls:
    // console.error('Failed to fetch user profile:', fetchError)
    // console.error('Error details:', JSON.stringify(fetchError, null, 2))

    const calls = consoleErrorSpy.mock.calls;

    // We verify that the JSON stringified error IS currently logged (proving vulnerability)
    // So if the code IS vulnerable, loggedFullJson should be true.
    // If the test expects vulnerability to be ABSENT, it should expect(loggedFullJson).toBe(false).
    // So this test failing means loggedFullJson IS true, which confirms vulnerability.

    const loggedFullJson = calls.some((args) =>
      args.some(
        (arg) =>
          typeof arg === "string" &&
          arg.includes('"details": "Column secret_info does not exist"'),
      ),
    );

    expect(loggedFullJson).toBe(false);
  });
});

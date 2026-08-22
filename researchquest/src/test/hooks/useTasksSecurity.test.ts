import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTasks } from "../../hooks/useTasks";
import { mockSupabaseClient } from "../mocks/supabase";
import { useAppStore } from "../../store/appStore";

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock gamification utils
vi.mock("../../utils/gamification", () => ({
  awardXP: vi.fn().mockResolvedValue(true),
  notifyGamificationResult: vi.fn(),
  XP_REWARDS: {
    CREATE_TASK: 10,
    COMPLETE_TASK: 20,
  },
}));

// Helper to create a complete mock builder that supports chaining
const createMockBuilder = (overrides: any = {}) => {
  const builder: any = {
    ...overrides,
    then: ((onFulfilled?: (value: any) => any) => {
      const result = { data: null, error: null };
      return Promise.resolve(result).then(onFulfilled);
    }) as any,
  };

  // Define chaining methods that return the builder itself (if not overridden)
  if (!builder.select) builder.select = vi.fn().mockReturnValue(builder);
  if (!builder.insert) builder.insert = vi.fn().mockReturnValue(builder);
  if (!builder.update) builder.update = vi.fn().mockReturnValue(builder);
  if (!builder.delete) builder.delete = vi.fn().mockReturnValue(builder);
  if (!builder.eq) builder.eq = vi.fn().mockReturnValue(builder);
  if (!builder.order) builder.order = vi.fn().mockReturnValue(builder);
  if (!builder.single)
    builder.single = vi.fn().mockResolvedValue({ data: null, error: null });
  if (!builder.limit) builder.limit = vi.fn().mockReturnValue(builder);

  return builder;
};

describe("useTasks Security", () => {
  const originalConsoleError = console.error;
  let consoleErrorSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("Information Leakage", () => {
    it("should NOT log full error object with JSON.stringify on create task failure", async () => {
      const sensitiveError = {
        message: "Something went wrong",
        details: "Internal database error",
        hint: "Check your privilege",
        code: "23505",
        schema: "public",
        table: "tasks",
        column: "id", // Sensitive info!
      };

      mockSupabaseClient.from.mockImplementation((tableName: string) => {
        if (tableName === "tasks") {
          return createMockBuilder({
            select: vi.fn().mockReturnValue(
              createMockBuilder({
                eq: vi.fn().mockReturnValue(
                  createMockBuilder({
                    order: vi.fn().mockResolvedValue({ data: [], error: null }),
                  }),
                ),
              }),
            ),
            insert: vi.fn().mockReturnValue(
              createMockBuilder({
                select: vi.fn().mockReturnValue(
                  createMockBuilder({
                    single: vi
                      .fn()
                      .mockResolvedValue({ data: null, error: sensitiveError }),
                  }),
                ),
              }),
            ),
          });
        }
        return createMockBuilder();
      });

      const { result } = renderHook(() => useTasks("test-user-id"));

      await act(async () => {
        await result.current.createTask({ title: "New Task" });
      });

      // Check all calls to console.error
      const calls = consoleErrorSpy.mock.calls.flat();

      // We are looking for JSON.stringify(sensitiveError, null, 2)
      // The current vulnerable code does exactly this.
      // So if the vulnerability exists, we should find a string containing the sensitive keys formatted as JSON.
      const stringifiedLeak = JSON.stringify(sensitiveError, null, 2);

      // We expect the vulnerability to be present currently, so this assertion
      // is written to FAIL if the code is vulnerable (i.e. if it DOES find the leak).
      // Wait, standard test practice is to assert the CORRECT behavior.
      // The correct behavior is that it should NOT contain the leak.

      const foundLeak = calls.some(
        (arg: any) => typeof arg === "string" && arg.includes('"column": "id"'),
      );

      // This expectation will fail on the current codebase, demonstrating the vulnerability.
      expect(foundLeak).toBe(false);
    });
  });
});

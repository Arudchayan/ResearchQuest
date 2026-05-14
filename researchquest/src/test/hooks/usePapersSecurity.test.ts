import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePapers } from "../../hooks/usePapers";
import { mockSupabaseClient } from "../mocks/supabase";
import { useAppStore } from "../../store/appStore";
import { toast } from "sonner";
import { Paper } from "../../types/database";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
  },
}));

// Provide gamification mock to avoid importing it later and breaking
vi.mock("../../utils/gamification", () => ({
  awardXP: vi.fn().mockResolvedValue(true),
  XP_REWARDS: { CREATE_PAPER: 5 },
}));

const createMockBuilder = (overrides: any = {}) => {
  const builder: any = {
    ...overrides,
    then: ((onFulfilled?: (value: any) => any) => {
      const result = { data: null, error: null };
      return Promise.resolve(result).then(onFulfilled);
    }) as any,
  };

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

describe("usePapers Security", () => {
  const mockPaper: Paper = {
    id: "paper-1",
    user_id: "test-user-id",
    title: "Original Title",
    authors: [],
    abstract: null,
    source_url: null,
    doi: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    year: null,
    citation_count: null,
    reading_status: "To Read",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({ papers: [] });
  });

  describe("URL Validation", () => {
    it("should strip invalid source_url (javascript:) in createPaper", async () => {
      let capturedPayload: any;

      mockSupabaseClient.from.mockImplementation((tableName: string) => {
        if (tableName === "papers") {
          return createMockBuilder({
            insert: vi.fn().mockImplementation((payload) => {
              capturedPayload = payload;
              return createMockBuilder({
                select: vi.fn().mockReturnValue(
                  createMockBuilder({
                    single: vi.fn().mockResolvedValue({
                      data: { ...mockPaper, id: "new-paper-id" },
                      error: null,
                    }),
                  }),
                ),
              });
            }),
          });
        }
        return createMockBuilder();
      });

      const { result } = renderHook(() => usePapers("test-user-id"));

      await act(async () => {
        await result.current.createPaper({
          title: "Test Paper",
          source_url: "javascript:alert(1)", // 🚨 Malicious URL
        });
      });

      expect(capturedPayload).toBeDefined();
      expect(capturedPayload.source_url).toBeUndefined();
    });

    it("should allow valid source_url (https:) in createPaper", async () => {
      let capturedPayload: any;

      mockSupabaseClient.from.mockImplementation((tableName: string) => {
        if (tableName === "papers") {
          return createMockBuilder({
            insert: vi.fn().mockImplementation((payload) => {
              capturedPayload = payload;
              return createMockBuilder({
                select: vi.fn().mockReturnValue(
                  createMockBuilder({
                    single: vi.fn().mockResolvedValue({
                      data: { ...mockPaper, id: "new-paper-id" },
                      error: null,
                    }),
                  }),
                ),
              });
            }),
          });
        }
        return createMockBuilder();
      });

      const { result } = renderHook(() => usePapers("test-user-id"));

      await act(async () => {
        await result.current.createPaper({
          title: "Test Paper",
          source_url: "https://example.com/paper.pdf", // Valid URL
        });
      });

      expect(capturedPayload).toBeDefined();
      expect(capturedPayload.source_url).toBe("https://example.com/paper.pdf");
    });

    it("should strip invalid source_url in updatePaper", async () => {
      let capturedUpdates: any[] = [];
      const initialPaper = { ...mockPaper, id: "paper-1" };

      useAppStore.setState({ papers: [initialPaper] });

      mockSupabaseClient.from.mockImplementation((tableName: string) => {
        if (tableName === "papers") {
          return createMockBuilder({
            update: vi.fn().mockImplementation((updates) => {
              capturedUpdates.push(updates);
              return createMockBuilder({
                select: vi.fn().mockReturnValue(
                  createMockBuilder({
                    single: vi
                      .fn()
                      .mockResolvedValue({
                        data: { ...initialPaper, ...updates },
                        error: null,
                      }),
                  }),
                ),
              });
            }),
          });
        }
        return createMockBuilder();
      });

      const { result } = renderHook(() => usePapers("test-user-id"));

      await act(async () => {
        await result.current.updatePaper("paper-1", {
          source_url: "javascript:alert(1)", // 🚨 Malicious Update
        });
      });

      expect(capturedUpdates.length).toBe(1);
      expect(capturedUpdates[0].source_url).toBeUndefined();
    });
  });

  describe("Authorization", () => {
    it("should include user_id check in deletePaper", async () => {
      // Create a mock builder that returns itself on 'eq' so we can capture chained calls
      const mockBuilder = createMockBuilder();
      // We need to spy on the 'eq' method of this specific builder instance
      const eqSpy = vi.spyOn(mockBuilder, "eq");
      // Ensure it returns itself for chaining
      eqSpy.mockReturnValue(mockBuilder);

      mockSupabaseClient.from.mockImplementation((tableName: string) => {
        if (tableName === "papers") {
          return createMockBuilder({
            delete: vi.fn().mockReturnValue(mockBuilder),
          });
        }
        return createMockBuilder();
      });

      const { result } = renderHook(() => usePapers("test-user-id"));

      const paperToDelete = { ...mockPaper, id: "paper-to-delete" };
      useAppStore.setState({ papers: [paperToDelete] });

      await act(async () => {
        await result.current.deletePaper("paper-to-delete");
      });

      const calls = eqSpy.mock.calls;

      const hasIdCheck = calls.some(
        (call) => call[0] === "id" && call[1] === "paper-to-delete",
      );
      const hasUserIdCheck = calls.some(
        (call) => call[0] === "user_id" && call[1] === "test-user-id",
      );

      expect(hasIdCheck).toBe(true);
      expect(hasUserIdCheck).toBe(true);
    });

    it("should include user_id check in updatePaper", async () => {
      const mockBuilder = createMockBuilder();
      const eqSpy = vi.spyOn(mockBuilder, "eq");
      eqSpy.mockReturnValue(mockBuilder);

      // Mock the end of the chain
      mockBuilder.select.mockReturnValue(
        createMockBuilder({
          single: vi
            .fn()
            .mockResolvedValue({
              data: { ...mockPaper, id: "paper-to-update" },
              error: null,
            }),
        }),
      );

      mockSupabaseClient.from.mockImplementation((tableName: string) => {
        if (tableName === "papers") {
          return createMockBuilder({
            update: vi.fn().mockReturnValue(mockBuilder),
          });
        }
        return createMockBuilder();
      });

      const { result } = renderHook(() => usePapers("test-user-id"));

      const paperToUpdate = { ...mockPaper, id: "paper-to-update" };
      useAppStore.setState({ papers: [paperToUpdate] });

      await act(async () => {
        await result.current.updatePaper("paper-to-update", {
          title: "New Title",
        });
      });

      const calls = eqSpy.mock.calls;

      const hasIdCheck = calls.some(
        (call) => call[0] === "id" && call[1] === "paper-to-update",
      );
      const hasUserIdCheck = calls.some(
        (call) => call[0] === "user_id" && call[1] === "test-user-id",
      );

      expect(hasIdCheck).toBe(true);
      expect(hasUserIdCheck).toBe(true);
    });
  });

  describe("Information Leakage", () => {
    it("should NOT leak database details in createPaper error toast", async () => {
      const sensitiveDetails = "Key (email)=(test@example.com) already exists.";
      const sensitiveHint = "Check constraint violation on table users_secure";

      mockSupabaseClient.from.mockImplementation((tableName: string) => {
        if (tableName === "papers") {
          return createMockBuilder({
            insert: vi.fn().mockReturnValue(
              createMockBuilder({
                select: vi.fn().mockReturnValue(
                  createMockBuilder({
                    single: vi.fn().mockResolvedValue({
                      data: null,
                      error: {
                        details: sensitiveDetails,
                        hint: sensitiveHint,
                        code: "23505",
                        // No message to force fallback logic check
                      },
                    }),
                  }),
                ),
              }),
            ),
          });
        }
        return createMockBuilder();
      });

      const { result } = renderHook(() => usePapers("test-user-id"));

      await act(async () => {
        await result.current.createPaper({ title: "Test Paper" });
      });

      // Expect specific error code message, NOT details/hint
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("Error 23505"),
        expect.anything(),
      );
      expect(toast.error).not.toHaveBeenCalledWith(
        expect.stringContaining(sensitiveDetails),
        expect.anything(),
      );
      expect(toast.error).not.toHaveBeenCalledWith(
        expect.stringContaining(sensitiveHint),
        expect.anything(),
      );
    });

    it("should NOT leak full error object to console.error when awardXP fails", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const sensitiveError = {
        message: "Award XP Failed",
        internalStack: "at /secret/path/to/server.ts:50:1",
      };

      // Import the mocked module to override implementation
      const gamification = await import("../../utils/gamification");
      vi.mocked(gamification.awardXP).mockRejectedValue(sensitiveError);

      mockSupabaseClient.from.mockImplementation((tableName: string) => {
        if (tableName === "papers") {
          return createMockBuilder({
            insert: vi.fn().mockReturnValue(
              createMockBuilder({
                select: vi.fn().mockReturnValue(
                  createMockBuilder({
                    single: vi.fn().mockResolvedValue({
                      data: { ...mockPaper, id: "new-paper-id" },
                      error: null,
                    }),
                  }),
                ),
              }),
            ),
          });
        }
        if (tableName === "user_profiles") {
          return createMockBuilder({
            select: vi.fn().mockReturnValue(
              createMockBuilder({
                eq: vi.fn().mockReturnValue(
                  createMockBuilder({
                    single: vi
                      .fn()
                      .mockResolvedValue({
                        data: { auto_create_reading_tasks: false },
                        error: null,
                      }),
                  }),
                ),
              }),
            ),
          });
        }
        return createMockBuilder();
      });

      const { result } = renderHook(() => usePapers("test-user-id"));

      await act(async () => {
        await result.current.createPaper({ title: "Test Paper" });
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      const errorString = typeof sensitiveError === "object" && "message" in sensitiveError ? String(sensitiveError.message) : undefined;
      const expectedMessage = errorString ? `[RQ] Failed to award XP: ${errorString}` : `[RQ] Failed to award XP`;

      expect(consoleSpy).toHaveBeenCalledWith(expectedMessage);
    });
  });

  describe("Input Validation", () => {
    it("should reject titles exceeding max length in createPaper", async () => {
      const { result } = renderHook(() => usePapers("test-user-id"));
      const longTitle = "a".repeat(256);

      await act(async () => {
        const paper = await result.current.createPaper({ title: longTitle });
        expect(paper).toBeNull();
      });

      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("title exceeds"),
      );
    });

    it("should reject abstracts exceeding max length in createPaper", async () => {
      const { result } = renderHook(() => usePapers("test-user-id"));
      const longAbstract = "a".repeat(5001);

      await act(async () => {
        const paper = await result.current.createPaper({
          title: "Valid Title",
          abstract: longAbstract,
        });
        expect(paper).toBeNull();
      });

      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("abstract exceeds"),
      );
    });

    it("should reject titles exceeding max length in updatePaper", async () => {
      const initialPaper = { ...mockPaper, id: "paper-1" };
      useAppStore.setState({ papers: [initialPaper] });

      const { result } = renderHook(() => usePapers("test-user-id"));
      const longTitle = "a".repeat(256);

      await act(async () => {
        const success = await result.current.updatePaper("paper-1", {
          title: longTitle,
        });
        expect(success).toBe(false);
      });

      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("title exceeds"),
      );
    });

    it("should reject abstracts exceeding max length in updatePaper", async () => {
      const initialPaper = { ...mockPaper, id: "paper-1" };
      useAppStore.setState({ papers: [initialPaper] });

      const { result } = renderHook(() => usePapers("test-user-id"));
      const longAbstract = "a".repeat(5001);

      await act(async () => {
        const success = await result.current.updatePaper("paper-1", {
          abstract: longAbstract,
        });
        expect(success).toBe(false);
      });

      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("abstract exceeds"),
      );
    });
  });
});

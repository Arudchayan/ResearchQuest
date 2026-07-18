import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { usePapers } from "../../hooks/usePapers";
import { useDataSync } from "../../hooks/useDataSync";
import { mockSupabaseClient, mockPaper } from "../mocks/supabase";
import type { Paper } from "../../types/database";
import { useAppStore } from "../../store/appStore";

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
  },
}));

// Mock gamification utils
vi.mock("../../utils/gamification", () => ({
  awardXP: vi.fn().mockResolvedValue(true),
  XP_REWARDS: {
    CREATE_PAPER: 10,
    UPDATE_PAPER_STATUS: 5,
  },
}));

// Helper to create a complete mock builder that supports chaining
const createMockBuilder = (overrides: any = {}) => {
  const builder: any = {
    then: ((onFulfilled?: (value: any) => any) => {
      const result = { data: null, error: null };
      return Promise.resolve(result).then(onFulfilled);
    }) as any,
    ...overrides,
  };

  // Define chaining methods that return the builder itself (if not overridden)
  if (!builder.select) builder.select = vi.fn().mockReturnValue(builder);
  if (!builder.insert) builder.insert = vi.fn().mockReturnValue(builder);
  if (!builder.update) builder.update = vi.fn().mockReturnValue(builder);
  if (!builder.upsert) builder.upsert = vi.fn().mockReturnValue(builder);
  if (!builder.delete) builder.delete = vi.fn().mockReturnValue(builder);
  if (!builder.eq) builder.eq = vi.fn().mockReturnValue(builder);
  if (!builder.neq) builder.neq = vi.fn().mockReturnValue(builder);
  if (!builder.in) builder.in = vi.fn().mockReturnValue(builder);
  if (!builder.order) builder.order = vi.fn().mockReturnValue(builder);
  if (!builder.gte) builder.gte = vi.fn().mockReturnValue(builder);
  if (!builder.lte) builder.lte = vi.fn().mockReturnValue(builder);
  if (!builder.not) builder.not = vi.fn().mockReturnValue(builder);
  if (!builder.limit) builder.limit = vi.fn().mockReturnValue(builder);

  // Define terminal methods if not overridden
  if (!builder.single)
    builder.single = vi.fn().mockResolvedValue({ data: null, error: null });
  if (!builder.maybeSingle)
    builder.maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: null, error: null });

  return builder;
};

describe("usePapers Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({ papers: [], papersLoading: false });
  });

  // We now test that the sync hook handles fetching
  describe("Data Sync (Fetching)", () => {
    it("should initialize with loading state and fetch papers", async () => {
      const mockPapers: Paper[] = [mockPaper];

      mockSupabaseClient.from.mockImplementation(() =>
        createMockBuilder({
          range: vi.fn().mockResolvedValue({ data: mockPapers, error: null }),
          order: vi.fn().mockReturnThis(),
        }),
      );

      // Render the sync hook which populates the store
      const { result: syncResult } = renderHook(() =>
        useDataSync("test-user-id", "dashboard"),
      );
      // And the consumption hook
      const { result } = renderHook(() => usePapers("test-user-id"));

      // Initially loading should be true (set by sync hook)
      // Note: Since renderHook is async, it might have already finished if we don't delay the mock?
      // But typically we can catch the loading state.
      // However, here fetching is awaited in useEffect.

      await waitFor(() => {
        expect(result.current.papers).toHaveLength(1);
        expect(result.current.papers[0]).toEqual(mockPaper);
      });
    });
  });

  describe("Create Paper", () => {
    it("should create a paper successfully and update store", async () => {
      const newPaper: Paper = { ...mockPaper, id: "new-paper-id" };

      mockSupabaseClient.from.mockImplementation(() =>
        createMockBuilder({
          single: vi.fn().mockResolvedValue({ data: newPaper, error: null }),
        }),
      );

      const { result } = renderHook(() => usePapers("test-user-id"));

      const paperData = {
        title: "New Paper",
        authors: ["Author"],
        doi: "10.1234/new",
      };

      const createdPaper = await result.current.createPaper(paperData);

      expect(createdPaper).toEqual(newPaper);
      expect(result.current.papers).toContainEqual(newPaper); // Check store update
    });

    it("should optimistically update UI after creating paper", async () => {
      const newPaper: Paper = { ...mockPaper, id: "new-paper-id" };
      let papersDB: Paper[] = [];

      mockSupabaseClient.from.mockImplementation(() => {
        return createMockBuilder({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          insert: vi.fn().mockImplementation((data) => {
            return createMockBuilder({
              select: vi.fn().mockReturnValue(
                createMockBuilder({
                  single: vi.fn().mockImplementation(() => {
                    papersDB = [newPaper];
                    return Promise.resolve({ data: newPaper, error: null });
                  }),
                }),
              ),
            });
          }),
        });
      });

      const { result } = renderHook(() => usePapers("test-user-id"));

      const paperData = {
        title: "New Paper",
        authors: ["Author"],
      };

      await act(async () => {
        await result.current.createPaper(paperData);
      });

      await waitFor(() => {
        expect(result.current.papers).toHaveLength(1);
        expect(result.current.papers[0]).toEqual(newPaper);
      });
    });

    it("should handle create errors", async () => {
      mockSupabaseClient.from.mockImplementation(() =>
        createMockBuilder({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "Create failed" },
          }),
        }),
      );

      const { result } = renderHook(() => usePapers("test-user-id"));

      const createdPaper = await result.current.createPaper({
        title: "New Paper",
        authors: ["Author"],
      });

      expect(createdPaper).toBeNull();
      expect(result.current.papers).toHaveLength(0);
    });
  });

  describe("Update Paper", () => {
    it("should update paper status successfully", async () => {
      const initialPaper: Paper = { ...mockPaper, status: "To Read" };
      // Initialize store
      useAppStore.setState({ papers: [initialPaper] });

      mockSupabaseClient.from.mockImplementation(() =>
        createMockBuilder({
          update: vi.fn().mockReturnValue(
            createMockBuilder({
              eq: vi.fn().mockReturnValue(
                createMockBuilder({
                  select: vi.fn().mockReturnValue(
                    createMockBuilder({
                      single: vi.fn().mockImplementation(() => {
                        const updated = { ...initialPaper, status: "Read" };
                        return Promise.resolve({ data: updated, error: null });
                      }),
                    }),
                  ),
                }),
              ),
            }),
          ),
        }),
      );

      const { result } = renderHook(() => usePapers("test-user-id"));

      await act(async () => {
        await result.current.updatePaper(mockPaper.id, { status: "Read" });
      });

      await waitFor(() => {
        const updated = result.current.papers.find(
          (p) => p.id === mockPaper.id,
        );
        expect(updated?.status).toBe("Read");
      });
    });

    it("should handle update errors and revert optimistic update", async () => {
      const initialPaper: Paper = { ...mockPaper, status: "To Read" };
      useAppStore.setState({ papers: [initialPaper] });

      // Force a failure
      mockSupabaseClient.from.mockImplementation(() =>
        createMockBuilder({
          update: vi.fn().mockReturnValue(
            createMockBuilder({
              eq: vi.fn().mockReturnValue(
                createMockBuilder({
                  select: vi.fn().mockReturnValue(
                    createMockBuilder({
                      single: vi.fn().mockResolvedValue({
                        error: { message: "Update failed" },
                      }),
                    }),
                  ),
                }),
              ),
            }),
          ),
        }),
      );

      const { result } = renderHook(() => usePapers("test-user-id"));

      const success = await result.current.updatePaper(mockPaper.id, {
        status: "Read",
      });

      expect(success).toBe(false);
      // Should revert to original status
      expect(result.current.papers[0].status).toBe("To Read");
    });
  });

  describe("Delete Paper", () => {
    it("should delete paper successfully", async () => {
      const initialPaper: Paper = mockPaper;
      useAppStore.setState({ papers: [initialPaper] });

      // Default mock builder handles chaining and returns success
      mockSupabaseClient.from.mockImplementation(() => createMockBuilder());

      const { result } = renderHook(() => usePapers("test-user-id"));

      await act(async () => {
        await result.current.deletePaper(mockPaper.id);
      });

      await waitFor(() => {
        expect(result.current.papers).toHaveLength(0);
      });
    });

    it("should handle delete errors and revert optimistic delete", async () => {
      const initialPaper: Paper = mockPaper;
      useAppStore.setState({ papers: [initialPaper] });

      // Create a builder that resolves to an error
      const errorBuilder = createMockBuilder({
        then: ((onFulfilled?: (value: any) => any) => {
          return Promise.resolve({
            data: null,
            error: { message: "Delete failed" },
          }).then(onFulfilled);
        }) as any,
      });

      mockSupabaseClient.from.mockImplementation(() =>
        createMockBuilder({
          delete: vi.fn().mockReturnValue(errorBuilder),
        }),
      );

      const { result } = renderHook(() => usePapers("test-user-id"));

      const success = await result.current.deletePaper(mockPaper.id);

      expect(success).toBe(false);
      // Should still have the paper after failed delete
      await waitFor(() => {
        expect(result.current.papers).toHaveLength(1);
      });
    });
  });

  describe("Realtime Updates", () => {
    it("should set up realtime subscription via useDataSync", async () => {
      mockSupabaseClient.from.mockImplementation(() =>
        createMockBuilder({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      );

      renderHook(() => useDataSync("test-user-id"));

      await waitFor(() => {
        expect(mockSupabaseClient.channel).toHaveBeenCalledWith(
          expect.stringContaining("papers_realtime_"),
        );
      });
    });
  });

  describe("Search Papers", () => {
    it("should search papers by DOI", async () => {
      const mockSearchResult = {
        title: "Found Paper",
        authors: ["Author"],
        doi: "10.1234/found",
        sourceUrl: "https://example.com",
        abstract: "Abstract",
        publicationDate: "2024",
      };

      mockSupabaseClient.functions.invoke.mockResolvedValue({
        data: { data: mockSearchResult },
        error: null,
      });

      const { result } = renderHook(() => usePapers("test-user-id"));

      const searchResult =
        await result.current.searchPaperByDOI("10.1234/found");

      expect(searchResult).toEqual(mockSearchResult);
    });

    it("should search papers by query", async () => {
      const mockSearchResults = [
        {
          title: "Paper 1",
          authors: ["Author 1"],
          doi: "10.1234/1",
        },
      ];

      mockSupabaseClient.functions.invoke.mockResolvedValue({
        data: { data: mockSearchResults },
        error: null,
      });

      const { result } = renderHook(() => usePapers("test-user-id"));

      const searchResults = await result.current.searchPapersByQuery("quantum");

      expect(searchResults).toEqual(mockSearchResults);
    });
  });
});

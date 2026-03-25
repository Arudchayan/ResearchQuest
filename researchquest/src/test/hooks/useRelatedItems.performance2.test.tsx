import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useRelatedItems } from "../../hooks/useRelatedItems";
import { useAppStore } from "../../store/appStore";
import { supabase } from "../../lib/supabase";

vi.mock("../../lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe("useRelatedItems Local Performance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("measures hydration of related items", async () => {
    const numNotes = 20000;
    const numLinks = 2000;

    // Set up store with fake notes
    const notes = Array.from({ length: numNotes }, (_, i) => ({
      id: `note-${i}`,
      title: `Note ${i}`,
      updated_at: new Date().toISOString(),
      markdown_body: "body",
    }));
    useAppStore.setState({ notes, papers: [], ideas: [] });

    // Mock supabase to return a large list of links
    const mockFrom = supabase.from as unknown as ReturnType<typeof vi.fn>;
    mockFrom.mockImplementation((table: string) => {
      const builder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
      };

      builder.then = (onFulfilled: any) => {
        if (table === "topic_notes") {
          // the first call is to check if entity has topics
          if (builder.eq.mock.calls.length > 0) {
             return Promise.resolve({ data: [{ topic_id: "t1" }], error: null }).then(onFulfilled);
          }
          // the second call is to fetch related items
          const relatedData = Array.from({ length: numLinks }, (_, i) => ({
            note_id: `note-${numNotes - i - 1}`, // search backwards, worst case for .find()
            topic_id: "t1"
          }));
          return Promise.resolve({ data: relatedData, error: null }).then(onFulfilled);
        }
        return Promise.resolve({ data: [], error: null }).then(onFulfilled);
      };
      return builder;
    });

    const start = performance.now();

    const { result } = renderHook(() => useRelatedItems("note-x", "note", "user-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.relatedItems.length).toBeGreaterThan(0);
    });

    const end = performance.now();
    console.log(`Hydration took ${end - start}ms`);
    expect(result.current.relatedItems.length).toBe(numLinks);
  });
});

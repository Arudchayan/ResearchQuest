import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useRelatedItems } from "../../hooks/useRelatedItems";
import { supabase } from "../../lib/supabase";
import { useAppStore } from "../../store/appStore";

vi.mock("../../lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe("useRelatedItems Performance Benchmark", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      notes: [],
      papers: [],
      ideas: [],
    });
  });

  it("benchmarks relatedItems hydration", async () => {
    // Generate mock data: 30,000 papers in store, 3000 related links
    // We want to amplify the difference for O(N*M)
    const NUM_PAPERS = 30000;
    const NUM_LINKS = 3000;

    const mockPapers = Array.from({ length: NUM_PAPERS }, (_, i) => ({
      id: `paper-${i}`,
      title: `Paper ${i}`,
      updated_at: new Date().toISOString(),
      markdown_body: "body",
      user_id: "user-1",
      created_at: new Date().toISOString()
    }));

    useAppStore.setState({ papers: mockPapers as any });

    const mockFrom = supabase.from as unknown as ReturnType<typeof vi.fn>;
    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      callCount++;
      const currentCall = callCount;
      const builder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
      };

      builder.then = (onFulfilled: any) => {
        if (currentCall === 1) { // initial fetch
           return Promise.resolve({ data: [{ topic_id: "t1" }], error: null }).then(onFulfilled);
        }

        // Return matching related items
        if (table === "topic_papers") {
             const relatedData = Array.from({ length: NUM_LINKS }, (_, i) => ({
                // Intentionally fetch IDs from the end of the array to maximize the O(N) find penalty
                paper_id: `paper-${NUM_PAPERS - 1 - i}`,
                topic_id: "t1"
             }));
             return Promise.resolve({ data: relatedData, error: null }).then(onFulfilled);
        }

        return Promise.resolve({ data: [], error: null }).then(onFulfilled);
      };

      return builder;
    });

    const startTime = performance.now();

    const { result } = renderHook(() => useRelatedItems("paper-1", "paper", "user-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.relatedItems.length).toBe(NUM_LINKS);
    }, { timeout: 10000 });

    const endTime = performance.now();
    console.log(`Time taken: ${endTime - startTime}ms`);

    expect(result.current.relatedItems.length).toBe(NUM_LINKS);
  });
});

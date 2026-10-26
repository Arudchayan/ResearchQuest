import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBibTeXImport } from "../../hooks/useBibTeXImport";
import { usePapers } from "../../hooks/usePapers";
import { mockSupabaseClient, mockPaper } from "../mocks/supabase";
import { useAppStore } from "../../store/appStore";
import type { Paper } from "../../types/database";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("../../utils/gamification", () => ({
  awardXP: vi.fn().mockResolvedValue({
    xpEarned: 10,
    level: 1,
    leveledUp: false,
    streak: 1,
    achievementsEarned: [],
  }),
  notifyGamificationResult: vi.fn(),
  XP_REWARDS: {
    CREATE_PAPER: 10,
    UPDATE_PAPER_STATUS: 5,
  },
}));

function makeFile(name: string, content: string): File {
  const file = new File([content], name, { type: "application/x-bibtex" });
  Object.defineProperty(file, "text", { value: async () => content });
  return file;
}

/** Exact one-entry file from the live-wine QA repro. */
const LECUN_BIB = `@article{lecun2015deep, title={Deep learning}, author={LeCun, Yann and Bengio, Yoshua and Hinton, Geoffrey}, journal={Nature}, volume={521}, pages={436--444}, year={2015}}`;

const THREE_ENTRY_BIB = `
@article{one, title={First Paper}, author={Ada}, year={2020}}
@article{two, title={Second Paper}, author={Grace}, year={2021}}
@article{three, title={Third Paper}, author={Alan}, year={2022}}
`;

function slugId(title: string): string {
  return `imported-${title.toLowerCase().replace(/\s+/g, "-")}`;
}

/**
 * Batch insert mock that mirrors demo (and signed-in realtime): the INSERT
 * echo lands in the Zustand store before insert().select() resolves.
 */
function mockBatchInsertWithRealtimeEcho() {
  const papersBuilder: Record<string, unknown> = {};
  let latestRows: Paper[] = [];

  papersBuilder.select = vi.fn().mockReturnValue(papersBuilder);
  papersBuilder.eq = vi.fn().mockReturnValue(papersBuilder);
  papersBuilder.in = vi.fn().mockResolvedValue({ data: [], error: null });
  papersBuilder.insert = vi.fn().mockImplementation((payload: unknown) => {
    const drafts = Array.isArray(payload) ? payload : [payload];
    latestRows = drafts.map((draft) => {
      const row = draft as { title: string; authors?: string[]; user_id?: string };
      return {
        ...mockPaper,
        id: slugId(row.title),
        user_id: row.user_id ?? "test-user-id",
        title: row.title,
        authors: row.authors ?? [],
        doi: undefined,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Paper;
    });
    // Sync realtime echo — same timing as demoSupabase.emitTable on insert.
    useAppStore.setState({
      papers: [...latestRows, ...useAppStore.getState().papers],
    });
    return papersBuilder;
  });
  papersBuilder.single = vi.fn().mockResolvedValue({ data: null, error: null });
  papersBuilder.then = ((onFulfilled?: (value: unknown) => unknown) => {
    return Promise.resolve({ data: latestRows, error: null }).then(onFulfilled);
  }) as (onFulfilled?: (value: unknown) => unknown) => Promise<unknown>;

  const profileBuilder: Record<string, unknown> = {};
  profileBuilder.select = vi.fn().mockReturnValue(profileBuilder);
  profileBuilder.eq = vi.fn().mockReturnValue(profileBuilder);
  profileBuilder.single = vi.fn().mockResolvedValue({
    data: { auto_create_reading_tasks: false },
    error: null,
  });

  mockSupabaseClient.from.mockImplementation((tableName: string) => {
    if (tableName === "user_profiles") return profileBuilder;
    return papersBuilder;
  });
}

function useBibTeXImportThroughPapers() {
  const papers = usePapers("test-user-id");
  const importer = useBibTeXImport(papers.createPaper, papers.createPapers);
  return { papers, importer };
}

async function importBib(
  result: { current: ReturnType<typeof useBibTeXImportThroughPapers> },
  content: string,
) {
  await act(async () => {
    await result.current.importer.handleFileChange(makeFile("papers.bib", content));
  });
  await act(async () => {
    await result.current.importer.handleImport();
  });
}

describe("BibTeX import paper count (realtime INSERT echo)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({ papers: [], papersLoading: false });
    mockBatchInsertWithRealtimeEcho();
  });

  it("imports a 1-entry .bib as exactly one paper", async () => {
    const { result } = renderHook(() => useBibTeXImportThroughPapers());

    expect(result.current.importer.parsedEntries).toHaveLength(0);

    await importBib(result, LECUN_BIB);

    expect(result.current.importer.importStats).toEqual({
      success: 1,
      failed: 0,
    });

    const library = useAppStore.getState().papers;
    const deepLearning = library.filter((paper) => paper.title === "Deep learning");
    expect(deepLearning).toHaveLength(1);
    expect(library).toHaveLength(1);
  });

  it("imports a 3-entry .bib as exactly three papers", async () => {
    const { result } = renderHook(() => useBibTeXImportThroughPapers());

    await importBib(result, THREE_ENTRY_BIB);

    expect(result.current.importer.importStats).toEqual({
      success: 3,
      failed: 0,
    });

    const library = useAppStore.getState().papers;
    expect(library.map((paper) => paper.title).sort()).toEqual([
      "First Paper",
      "Second Paper",
      "Third Paper",
    ]);
    expect(library).toHaveLength(3);
  });
});

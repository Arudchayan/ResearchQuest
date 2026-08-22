import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSupabaseClient } from "../mocks/supabase";

// Mock supabase module - MUST be before imports that use it
vi.mock("../../lib/supabase", () => ({
  supabase: mockSupabaseClient,
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

import { importData } from "../../utils/import";
import { toast } from "sonner";

describe("importData", () => {
  const userId = "test-user-id";

  function createMockFile(content: any, name: string = "backup.json") {
    const json = JSON.stringify(content);
    const file = new File([json], name, { type: "application/json" });
    // Mock text method
    file.text = vi.fn().mockResolvedValue(json);
    return file;
  }

  const validData = {
    metadata: { appName: "ResearchQuest", version: "1.0", timestamp: "" },
    notes: [{ id: "n1", title: "Note 1" }],
    papers: [{ id: "p1", title: "Paper 1" }],
    ideas: [{ id: "i1", title: "Idea 1" }],
    topics: [{ id: "t1", name: "Topic 1" }],
    tasks: [{ id: "task1", title: "Task 1" }],
    topicNotes: [],
    topicPapers: [],
    topicIdeas: [],
  };

  const mockFile = createMockFile(validData);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should import data correctly", async () => {
    // Setup mock responses
    const upsertMock = vi.fn((rows: { id: string }[]) => ({
      select: vi.fn().mockResolvedValue({
        data: rows.map((row) => ({ id: row.id })),
        error: null,
      }),
    }));

    // We need to setup the chain: from(table).upsert(data)
    mockSupabaseClient.from.mockReturnValue({
      upsert: upsertMock,
    } as any);

    const result = await importData(mockFile, userId);

    expect(result).toEqual({ success: true, imported: 5, skipped: 0 });
    expect(mockSupabaseClient.from).toHaveBeenCalledWith("notes");
    expect(mockSupabaseClient.from).toHaveBeenCalledWith("papers");
    expect(mockSupabaseClient.from).toHaveBeenCalledWith("ideas");
    expect(mockSupabaseClient.from).toHaveBeenCalledWith("topics");
    expect(mockSupabaseClient.from).toHaveBeenCalledWith("tasks");

    expect(upsertMock).toHaveBeenCalledTimes(5);

    expect(toast.success).toHaveBeenCalled();
  });

  it("counts duplicate rows skipped by import upserts", async () => {
    const file = createMockFile({
      metadata: { appName: "ResearchQuest", version: "1.0", timestamp: "" },
      notes: [
        { id: "n1", title: "Existing Note" },
        { id: "n2", title: "New Note" },
      ],
      papers: [],
      ideas: [],
      topics: [],
      tasks: [],
      topicNotes: [],
      topicPapers: [],
      topicIdeas: [],
    });
    const upsertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: [{ id: "n2" }],
        error: null,
      }),
    });

    mockSupabaseClient.from.mockReturnValue({
      upsert: upsertMock,
    } as any);

    const result = await importData(file, userId);

    expect(result).toEqual({ success: true, imported: 1, skipped: 1 });
    expect(toast.success).toHaveBeenCalledWith(
      "Imported 1 rows; skipped 1 duplicates",
      expect.any(Object),
    );
  });

  it("should handle invalid JSON", async () => {
    const invalidFile = new File(["invalid json"], "bad.json", {
      type: "application/json",
    });
    invalidFile.text = vi.fn().mockRejectedValue(new Error("Invalid JSON")); // Or mocked to return bad json
    // But importData calls JSON.parse(await file.text()).
    // If text() returns invalid json string, JSON.parse throws.
    invalidFile.text = vi.fn().mockResolvedValue("invalid json");

    const result = await importData(invalidFile, userId);
    expect(result).toEqual({ success: false, error: "Invalid JSON file" });
    expect(toast.error).toHaveBeenCalledWith("Invalid JSON file");
  });

  it("should handle invalid metadata", async () => {
    const badMetaFile = createMockFile({
      metadata: { appName: "WrongApp", version: "1.0", timestamp: "" },
      notes: [],
      papers: [],
      ideas: [],
      topics: [],
      tasks: [],
    });

    const result = await importData(badMetaFile, userId);
    expect(result).toEqual({
      success: false,
      error: "Invalid backup file: Not a ResearchQuest backup",
    });
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("Invalid backup file"),
    );
  });

  it("rejects backup missing required notes array", async () => {
    const file = createMockFile({
      metadata: { appName: "ResearchQuest", version: "1.0", timestamp: "" },
      papers: [],
      ideas: [],
      topics: [],
      tasks: [],
    });

    const result = await importData(file, userId);
    expect(result).toEqual({
      success: false,
      error: "Missing required field: notes",
    });
    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
  });

  it("should handle supabase error", async () => {
    const upsertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "DB Error" },
      }),
    });
    mockSupabaseClient.from.mockReturnValue({
      upsert: upsertMock,
    } as any);

    const result = await importData(mockFile, userId);

    expect(result).toEqual({
      success: false,
      error: "Failed to import data. Please check the file and try again.",
    });
    expect(toast.error.mock.calls[0][0]).toContain("Failed to import data");
  });
});

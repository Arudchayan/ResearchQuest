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
    const upsertMock = vi.fn().mockResolvedValue({ error: null });

    // Build a proper mock builder chain: from(table).select("*", {...}).in("id", ids) => count, then from(table).upsert(...)
    const builder: any = { __count: 0 };
    builder.select = vi.fn().mockReturnValue(builder);
    builder.in = vi.fn().mockReturnValue(builder);
    builder.upsert = upsertMock;
    builder.then = ((onFulfilled?: (value: any) => any) => {
      return Promise.resolve({ data: null, error: null, count: builder.__count }).then(onFulfilled);
    }) as any;

    mockSupabaseClient.from.mockReturnValue(builder);

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
    const upsertMock = vi
      .fn()
      .mockResolvedValue({ error: { message: "DB Error" } });

    const builder: any = { __count: 0 };
    builder.select = vi.fn().mockReturnValue(builder);
    builder.in = vi.fn().mockReturnValue(builder);
    builder.upsert = upsertMock;
    builder.then = ((onFulfilled?: (value: any) => any) => {
      return Promise.resolve({ data: null, error: null, count: builder.__count }).then(onFulfilled);
    }) as any;

    mockSupabaseClient.from.mockReturnValue(builder);

    const result = await importData(mockFile, userId);

    expect(result).toEqual({
      success: false,
      error: "Failed to import data. Please check the file and try again.",
    });
    expect(toast.error.mock.calls[0][0]).toContain("Failed to import data");
  });

  it("should report skipped rows when duplicates exist", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });

    // Simulate all 5 rows already existing in the DB
    const builder: any = { __count: 1 };
    builder.select = vi.fn().mockReturnValue(builder);
    builder.in = vi.fn().mockReturnValue(builder);
    builder.upsert = upsertMock;
    builder.then = ((onFulfilled?: (value: any) => any) => {
      return Promise.resolve({ data: null, error: null, count: builder.__count }).then(onFulfilled);
    }) as any;

    mockSupabaseClient.from.mockReturnValue(builder);

    const result = await importData(mockFile, userId);

    // Each table had exactly 1 row, and all 1 already existed => 0 imported, 5 skipped
    expect(result).toEqual({ success: true, imported: 0, skipped: 5 });
    expect(upsertMock).toHaveBeenCalledTimes(5);
  });
});

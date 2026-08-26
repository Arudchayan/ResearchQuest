import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  vi,
  describe,
  it,
  expect,
  beforeEach,
  beforeAll,
  afterAll,
} from "vitest";
import { CommandPalette } from "../../components/layout/CommandPalette";
import { useAppStore } from "../../store/appStore";

// Mock dependencies
vi.mock("../../hooks/useNotes", () => ({
  useNotes: () => ({ notes: [] }),
}));
vi.mock("../../hooks/usePapers", () => ({
  usePapers: () => ({ papers: [] }),
}));
vi.mock("../../hooks/useIdeas", () => ({
  useIdeas: () => ({ ideas: [] }),
}));

// Mock exportData
const mockExportData = vi.fn();
vi.mock("../../utils/export", () => ({
  exportData: vi.fn(async (data: unknown) => {
    mockExportData(data);
  }),
}));

describe("CommandPalette Data & API Settings", () => {
  const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;

  beforeAll(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterAll(() => {
    window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      user: { id: "test-user" } as any,
      notes: [],
      papers: [],
      ideas: [],
      tasks: [],
      topics: {
        t1: {
          id: "t1",
          name: "Topic 1",
          user_id: "u1",
          description: "",
          created_at: "",
          updated_at: "",
          note_count: 0,
          paper_count: 0,
          idea_count: 0,
        },
      },
    });
  });

  it("renders Data & API Settings command", async () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: "k", metaKey: true });

    await waitFor(() => {
      expect(screen.getByText("Data Management...")).toBeInTheDocument();
    });
  });

  it("renders Quick Export command", async () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: "k", metaKey: true });

    await waitFor(() => {
      expect(screen.getByText("Quick Export All Data")).toBeInTheDocument();
    });
  });

  it("dispatches open-data-management event when Data & API Settings is selected", async () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: "k", metaKey: true });

    const dispatchEventSpy = vi.spyOn(document, "dispatchEvent");

    await waitFor(() => {
      const item = screen.getByText("Data Management...");
      fireEvent.click(item);
    });

    expect(dispatchEventSpy).toHaveBeenCalledWith(expect.any(CustomEvent));
    const event = dispatchEventSpy.mock.calls.find(
      (call) => (call[0] as CustomEvent).type === "open-data-management",
    );
    expect(event).toBeTruthy();
  });

  it("calls exportData with topics when Quick Export is selected", async () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: "k", metaKey: true });

    await waitFor(() => {
      const item = screen.getByText("Quick Export All Data");
      fireEvent.click(item);
    });

    await waitFor(() => {
      expect(mockExportData).toHaveBeenCalled();
    });
    const callArgs = mockExportData.mock.calls[0][0] as {
      userId: string;
      topics: { name: string }[];
      tasks: unknown[];
    };
    expect(callArgs.userId).toBe("test-user");
    expect(callArgs.topics).toHaveLength(1);
    expect(callArgs.topics[0].name).toBe("Topic 1");
    expect(Array.isArray(callArgs.tasks)).toBe(true);
  });
});

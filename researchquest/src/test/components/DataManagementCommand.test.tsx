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

// The palette has no duplicate direct-export path: export flows through the
// canonical Data Management dialog (single export model, plan item 57).

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

  it("does not render a duplicate Quick Export command", async () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: "k", metaKey: true });

    await waitFor(() => {
      expect(screen.getByText("Data Management...")).toBeInTheDocument();
    });
    expect(screen.queryByText("Quick Export All Data")).not.toBeInTheDocument();
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

  it("routes export through Data Management when its command is selected", async () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: "k", metaKey: true });

    const dispatchEventSpy = vi.spyOn(document, "dispatchEvent");

    await waitFor(() => {
      const item = screen.getByText("Data Management...");
      fireEvent.click(item);
    });

    const event = dispatchEventSpy.mock.calls.find(
      (call) => (call[0] as CustomEvent).type === "open-data-management",
    );
    expect(event).toBeTruthy();
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MobileTabBar } from "../../../components/layout/v2/MobileTabBar";
import { useAppStore } from "../../../store/appStore";

const mocks = {
  createNote: vi.fn(),
  createIdea: vi.fn(),
  createTask: vi.fn(),
};

const hookArgs: {
  useNotes?: unknown[];
  useIdeas?: unknown[];
  useTasks?: unknown[];
} = {};

vi.mock("../../../hooks/useNotes", () => ({
  useNotes: (...args: unknown[]) => {
    hookArgs.useNotes = args;
    return { createNote: mocks.createNote };
  },
}));

vi.mock("../../../hooks/useIdeas", () => ({
  useIdeas: (...args: unknown[]) => {
    hookArgs.useIdeas = args;
    return { createIdea: mocks.createIdea };
  },
}));

vi.mock("../../../hooks/useTasks", () => ({
  useTasks: (...args: unknown[]) => {
    hookArgs.useTasks = args;
    return { createTask: mocks.createTask };
  },
}));

describe("MobileTabBar (v2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createNote.mockResolvedValue({ id: "note-new", title: "Untitled" });
    mocks.createIdea.mockResolvedValue({ id: "idea-new", title: "Untitled Idea" });
    mocks.createTask.mockResolvedValue({ id: "task-new", title: "Untitled Task" });
    useAppStore.setState({
      currentView: "notes",
      isMobileSidebarOpen: false,
      setIsMobileSidebarOpen: vi.fn(),
      setSelectedNote: vi.fn(),
      setSelectedIdea: vi.fn(),
      setSelectedTask: vi.fn(),
      user: { id: "test-user" } as never,
    });
    vi.spyOn(window.history, "pushState");
  });

  const renderTabBar = () => render(<MobileTabBar />);

  it("renders Today, Tasks, Focus, Library, and a FAB", () => {
    renderTabBar();

    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(nav).toHaveClass("lg:hidden", "min-h-12", "border-t", "bg-bg-surface");
    expect(nav).toHaveClass("pb-[env(safe-area-inset-bottom)]");

    const todayLink = screen.getByText("Today").closest("a");
    expect(todayLink).toHaveAttribute("href", "/");
    const tasksLink = screen.getByText("Tasks").closest("a");
    expect(tasksLink).toHaveAttribute("href", "/tasks");
    const focusLink = screen.getByText("Focus").closest("a");
    expect(focusLink).toHaveAttribute("href", "/focus");

    expect(screen.getByRole("button", { name: "Library" })).toBeInTheDocument();
    const fab = screen.getByRole("button", { name: "Quick add" });
    expect(fab).toHaveClass("rounded-full", "bg-primary-500", "h-11", "w-11");
    expect(fab).toHaveAttribute("aria-haspopup", "dialog");
  });

  it("marks the active tab with aria-current and primary styling", () => {
    useAppStore.setState({ currentView: "tasks" });
    renderTabBar();

    const tasksLink = screen.getByText("Tasks").closest("a");
    expect(tasksLink).toHaveAttribute("aria-current", "page");
    expect(tasksLink).toHaveClass("bg-primary-50", "text-primary-500");

    const todayLink = screen.getByText("Today").closest("a");
    expect(todayLink).not.toHaveAttribute("aria-current");
    expect(todayLink).not.toHaveClass("bg-primary-50", "text-primary-500");
  });

  it("navigates on tab click and closes the mobile drawer", () => {
    renderTabBar();

    const focusLink = screen.getByText("Focus").closest("a");
    expect(focusLink).toBeInTheDocument();

    fireEvent.click(focusLink!);

    expect(useAppStore.getState().currentView).toBe("focus");
    expect(window.history.pushState).toHaveBeenCalledWith(null, "", "/focus");
    expect(useAppStore.getState().setIsMobileSidebarOpen).toHaveBeenCalledWith(
      false,
    );
  });

  it("allows default behavior when modifier keys are pressed (Ctrl+Click)", () => {
    renderTabBar();

    const tasksLink = screen.getByText("Tasks").closest("a");
    expect(tasksLink).toBeInTheDocument();

    fireEvent.click(tasksLink!, { ctrlKey: true });

    expect(useAppStore.getState().currentView).toBe("notes");
    expect(window.history.pushState).not.toHaveBeenCalled();
  });

  it("opens the library sheet and navigates to a library view", async () => {
    renderTabBar();

    fireEvent.click(screen.getByRole("button", { name: "Library" }));
    const dialog = await screen.findByRole("dialog", { name: "Library" });
    expect(dialog).toHaveAttribute("aria-modal", "true");

    fireEvent.click(screen.getByRole("button", { name: "Notes" }));
    expect(useAppStore.getState().currentView).toBe("notes");
    expect(window.history.pushState).toHaveBeenCalledWith(null, "", "/notes");
  });

  it("offers Feeds in the library sheet", async () => {
    renderTabBar();
    fireEvent.click(screen.getByRole("button", { name: "Library" }));
    await screen.findByRole("dialog", { name: "Library" });
    expect(screen.getByRole("button", { name: "Feeds" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Topics" })).toBeInTheDocument();
  });

  it("opens the quick-add sheet and focuses the first item", async () => {
    renderTabBar();

    fireEvent.click(screen.getByRole("button", { name: "Quick add" }));

    const dialog = await screen.findByRole("dialog", { name: "Quick add" });
    expect(dialog).toHaveAttribute("aria-modal", "true");

    expect(screen.getByRole("button", { name: "New Note" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New Idea" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New Task" })).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "New Note" })).toHaveFocus(),
    );
  });

  it("creates a real task from the sheet and deep-links to it, restoring FAB focus", async () => {
    renderTabBar();

    fireEvent.click(screen.getByRole("button", { name: "Quick add" }));
    await screen.findByRole("dialog", { name: "Quick add" });

    fireEvent.click(screen.getByRole("button", { name: "New Task" }));

    await waitFor(() => {
      expect(mocks.createTask).toHaveBeenCalledWith({ title: "Untitled Task" });
    });
    expect(useAppStore.getState().setSelectedTask).toHaveBeenCalledWith(
      expect.objectContaining({ id: "task-new" }),
    );
    expect(useAppStore.getState().currentView).toBe("tasks");
    expect(window.history.pushState).toHaveBeenCalledWith(
      null,
      "",
      "/tasks/task-new",
    );
    expect(
      screen.queryByRole("dialog", { name: "Quick add" }),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Quick add" })).toHaveFocus(),
    );
  });

  it("creates a real note from the sheet and deep-links to it", async () => {
    renderTabBar();

    fireEvent.click(screen.getByRole("button", { name: "Quick add" }));
    await screen.findByRole("dialog", { name: "Quick add" });

    fireEvent.click(screen.getByRole("button", { name: "New Note" }));

    await waitFor(() => {
      expect(mocks.createNote).toHaveBeenCalledWith({ markdown_body: "" });
    });
    expect(useAppStore.getState().setSelectedNote).toHaveBeenCalledWith(
      expect.objectContaining({ id: "note-new" }),
    );
    expect(useAppStore.getState().currentView).toBe("notes");
    expect(window.history.pushState).toHaveBeenCalledWith(
      null,
      "",
      "/notes/note-new",
    );
  });

  it("creates a real idea from the sheet and deep-links to it", async () => {
    renderTabBar();

    fireEvent.click(screen.getByRole("button", { name: "Quick add" }));
    await screen.findByRole("dialog", { name: "Quick add" });

    fireEvent.click(screen.getByRole("button", { name: "New Idea" }));

    await waitFor(() => {
      expect(mocks.createIdea).toHaveBeenCalledWith({ title: "Untitled Idea" });
    });
    expect(useAppStore.getState().setSelectedIdea).toHaveBeenCalledWith(
      expect.objectContaining({ id: "idea-new" }),
    );
    expect(useAppStore.getState().currentView).toBe("ideas");
    expect(window.history.pushState).toHaveBeenCalledWith(
      null,
      "",
      "/ideas/idea-new",
    );
  });

  it("wires entity hooks with the current user (tasks as non-owner)", () => {
    renderTabBar();

    expect(hookArgs.useNotes?.[0]).toBe("test-user");
    expect(hookArgs.useIdeas?.[0]).toBe("test-user");
    expect(hookArgs.useTasks?.[0]).toBe("test-user");
    expect(hookArgs.useTasks?.[1]).toEqual({ owner: false });
  });

  it("closes the sheet without selecting or navigating when creation fails", async () => {
    mocks.createTask.mockResolvedValueOnce(null);
    renderTabBar();

    fireEvent.click(screen.getByRole("button", { name: "Quick add" }));
    await screen.findByRole("dialog", { name: "Quick add" });

    fireEvent.click(screen.getByRole("button", { name: "New Task" }));

    await waitFor(() => {
      expect(mocks.createTask).toHaveBeenCalledWith({ title: "Untitled Task" });
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Quick add" }),
      ).not.toBeInTheDocument();
    });
    expect(useAppStore.getState().setSelectedTask).not.toHaveBeenCalled();
    expect(useAppStore.getState().currentView).toBe("notes");
    expect(window.history.pushState).not.toHaveBeenCalled();
  });

  it("closes the sheet with Escape and restores FAB focus", async () => {
    renderTabBar();

    fireEvent.click(screen.getByRole("button", { name: "Quick add" }));
    await screen.findByRole("dialog", { name: "Quick add" });

    fireEvent.keyDown(document, { key: "Escape" });

    expect(
      screen.queryByRole("dialog", { name: "Quick add" }),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Quick add" })).toHaveFocus(),
    );
  });

  it("closes the sheet when the overlay is clicked", async () => {
    renderTabBar();

    fireEvent.click(screen.getByRole("button", { name: "Quick add" }));
    await screen.findByRole("dialog", { name: "Quick add" });

    const overlay = document.querySelector(".bg-overlay");
    expect(overlay).toBeInTheDocument();
    fireEvent.click(overlay!);

    expect(
      screen.queryByRole("dialog", { name: "Quick add" }),
    ).not.toBeInTheDocument();
  });

  it("makes the tab bar inert when the mobile drawer is open", () => {
    useAppStore.setState({ isMobileSidebarOpen: true });
    renderTabBar();

    expect(screen.getByRole("navigation", { name: "Primary" })).toHaveAttribute(
      "inert",
    );
  });

  it("makes the tab bar inert while the quick-add sheet is open", async () => {
    renderTabBar();

    fireEvent.click(screen.getByRole("button", { name: "Quick add" }));
    await screen.findByRole("dialog", { name: "Quick add" });

    expect(screen.getByRole("navigation", { name: "Primary" })).toHaveAttribute(
      "inert",
    );
  });
});

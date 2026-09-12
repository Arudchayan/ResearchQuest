import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { AppShell } from "../../../components/layout/v2/AppShell";
import { useAppStore } from "../../../store/appStore";
import { TooltipProvider } from "../../../components/ui/tooltip";

// Mock dependencies
vi.mock("../../../components/layout/v2/Sidebar", () => ({
  Sidebar: () => <div data-testid="sidebar">Sidebar</div>,
}));
vi.mock("../../../components/layout/RightSidebar", () => ({
  RightSidebar: () => <div data-testid="right-sidebar">RightSidebar</div>,
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  Menu: () => <svg data-testid="icon-menu" />,
  X: () => <svg data-testid="icon-x" />,
  Minimize2: () => <svg data-testid="icon-minimize" />,
  PanelRightClose: () => <svg data-testid="icon-panel-close" />,
  PanelRightOpen: () => <svg data-testid="icon-panel-open" />,
  Search: () => <svg data-testid="icon-search" />,
  FileText: () => <svg data-testid="icon-file-text" />,
  BookOpen: () => <svg data-testid="icon-book-open" />,
  Lightbulb: () => <svg data-testid="icon-lightbulb" />,
  CheckSquare: () => <svg data-testid="icon-check-square" />,
  Plus: () => <svg data-testid="icon-plus" />,
}));

describe("AppShell Zen Mode", () => {
  const renderAppShell = () => {
    return render(
      <TooltipProvider>
        <AppShell>Content</AppShell>
      </TooltipProvider>
    );
  };

  beforeEach(() => {
    useAppStore.setState({
      isZenMode: false,
      isMobileSidebarOpen: false,
      isRightSidebarOpen: true,
    });
  });

  it("renders sidebars by default", () => {
    renderAppShell();
    expect(screen.getAllByTestId("sidebar")).toHaveLength(1);
    expect(screen.getByTestId("right-sidebar")).toBeInTheDocument();
    expect(screen.queryByTestId("icon-minimize")).not.toBeInTheDocument();
  });

  it("hides sidebars when Zen Mode is active", () => {
    useAppStore.setState({ isZenMode: true });
    renderAppShell();

    expect(screen.queryByTestId("sidebar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("right-sidebar")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Exit Zen Mode/)).toBeInTheDocument();
  });

  it("exits Zen Mode when exit button is clicked", () => {
    useAppStore.setState({ isZenMode: true });
    renderAppShell();

    const exitButton = screen.getByLabelText(/Exit Zen Mode/);
    fireEvent.click(exitButton);

    expect(useAppStore.getState().isZenMode).toBe(false);
  });

  it("toggles Zen Mode with keyboard shortcut (Ctrl+Shift+F)", () => {
    renderAppShell();

    // Default: Zen Mode OFF
    expect(useAppStore.getState().isZenMode).toBe(false);

    // Press Ctrl+Shift+F
    fireEvent.keyDown(window, {
      key: "F",
      code: "KeyF",
      ctrlKey: true,
      shiftKey: true,
    });

    expect(useAppStore.getState().isZenMode).toBe(true);

    // Press again to toggle off
    fireEvent.keyDown(window, {
      key: "F",
      code: "KeyF",
      ctrlKey: true,
      shiftKey: true,
    });

    expect(useAppStore.getState().isZenMode).toBe(false);
  });

  it("shows a persistent labeled exit cue while Zen Mode is active", () => {
    useAppStore.setState({ isZenMode: true });
    renderAppShell();

    expect(screen.getByLabelText(/Exit Zen Mode/)).toBeInTheDocument();
    expect(screen.getByText("Exit Zen")).toBeInTheDocument();
  });

  it("round-trips Zen Mode entry/exit without losing content", () => {
    render(
      <TooltipProvider>
        <AppShell>
          <p>Draft content that must survive</p>
        </AppShell>
      </TooltipProvider>,
    );

    expect(screen.getAllByTestId("sidebar")).toHaveLength(1);
    expect(
      screen.getByText("Draft content that must survive"),
    ).toBeInTheDocument();

    // Enter Zen Mode via keyboard shortcut
    fireEvent.keyDown(window, {
      key: "F",
      code: "KeyF",
      ctrlKey: true,
      shiftKey: true,
    });
    expect(useAppStore.getState().isZenMode).toBe(true);
    expect(screen.queryByTestId("sidebar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("right-sidebar")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Exit Zen Mode/)).toBeInTheDocument();

    // Exit Zen Mode via Escape — chrome returns, content is untouched
    fireEvent.keyDown(window, { key: "Escape", code: "Escape" });
    expect(useAppStore.getState().isZenMode).toBe(false);
    expect(screen.getAllByTestId("sidebar")).toHaveLength(1);
    expect(screen.getByTestId("right-sidebar")).toBeInTheDocument();
    expect(
      screen.getByText("Draft content that must survive"),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/Exit Zen Mode/)).not.toBeInTheDocument();
  });

  it("does not exit Zen Mode when Escape is pressed inside a dialog", () => {
    useAppStore.setState({ isZenMode: true });
    render(
      <TooltipProvider>
        <AppShell>
          <div role="dialog" aria-label="Note editor">
            <p>Editing</p>
          </div>
        </AppShell>
      </TooltipProvider>,
    );

    fireEvent.keyDown(screen.getByRole("dialog", { name: "Note editor" }), {
      key: "Escape",
      code: "Escape",
    });

    expect(useAppStore.getState().isZenMode).toBe(true);
    expect(screen.getByLabelText(/Exit Zen Mode/)).toBeInTheDocument();
  });

  it("toggles Context Panel with keyboard shortcut (Ctrl+.)", () => {
    renderAppShell();

    // Context panel is OPEN by default in this test setup
    expect(useAppStore.getState().isRightSidebarOpen).toBe(true);

    // Press Ctrl+.
    fireEvent.keyDown(window, {
      key: ".",
      code: "Period",
      ctrlKey: true,
    });

    expect(useAppStore.getState().isRightSidebarOpen).toBe(false);

    // Press again to toggle on
    fireEvent.keyDown(window, {
      key: ".",
      code: "Period",
      ctrlKey: true,
    });

    expect(useAppStore.getState().isRightSidebarOpen).toBe(true);
  });
});

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
    // Should find 2 sidebars (desktop and mobile)
    expect(screen.getAllByTestId("sidebar")).toHaveLength(2);
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
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Sidebar } from "../../../components/layout/v2/Sidebar";
import { useAppStore } from "../../../store/appStore";
import { TooltipProvider } from "../../../components/ui/tooltip";
import "../../mocks/supabase"; // This sets up the mock for lib/supabase

// Mock other dependencies
vi.mock("../XPExplainer", () => ({
  XPExplainer: () => <div data-testid="xp-explainer" />,
}));

vi.mock("../ProfileDialog", () => ({
  ProfileDialog: () => <div data-testid="profile-dialog" />,
}));

vi.mock("../../settings/DataManagementDialog", () => ({
  DataManagementDialog: () => <div data-testid="data-dialog" />,
}));

describe("Sidebar (v2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      currentView: "notes",
      user: {
        id: "test-user",
        email: "test@example.com",
        total_xp: 100,
        current_level: 5,
        theme: "light",
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
        role: "authenticated",
        aud: "authenticated",
        app_metadata: {},
        user_metadata: {},
      },
      isRightSidebarOpen: false,
    });

    // Mock soft navigation (wraps history.pushState)
    vi.spyOn(window.history, "pushState");
  });

  it("renders Plan and Library groups", () => {
    render(<TooltipProvider><Sidebar /></TooltipProvider>);

    expect(screen.getByRole("heading", { name: "Plan" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Library" })).toBeInTheDocument();

    const todayLink = screen.getByText("Today").closest("a");
    expect(todayLink).toHaveAttribute("href", "/");
    const notesLink = screen.getByText("Notes").closest("a");
    expect(notesLink).toHaveAttribute("href", "/notes");
    const feedsLink = screen.getByText("Feeds").closest("a");
    expect(feedsLink).toHaveAttribute("href", "/feeds");
  });

  it("routes Topics to the index, not a first-run deep link", () => {
    render(<TooltipProvider><Sidebar /></TooltipProvider>);

    const topicsLink = screen.getByText("Topics").closest("a");
    expect(topicsLink).toHaveAttribute("href", "/topics");
    expect(topicsLink).not.toHaveAttribute("href", "/topics/topic-ai-agents");
  });

  it("updates view and URL on click without a full navigation", () => {
    render(<TooltipProvider><Sidebar /></TooltipProvider>);

    const papersLink = screen.getByText("Papers").closest("a");
    expect(papersLink).toBeInTheDocument();

    fireEvent.click(papersLink!);

    expect(useAppStore.getState().currentView).toBe("papers");
    expect(window.history.pushState).toHaveBeenCalledWith(null, "", "/papers");
  });

  it('marks current view with aria-current="page"', () => {
    useAppStore.setState({ currentView: "ideas" });
    render(<TooltipProvider><Sidebar /></TooltipProvider>);

    const ideasLink = screen.getByText("Ideas").closest("a");
    expect(ideasLink).toHaveAttribute("aria-current", "page");

    const notesLink = screen.getByText("Notes").closest("a");
    expect(notesLink).not.toHaveAttribute("aria-current");
  });

  it("allows default behavior when modifier keys are pressed (Ctrl+Click)", () => {
    render(<TooltipProvider><Sidebar /></TooltipProvider>);

    const papersLink = screen.getByText("Papers").closest("a");
    expect(papersLink).toBeInTheDocument();

    fireEvent.click(papersLink!, { ctrlKey: true });

    expect(useAppStore.getState().currentView).toBe("notes"); // Should remain 'notes'
    expect(window.history.pushState).not.toHaveBeenCalled();
  });
});

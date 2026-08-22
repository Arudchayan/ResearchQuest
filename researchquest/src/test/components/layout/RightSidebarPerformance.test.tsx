import { render } from "@testing-library/react";
import { RightSidebar } from "../../../components/layout/RightSidebar";
import { useAppStore } from "../../../store/appStore";
import { TooltipProvider } from "../../../components/ui/tooltip";
import { mockSupabaseClient } from "../../mocks/supabase";
import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockUseBacklinks, mockUseRelatedItems } = vi.hoisted(() => ({
  mockUseBacklinks: vi.fn(() => ({ backlinks: [], loading: false })),
  mockUseRelatedItems: vi.fn(() => ({ relatedItems: [], loading: false })),
}));

// Mock hooks
vi.mock("../../../hooks/useBacklinks", () => ({
  useBacklinks: mockUseBacklinks,
}));
vi.mock("../../../hooks/useRelatedItems", () => ({
  useRelatedItems: mockUseRelatedItems,
}));

describe("RightSidebar Performance", () => {
  beforeEach(() => {
    useAppStore.setState({
      user: { id: "user-1" } as any,
      isRightSidebarOpen: false,
      selectedNote: null,
      selectedPaper: null,
      selectedIdea: null,
    });
    vi.clearAllMocks();
  });

  it("does not fetch data when sidebar is closed", () => {
    useAppStore.setState({ isRightSidebarOpen: false });
    render(<TooltipProvider><RightSidebar /></TooltipProvider>);

    expect(mockUseBacklinks).toHaveBeenCalledWith(
      null,
      null,
      "user-1",
      { enabled: false },
    );
    expect(mockUseRelatedItems).toHaveBeenCalledWith(
      null,
      null,
      "user-1",
      { enabled: false },
    );
  });

  it("enables related-data fetches when the sidebar is open", () => {
    useAppStore.setState({ isRightSidebarOpen: true });
    render(<TooltipProvider><RightSidebar /></TooltipProvider>);

    expect(mockUseBacklinks).toHaveBeenCalledWith(
      null,
      null,
      "user-1",
      { enabled: true },
    );
    expect(mockUseRelatedItems).toHaveBeenCalledWith(
      null,
      null,
      "user-1",
      { enabled: true },
    );
    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    expect(mockSupabaseClient.channel).not.toHaveBeenCalled();
  });
});

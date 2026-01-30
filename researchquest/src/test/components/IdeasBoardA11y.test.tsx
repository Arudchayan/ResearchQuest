import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { IdeasBoard } from "../../components/ideas/IdeasBoard";
import { vi, describe, it, expect } from "vitest";
import { mockIdea } from "../mocks/supabase";

// Hoist the mock function so it can be used in vi.mock
const { mockUseAppStore } = vi.hoisted(() => {
  return { mockUseAppStore: vi.fn() };
});

const defaultStore = {
  ideas: [mockIdea],
  selectedIdea: null,
  setSelectedIdea: vi.fn(),
  user: { id: "test-user-id" },
};

// Set default implementation
mockUseAppStore.mockReturnValue(defaultStore);
Object.assign(mockUseAppStore, {
  getState: () => ({ user: { id: "test-user-id" } }),
});

// Mock the store and hooks
vi.mock("../../store/appStore", () => ({
  useAppStore: mockUseAppStore,
}));

vi.mock("../../hooks/useIdeas", () => ({
  useIdeas: vi.fn(() => ({
    createIdea: vi.fn(),
    updateIdea: vi.fn(),
  })),
}));

// Mock OnboardingGuide to avoid complexity
vi.mock("../../components/layout/OnboardingGuide", () => ({
  OnboardingGuide: () => <div data-testid="onboarding-guide">Guide</div>,
}));

// Mock IdeaDetailView
vi.mock("../../components/entities/IdeaDetailView", () => ({
  IdeaDetailView: () => <div data-testid="idea-detail-view">Detail View</div>,
}));

describe("IdeasBoard Accessibility", () => {
  it('renders "New Idea" button', () => {
    mockUseAppStore.mockReturnValue(defaultStore);
    render(<IdeasBoard />);
    expect(screen.getByText("New Idea")).toBeInTheDocument();
  });

  it("renders idea cards with accessible menu button", () => {
    mockUseAppStore.mockReturnValue(defaultStore);
    render(<IdeasBoard />);
    expect(screen.getByText("Test Idea")).toBeInTheDocument();

    // Check for accessible "More options" button
    const moreOptionsBtns = screen.getAllByRole("button", {
      name: /more options/i,
    });
    expect(moreOptionsBtns.length).toBeGreaterThan(0);
  });

  it('renders "Advance" button with accessible label', () => {
    mockUseAppStore.mockReturnValue(defaultStore);
    render(<IdeasBoard />);

    const advanceBtns = screen.getAllByRole("button", {
      name: /advance idea to next stage/i,
    });
    expect(advanceBtns.length).toBeGreaterThan(0);
  });

  it("dialog inputs have accessible labels", async () => {
    mockUseAppStore.mockReturnValue(defaultStore);
    render(<IdeasBoard />);

    // Open the dialog
    fireEvent.click(screen.getByText("New Idea"));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Check if input is associated with label
    const titleInput = screen.getByLabelText("Title");
    expect(titleInput).toHaveAttribute("id", "create-idea-title");

    const descInput = screen.getByLabelText("Description");
    expect(descInput).toHaveAttribute("id", "create-idea-description");
  });

  it("renders close button with accessible label in detail view", async () => {
    // Update the mock to return a selected idea
    mockUseAppStore.mockReturnValue({
      ...defaultStore,
      selectedIdea: mockIdea,
    });

    render(<IdeasBoard />);

    expect(screen.getByText("Idea Details")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /close details/i }),
    ).toBeInTheDocument();
  });
});

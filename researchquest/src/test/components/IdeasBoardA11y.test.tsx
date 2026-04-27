import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { IdeasBoard } from "../../components/ideas/IdeasBoard";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { mockIdea } from "../mocks/supabase";

// Hoist the mock function so it can be used in vi.mock
const { mockUseAppStore } = vi.hoisted(() => {
  return { mockUseAppStore: vi.fn() };
});

const defaultStore = {
  ideas: [mockIdea],
  selectedIdea: null,
  setSelectedIdea: vi.fn(),
  ideasLoading: false,
  user: { id: "test-user-id" },
  dataSyncErrors: {
    notes: null,
    papers: null,
    ideas: null,
  },
};

const setStore = (store: typeof defaultStore) => {
  mockUseAppStore.mockImplementation((selector: any) =>
    typeof selector === "function" ? selector(store) : store,
  );
  Object.assign(mockUseAppStore, {
    getState: () => store,
  });
};

setStore(defaultStore);

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
  beforeEach(() => {
    setStore(defaultStore);
  });

  it('renders "New Idea" button', () => {
    render(<IdeasBoard />);
    expect(screen.getByText("New Idea")).toBeInTheDocument();
  });

  it("renders idea cards with accessible delete button", () => {
    render(<IdeasBoard />);
    expect(screen.getByText("Test Idea")).toBeInTheDocument();

    // Check for accessible "Delete" button
    const deleteBtns = screen.getAllByRole("button", {
      name: /delete/i,
    });
    expect(deleteBtns.length).toBeGreaterThan(0);
  });

  it('renders "Advance" button with accessible label', () => {
    render(<IdeasBoard />);

    const advanceBtns = screen.getAllByRole("button", {
      name: /advance idea to next stage/i,
    });
    expect(advanceBtns.length).toBeGreaterThan(0);
  });

  it("dialog inputs have accessible labels", async () => {
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
    setStore({
      ...defaultStore,
      selectedIdea: mockIdea,
    });

    render(<IdeasBoard />);

    expect(screen.getByText("Idea Details")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /close details/i }),
    ).toBeInTheDocument();
  });

  it("uses a full-width mobile detail panel when an idea is selected", () => {
    setStore({
      ...defaultStore,
      selectedIdea: mockIdea,
    });

    render(<IdeasBoard />);

    const detailPanel = screen.getByText("Idea Details").closest("div")
      ?.parentElement;

    expect(detailPanel).toHaveClass("w-full");
    expect(detailPanel).toHaveClass("lg:w-[450px]");
    expect(detailPanel).toHaveClass("absolute");
    expect(detailPanel).toHaveClass("lg:relative");
  });

  it("renders an ideas sync error instead of silently showing an empty state", () => {
    setStore({
      ...defaultStore,
      dataSyncErrors: {
        ...defaultStore.dataSyncErrors,
        ideas: {
          resource: "ideas",
          message: "Ideas unavailable",
        },
      },
    });

    render(<IdeasBoard />);

    expect(screen.getByText("Ideas unavailable")).toBeInTheDocument();
  });
});

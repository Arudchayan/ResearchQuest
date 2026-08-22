import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { IdeaDetailView } from "../../components/entities/IdeaDetailView";
import { TooltipProvider } from "../../components/ui/tooltip";
import type { Idea } from "../../types/database";

// Mock icons
vi.mock("lucide-react", () => ({
  Lightbulb: () => <span>Icon</span>,
  Calendar: () => <span>Icon</span>,
  TrendingUp: () => <span>Icon</span>,
  Edit2: () => <span>EditIcon</span>,
  Save: () => <span>SaveIcon</span>,
  X: () => <span>XIcon</span>,
  Trash: () => <span>TrashIcon</span>,
  Loader2: () => <span>Loader2Icon</span>,
  Download: () => <span>DownloadIcon</span>,
  Table: () => <span>TableIcon</span>,
  FileJson: () => <span>FileJsonIcon</span>,
  AlertTriangle: () => <span>AlertIcon</span>,
  FileText: () => <span>FileTextIcon</span>,
  Search: () => <span>SearchIcon</span>,
  Loader: () => <span>LoaderIcon</span>,
  ListTodo: () => <span>ListTodoIcon</span>,
  PenLine: () => <span>PenLineIcon</span>,
}));

// Mock sub-components
vi.mock("../../components/topics/TopicSelector", () => ({
  TopicSelector: () => <div>TopicSelector</div>,
}));

vi.mock("../../lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

const mockIdea: Idea = {
  id: "1",
  user_id: "user1",
  title: "Test Idea",
  description: "Description",
  stage: "Seed",
  created_at: "2023-01-01",
  updated_at: "2023-01-01",
};

describe("IdeaDetailView", () => {
  it("renders delete button when not editing", () => {
    const onDelete = vi.fn();
    const onUpdate = vi.fn();

    render(
      <TooltipProvider delayDuration={0}>
        <IdeaDetailView
          idea={mockIdea}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      </TooltipProvider>,
    );

    expect(screen.getByRole("button", { name: /delete idea/i })).toBeInTheDocument();
  });

  it("calls onDelete when delete button is clicked and confirmed", async () => {
    const onDelete = vi.fn().mockResolvedValue(true);
    const onUpdate = vi.fn();

    render(
      <TooltipProvider delayDuration={0}>
        <IdeaDetailView
          idea={mockIdea}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      </TooltipProvider>,
    );

    const deleteButton = screen.getByRole("button", { name: /delete idea/i });
    fireEvent.click(deleteButton);

    // Check dialog
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    // Confirm
    const confirmButton = screen.getByRole("button", { name: "Delete" });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith("1");
    });
  });

  it("does not call onDelete when delete button is clicked and cancelled", async () => {
    const onDelete = vi.fn();
    const onUpdate = vi.fn();

    render(
      <TooltipProvider delayDuration={0}>
        <IdeaDetailView
          idea={mockIdea}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      </TooltipProvider>,
    );

    const deleteButton = screen.getByRole("button", { name: /delete idea/i });
    fireEvent.click(deleteButton);

    // Check dialog
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    // Cancel
    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelButton);

    expect(onDelete).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
  });

  it("does not render delete button if onDelete is not provided", () => {
    const onUpdate = vi.fn();
    render(<TooltipProvider delayDuration={0}><IdeaDetailView idea={mockIdea} onUpdate={onUpdate} /></TooltipProvider>);
    expect(screen.queryByRole("button", { name: /delete idea/i })).not.toBeInTheDocument();
  });
});

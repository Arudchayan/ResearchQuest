import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PaperDetailView } from "../../components/entities/PaperDetailView";
import type { Paper } from "../../types/database";

// Mock dependencies
vi.mock("../../components/topics/TopicSelector", () => ({
  TopicSelector: () => <div data-testid="topic-selector">Topics</div>,
}));

describe("PaperDetailView Security", () => {
  const mockPaper: Paper = {
    id: "1",
    user_id: "user1",
    title: "Test Paper",
    authors: ["Author A"],
    publication_date: "2023-01-01",
    status: "To Read",
    created_at: "2023-01-01T00:00:00Z",
    updated_at: "2023-01-01T00:00:00Z",
    source_url: "javascript:alert(1)", // Malicious URL
    doi: "10.1234/5678",
    abstract: "Abstract...",
    topic_ids: [],
  };

  const mockOnUpdate = vi.fn();

  it("should not render the View Source link if the URL is unsafe", () => {
    render(<PaperDetailView paper={mockPaper} onUpdate={mockOnUpdate} />);
    const sourceLink = screen.queryByText(/View Source/i);
    expect(sourceLink).not.toBeInTheDocument();
  });
});

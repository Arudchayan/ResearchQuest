import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TopicList } from "../../../components/topics/TopicList";
import { TooltipProvider } from "../../../components/ui/tooltip";
import type { TopicWithCounts } from "../../../types/database";
import { useAppStore } from "../../../store/appStore";

describe("TopicList", () => {
  const baseTopics: TopicWithCounts[] = [
    {
      id: "topic-1",
      user_id: "user-1",
      name: "Research Methods",
      description: "Design and methodology notes",
      note_count: 2,
      paper_count: 1,
      idea_count: 0,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
    {
      id: "topic-2",
      user_id: "user-1",
      name: "Machine Learning",
      description: "",
      note_count: 5,
      paper_count: 3,
      idea_count: 2,
      created_at: "2024-01-02T00:00:00Z",
      updated_at: "2024-01-03T00:00:00Z",
    },
  ];

  beforeEach(() => {
    useAppStore.setState({ selectedTopic: null });
  });

  it("renders topics and highlights the selected one", () => {
    useAppStore.setState({ selectedTopic: baseTopics[0] });
    const handleSelect = vi.fn();

    render(
      <TooltipProvider delayDuration={0}>
        <TopicList
          topics={baseTopics}
          loading={false}
          onSelectTopic={handleSelect}
          onDeleteTopic={vi.fn().mockResolvedValue(true)}
        />
      </TooltipProvider>,
    );

    expect(screen.getByText("Research Methods")).toBeInTheDocument();
    expect(screen.getByText("Machine Learning")).toBeInTheDocument();

    const researchCard = screen.getByRole("button", {
      name: /^Research Methods$/i,
    });
    const machineLearningCard = screen.getByRole("button", {
      name: /^Machine Learning$/i,
    });
    expect(researchCard).toHaveClass("border-primary-500");

    fireEvent.click(machineLearningCard);
    expect(handleSelect).toHaveBeenCalledWith(baseTopics[1]);
  });

  it("supports keyboard activation for accessibility", () => {
    const handleSelect = vi.fn();

    render(
      <TooltipProvider delayDuration={0}>
        <TopicList
          topics={baseTopics}
          loading={false}
          onSelectTopic={handleSelect}
          onDeleteTopic={vi.fn().mockResolvedValue(true)}
        />
      </TooltipProvider>,
    );

    const researchCard = screen.getByRole("button", {
      name: /^Research Methods$/i,
    });
    researchCard.focus();
    fireEvent.keyDown(researchCard, { key: "Enter", code: "Enter" });

    expect(handleSelect).toHaveBeenCalledWith(baseTopics[0]);
  });

  it("confirms deletion without triggering the parent click handler", async () => {
    const handleSelect = vi.fn();
    const handleDelete = vi.fn().mockResolvedValue(true);

    render(
      <TooltipProvider delayDuration={0}>
        <TopicList
          topics={baseTopics}
          loading={false}
          onSelectTopic={handleSelect}
          onDeleteTopic={handleDelete}
        />
      </TooltipProvider>,
    );

    const deleteButton = screen.getAllByRole("button", { name: /^Delete/i })[0];
    fireEvent.click(deleteButton);

    // Wait for ConfirmDialog to appear and click confirm
    const confirmButton = await screen.findByRole("button", { name: "Delete" });
    fireEvent.click(confirmButton);

    // Wait for the async click handler and the delete promise
    await vi.waitFor(() => {
      expect(handleDelete).toHaveBeenCalledWith("topic-1");
    });

    expect(handleSelect).not.toHaveBeenCalled();
  });
});

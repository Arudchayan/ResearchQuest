import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TopicDetailView } from "../../../components/topics/TopicDetailView";
import { useTopics } from "../../../hooks/useTopics";
import { mockSupabaseClient } from "../../mocks/supabase";

vi.mock("../../../hooks/useTopics");
vi.mock("../../../components/ui/ConfirmDialog", () => ({
  ConfirmDialog: () => null,
  useConfirmDialog: () => ({
    confirm: vi.fn().mockResolvedValue(true),
    isOpen: false,
    config: {},
  }),
}));

import { mockSupabaseClient } from "../../mocks/supabase";

const mockTopic = {
  id: "topic-1",
  name: "Machine Learning",
  description: "Notes about ML",
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-02T00:00:00Z",
  note_count: 1,
  paper_count: 0,
  idea_count: 0,
};

const activeQuest = {
  id: "quest-1",
  user_id: "test-user-id",
  topic_id: "topic-1",
  objective: 'Review and enrich "Machine Learning"',
  target_count: 3,
  progress_count: 1,
  due_date: "2025-01-10",
  status: "active" as const,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

const renderView = () =>
  render(
    <TopicDetailView
      topic={mockTopic}
      onUpdate={vi.fn().mockResolvedValue(true)}
      onDelete={vi.fn().mockResolvedValue(true)}
    />,
  );

describe("TopicDetailView quests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "test-user-id" } },
      error: null,
    });
    (useTopics as any).mockReturnValue({
      quests: [],
      questsLoading: false,
      refreshQuests: vi.fn(),
      advanceQuest: vi.fn(),
    });
  });

  it("renders the topic's active quests with progress, counts, and due date", () => {
    (useTopics as any).mockReturnValue({
      quests: [
        activeQuest,
        {
          ...activeQuest,
          id: "quest-other-topic",
          topic_id: "topic-2",
          objective: "Review a different topic",
        },
        {
          id: "quest-2",
          user_id: "test-user-id",
          topic_id: "topic-1",
          objective: "Link a paper",
          target_count: 1,
          progress_count: 0,
          due_date: "2025-01-15",
          status: "active" as const,
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
        },
      ],
      questsLoading: false,
      refreshQuests: vi.fn(),
      advanceQuest: vi.fn(),
    });

    renderView();

    expect(screen.getByText("Topic Quests")).toBeInTheDocument();
    expect(
      screen.getByText('Review and enrich "Machine Learning"'),
    ).toBeInTheDocument();
    expect(screen.getByText("1 of 3 items")).toBeInTheDocument();
    expect(screen.getByText("0 of 1 item")).toBeInTheDocument();
    expect(screen.getAllByText(/^Due /)).toHaveLength(2);

    const progressBars = screen.getAllByRole("progressbar");
    expect(progressBars).toHaveLength(2);
    expect(progressBars[0]).toHaveAttribute("aria-valuenow", "1");
    expect(progressBars[0]).toHaveAttribute("aria-valuemax", "3");
    expect(progressBars[1]).toHaveAttribute("aria-valuenow", "0");
    expect(progressBars[1]).toHaveAttribute("aria-valuemax", "1");

    expect(screen.queryByText("Review a different topic")).not.toBeInTheDocument();
  });

  it("marks progress on an active quest and reflects completion", () => {
    const advanceQuest = vi.fn();
    (useTopics as any).mockReturnValue({
      quests: [activeQuest],
      questsLoading: false,
      refreshQuests: vi.fn(),
      advanceQuest,
    });

    const { rerender } = renderView();
    fireEvent.click(screen.getByRole("button", { name: "Mark progress" }));
    expect(advanceQuest).toHaveBeenCalledWith("topic-1");

    const completedQuest = {
      ...activeQuest,
      progress_count: 3,
      status: "completed" as const,
    };
    (useTopics as any).mockReturnValue({
      quests: [completedQuest],
      questsLoading: false,
      refreshQuests: vi.fn(),
      advanceQuest,
    });
    rerender(
      <TopicDetailView
        topic={mockTopic}
        onUpdate={vi.fn().mockResolvedValue(true)}
        onDelete={vi.fn().mockResolvedValue(true)}
      />,
    );

    expect(screen.getByText("3 of 3 items")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Mark progress" }),
    ).not.toBeInTheDocument();
  });

  it("shows an empty state without a create-quest affordance", () => {
    renderView();

    expect(
      screen.getByText("No quests for this topic yet."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /create quest/i }),
    ).not.toBeInTheDocument();
  });
});

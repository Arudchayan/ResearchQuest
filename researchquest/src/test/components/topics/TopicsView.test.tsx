import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TopicsView } from "../../../components/topics/TopicsView";
import { useAppStore } from "../../../store/appStore";
import { useTopics } from "../../../hooks/useTopics";

// Mock the hooks
vi.mock("../../../hooks/useTopics");
vi.mock("../../../components/ui/ConfirmDialog", () => ({
  ConfirmDialog: () => null,
  useConfirmDialog: () => ({
    confirm: vi.fn().mockResolvedValue(true),
    isOpen: false,
    config: {},
  }),
}));
vi.mock("../../../components/topics/TopicList", () => ({
  TopicList: ({ topics, onDeleteTopic, onSelectTopic }: any) => (
    <div>
      {topics.map((topic: any) => (
        <div key={topic.id}>
          <span>{topic.name}</span>
          <button
            aria-label={`Delete ${topic.name}`}
            onClick={() => onDeleteTopic(topic.id)}
          >
            Delete {topic.name}
          </button>
          <button
            aria-label={`Select ${topic.name}`}
            onClick={() => onSelectTopic(topic)}
          >
            Select {topic.name}
          </button>
        </div>
      ))}
    </div>
  ),
}));

const mockTopics = [
  {
    id: "topic-1",
    name: "Machine Learning",
    description: "Notes about ML",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    note_count: 5,
    paper_count: 2,
    idea_count: 1,
  },
  {
    id: "topic-2",
    name: "Data Science",
    description: "Data analysis notes",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    note_count: 3,
    paper_count: 0,
    idea_count: 0,
  }
];

describe("TopicsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      user: { id: "test-user-id" } as any,
      selectedTopic: null,
      topics: Object.fromEntries(mockTopics.map((topic) => [topic.id, topic])),
    });

    (useTopics as any).mockReturnValue({
      topics: mockTopics,
      loading: false,
      createTopic: vi.fn().mockResolvedValue({ id: "new-id", name: "New Topic" }),
      updateTopic: vi.fn().mockResolvedValue(true),
      deleteTopic: vi.fn().mockResolvedValue(true),
      upsertTopic: vi.fn().mockResolvedValue(true),
      removeTopic: vi.fn().mockResolvedValue(true),
    });
  });

  it("renders the topics view with empty state initially", () => {
    render(<TopicsView />);

    expect(screen.getByText("Topics")).toBeInTheDocument();
    expect(screen.getByText("Machine Learning")).toBeInTheDocument();
    expect(screen.getByText("Data Science")).toBeInTheDocument();
    expect(screen.getByText("Select a topic")).toBeInTheDocument();
  });

  it("allows creating a new topic", async () => {
    const mockCreateTopic = vi.fn().mockResolvedValue({ id: "new-id", name: "New Topic" });
    (useTopics as any).mockReturnValue({
      topics: mockTopics,
      loading: false,
      createTopic: mockCreateTopic,
      updateTopic: vi.fn(),
      deleteTopic: vi.fn(),
    });

    render(<TopicsView />);

    const addButton = screen.getByLabelText("New Topic");
    fireEvent.click(addButton);

    const input = screen.getByPlaceholderText("Topic name...");
    fireEvent.change(input, { target: { value: "New Topic" } });

    const form = input.closest('form');
    if (form) {
      fireEvent.submit(form);
    } else {
      const submitButton = screen.getByText("Add");
      fireEvent.click(submitButton);
    }

    await waitFor(() => {
      expect(mockCreateTopic).toHaveBeenCalledWith(expect.objectContaining({ name: "New Topic" }));
    });
  });

  it("hides a topic immediately after delete", async () => {
    const mockDeleteTopic = vi.fn().mockResolvedValue(true);
    (useTopics as any).mockReturnValue({
      topics: mockTopics,
      loading: false,
      createTopic: vi.fn(),
      updateTopic: vi.fn(),
      deleteTopic: mockDeleteTopic,
    });

    render(<TopicsView />);

    expect(screen.getByText("Machine Learning")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Delete Machine Learning"));

    await waitFor(() => {
      expect(screen.queryByText("Machine Learning")).not.toBeInTheDocument();
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TopicsView } from "../../../components/topics/TopicsView";
import { useAppStore } from "../../../store/appStore";
import { useTopics } from "../../../hooks/useTopics";

// Mock the hooks
vi.mock("../../../hooks/useTopics");

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
    });

    (useTopics as any).mockReturnValue({
      topics: mockTopics,
      loading: false,
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
    const mockUpsertTopic = vi.fn().mockResolvedValue(true);
    (useTopics as any).mockReturnValue({
      topics: mockTopics,
      loading: false,
      upsertTopic: mockUpsertTopic,
      removeTopic: vi.fn(),
    });

    render(<TopicsView />);

    const addButton = screen.getByLabelText("New Topic");
    fireEvent.click(addButton);

    const input = screen.getByPlaceholderText("Topic name...");
    fireEvent.change(input, { target: { value: "New Topic" } });

    const submitButton = screen.getByText("Add");
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockUpsertTopic).toHaveBeenCalledWith({ name: "New Topic" });
    });
  });
});

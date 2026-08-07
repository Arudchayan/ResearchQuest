import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { IdeasBoard } from "../../components/ideas/IdeasBoard";
import { IdeaDetailView } from "../../components/entities/IdeaDetailView";
import { TooltipProvider } from "../../components/ui/tooltip";
import type { Idea } from "../../types/database";

const {
  useIdeasMock,
  useTasksMock,
  useNotesMock,
  useAppStoreMock,
  updateIdeaMock,
  createTaskMock,
  createNoteMock,
  toastSuccessMock,
  toastErrorMock,
  setSelectedNoteMock,
  setSelectedIdeaMock,
  setCurrentViewMock,
} = vi.hoisted(() => ({
  useIdeasMock: vi.fn(),
  useTasksMock: vi.fn(),
  useNotesMock: vi.fn(),
  useAppStoreMock: vi.fn(),
  updateIdeaMock: vi.fn(),
  createTaskMock: vi.fn(),
  createNoteMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
  setSelectedNoteMock: vi.fn(),
  setSelectedIdeaMock: vi.fn(),
  setCurrentViewMock: vi.fn(),
}));

vi.mock("../../store/appStore", () => ({
  useAppStore: useAppStoreMock,
}));

vi.mock("../../hooks/useIdeas", () => ({
  useIdeas: useIdeasMock,
}));

vi.mock("../../hooks/useTasks", () => ({
  useTasks: useTasksMock,
}));

vi.mock("../../hooks/useNotes", () => ({
  useNotes: useNotesMock,
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
    dismiss: vi.fn(),
  },
}));

vi.mock("lucide-react", () => {
  const iconStub = () => null;
  const icons = [
    "Plus",
    "Trash2",
    "Lightbulb",
    "X",
    "Search",
    "Download",
    "FileText",
    "Table",
    "FileJson",
    "ArrowUpDown",
    "ArrowLeft",
    "ArrowRight",
    "ListTodo",
    "Calendar",
    "TrendingUp",
    "Edit2",
    "Save",
    "Trash",
    "Loader",
    "PenLine",
  ];
  return Object.fromEntries(icons.map((name) => [name, iconStub]));
});

vi.mock("../../components/topics/TopicSelector", () => ({
  TopicSelector: () => <div data-testid="topic-selector" />,
}));

vi.mock("../../components/layout/OnboardingGuide", () => ({
  OnboardingGuide: () => <div data-testid="onboarding-guide" />,
}));

const seedIdea: Idea = {
  id: "idea-1",
  user_id: "test-user-id",
  title: "Test Idea",
  description: "Test idea description",
  stage: "Seed",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

const matureIdea: Idea = {
  ...seedIdea,
  id: "idea-2",
  title: "Mature Idea",
  description: "Mature idea description",
  stage: "Mature",
};

const mockTask = {
  id: "task-1",
  user_id: "test-user-id",
  title: "Test Idea",
  description: "Test idea description",
  priority: "medium" as const,
  category: "Research",
  completed: false,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

const mockNote = {
  id: "note-1",
  user_id: "test-user-id",
  title: "Mature Idea",
  markdown_body: "# Mature Idea\n",
  tags: ["draft"],
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

const defaultStore = {
  ideas: [seedIdea],
  selectedIdea: null,
  setSelectedIdea: setSelectedIdeaMock,
  ideasLoading: false,
  user: { id: "test-user-id" },
  dataSyncErrors: {
    notes: null,
    papers: null,
    ideas: null,
  },
  tasks: [],
  notes: [],
  setSelectedNote: setSelectedNoteMock,
  setCurrentView: setCurrentViewMock,
};

const setStore = (store: typeof defaultStore) => {
  useAppStoreMock.mockImplementation((selector: any) =>
    typeof selector === "function" ? selector(store) : store,
  );
  Object.assign(useAppStoreMock, {
    getState: () => store,
  });
};

setStore(defaultStore);

const promotePayload = {
  title: "Test Idea",
  description: "Test idea description",
  priority: "medium",
  category: "Research",
  completed: false,
};

describe("Idea pipeline: promote to task (idea cards)", () => {
  beforeEach(() => {
    updateIdeaMock.mockReset().mockResolvedValue(true);
    createTaskMock.mockReset().mockResolvedValue(mockTask);
    createNoteMock.mockReset().mockResolvedValue(mockNote);
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    setSelectedNoteMock.mockReset();
    setSelectedIdeaMock.mockReset();
    setCurrentViewMock.mockReset();
    useIdeasMock.mockReturnValue({
      createIdea: vi.fn(),
      updateIdea: updateIdeaMock,
      deleteIdea: vi.fn(),
      restoreIdea: vi.fn(),
    });
    useTasksMock.mockReturnValue({ createTask: createTaskMock });
    useNotesMock.mockReturnValue({ createNote: createNoteMock });
    setStore(defaultStore);
    window.history.replaceState(null, "", "/");
  });

  it("creates a task, advances the idea one stage, and toasts", async () => {
    render(<IdeasBoard />);

    fireEvent.click(
      screen.getByRole("button", { name: "Promote to task" }),
    );

    await waitFor(() => {
      expect(createTaskMock).toHaveBeenCalledWith(promotePayload);
      expect(updateIdeaMock).toHaveBeenCalledWith(
        "idea-1",
        { stage: "Developing" },
        "Seed",
      );
      expect(toastSuccessMock).toHaveBeenCalledWith(
        "Task created: Test Idea",
      );
    });

    expect(setSelectedIdeaMock).not.toHaveBeenCalled();
  });

  it("does not advance the stage when task creation fails", async () => {
    createTaskMock.mockResolvedValueOnce(null);
    render(<IdeasBoard />);

    fireEvent.click(
      screen.getByRole("button", { name: "Promote to task" }),
    );

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalled();
    });

    expect(updateIdeaMock).not.toHaveBeenCalled();
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  it("disables the promote button while the operation is in flight", async () => {
    let resolveTask: ((value: unknown) => void) | undefined;
    createTaskMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveTask = resolve;
      }),
    );
    render(<IdeasBoard />);

    const promoteButton = screen.getByRole("button", {
      name: "Promote to task",
    });
    fireEvent.click(promoteButton);
    expect(promoteButton).toBeDisabled();

    resolveTask?.(mockTask);
    await waitFor(() => {
      expect(promoteButton).not.toBeDisabled();
    });
  });
});

describe("Idea pipeline: IdeaDetailView actions", () => {
  beforeEach(() => {
    updateIdeaMock.mockReset().mockResolvedValue(true);
    createTaskMock.mockReset().mockResolvedValue(mockTask);
    createNoteMock.mockReset().mockResolvedValue(mockNote);
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    setSelectedNoteMock.mockReset();
    setSelectedIdeaMock.mockReset();
    setCurrentViewMock.mockReset();
    useIdeasMock.mockReturnValue({
      createIdea: vi.fn(),
      updateIdea: updateIdeaMock,
      deleteIdea: vi.fn(),
      restoreIdea: vi.fn(),
    });
    useTasksMock.mockReturnValue({ createTask: createTaskMock });
    useNotesMock.mockReturnValue({ createNote: createNoteMock });
    setStore(defaultStore);
    window.history.replaceState(null, "", "/");
  });

  it("promotes from the detail view (task + stage advance + toast)", async () => {
    render(
      <TooltipProvider delayDuration={0}>
        <IdeaDetailView idea={seedIdea} onUpdate={updateIdeaMock} />
      </TooltipProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Promote to task" }),
    );

    await waitFor(() => {
      expect(createTaskMock).toHaveBeenCalledWith(promotePayload);
      expect(updateIdeaMock).toHaveBeenCalledWith(
        "idea-1",
        { stage: "Developing" },
        "Seed",
      );
      expect(toastSuccessMock).toHaveBeenCalledWith(
        "Task created: Test Idea",
      );
    });
  });

  it("does not advance the stage in the detail view when task creation fails", async () => {
    createTaskMock.mockResolvedValueOnce(null);
    render(
      <TooltipProvider delayDuration={0}>
        <IdeaDetailView idea={seedIdea} onUpdate={updateIdeaMock} />
      </TooltipProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Promote to task" }),
    );

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalled();
    });
    expect(updateIdeaMock).not.toHaveBeenCalled();
  });

  it("hides Start writing for non-Mature ideas", () => {
    render(
      <TooltipProvider delayDuration={0}>
        <IdeaDetailView idea={seedIdea} onUpdate={updateIdeaMock} />
      </TooltipProvider>,
    );

    expect(
      screen.queryByRole("button", { name: "Start writing" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Promote to task" }),
    ).toBeInTheDocument();
  });

  it("shows Start writing only for Mature ideas", () => {
    render(
      <TooltipProvider delayDuration={0}>
        <IdeaDetailView idea={matureIdea} onUpdate={updateIdeaMock} />
      </TooltipProvider>,
    );

    expect(
      screen.getByRole("button", { name: "Start writing" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Promote to task" }),
    ).toBeInTheDocument();
  });

  it("start writing creates a draft note and writing task, then navigates", async () => {
    render(
      <TooltipProvider delayDuration={0}>
        <IdeaDetailView idea={matureIdea} onUpdate={updateIdeaMock} />
      </TooltipProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Start writing" }),
    );

    await waitFor(() => {
      expect(createNoteMock).toHaveBeenCalledWith({
        title: "Mature Idea",
        markdown_body: "# Mature Idea\n\n> Mature idea description\n",
        tags: ["draft"],
      });
      expect(createTaskMock).toHaveBeenCalledWith({
        title: "Draft: Mature Idea",
        priority: "medium",
        category: "Writing",
        completed: false,
      });
      expect(setSelectedNoteMock).toHaveBeenCalledWith(mockNote);
      expect(setSelectedIdeaMock).toHaveBeenCalledWith(null);
      expect(setCurrentViewMock).toHaveBeenCalledWith("notes");
      expect(window.location.pathname).toBe("/notes/note-1");
    });
  });

  it("does not create the writing task or navigate when note creation fails", async () => {
    createNoteMock.mockResolvedValueOnce(null);
    render(
      <TooltipProvider delayDuration={0}>
        <IdeaDetailView idea={matureIdea} onUpdate={updateIdeaMock} />
      </TooltipProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Start writing" }),
    );

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalled();
    });

    expect(createTaskMock).not.toHaveBeenCalled();
    expect(setSelectedNoteMock).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/");
  });
});

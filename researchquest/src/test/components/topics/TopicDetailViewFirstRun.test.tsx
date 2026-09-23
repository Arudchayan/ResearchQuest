import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { TopicDetailView } from "../../../components/topics/TopicDetailView";
import { useTopics } from "../../../hooks/useTopics";
import { mockSupabaseClient } from "../../mocks/supabase";

vi.mock("../../../hooks/useTopics");
vi.mock("../../../lib/supabase", async () => {
  const { mockSupabaseClient: client } = await import("../../mocks/supabase");
  return {
    isDemoMode: true,
    hasSupabaseConfig: true,
    supabaseConfigErrorMessage: "demo",
    DEMO_MODE_STORAGE_KEY: "rq_demo_mode",
    enableDemoModeAndReload: vi.fn(),
    disableDemoModeAndReload: vi.fn(),
    supabase: client,
  };
});
vi.mock("../../../components/ui/ConfirmDialog", () => ({
  ConfirmDialog: () => null,
  useConfirmDialog: () => ({
    confirm: vi.fn().mockResolvedValue(true),
    isOpen: false,
    config: {},
  }),
}));

const mockTopic = {
  id: "topic-ai-agents",
  name: "AI Agents for Research",
  description: "How agents support literature review.",
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-02T00:00:00Z",
  note_count: 1,
  paper_count: 3,
  idea_count: 0,
};

const emptyNote = {
  id: "note-first-run",
  user_id: "demo-user-0001",
  title: "",
  markdown_body: "",
  tags: [],
  linked_entity_ids: [],
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

const papers = [
  {
    id: "paper-0001",
    user_id: "demo-user-0001",
    title: "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks",
    authors: ["Patrick Lewis"],
    status: "Reading",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
  {
    id: "paper-0004",
    user_id: "demo-user-0001",
    title: "Attention Is All You Need",
    authors: ["Ashish Vaswani"],
    status: "Read",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
  {
    id: "paper-0007",
    user_id: "demo-user-0001",
    title: "ReAct: Synergizing Reasoning and Acting in Language Models",
    authors: ["Shunyu Yao"],
    status: "Reading",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
];

function mockAssociationQueries() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: "demo-user-0001" } },
    error: null,
  });

  const noteLinkBuilder: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({
      data: [{ note_id: emptyNote.id }],
      error: null,
    }),
  };
  const paperLinkBuilder: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({
      data: papers.map((p) => ({ paper_id: p.id })),
      error: null,
    }),
  };
  const ideaLinkBuilder: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data: [], error: null }),
  };
  const notesBuilder: any = {
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ data: [emptyNote], error: null }),
  };
  const papersBuilder: any = {
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ data: papers, error: null }),
  };
  const ideasBuilder: any = {
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ data: [], error: null }),
  };

  mockSupabaseClient.from.mockImplementation((table: string) => {
    if (table === "topic_notes") return noteLinkBuilder;
    if (table === "topic_papers") return paperLinkBuilder;
    if (table === "topic_ideas") return ideaLinkBuilder;
    if (table === "notes") return notesBuilder;
    if (table === "papers") return papersBuilder;
    if (table === "ideas") return ideasBuilder;
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      in: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
  });
}

describe("TopicDetailView first-run (unified shell)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useTopics as any).mockReturnValue({
      quests: [],
      questsLoading: false,
      refreshQuests: vi.fn(),
      advanceQuest: vi.fn(),
    });
    mockAssociationQueries();
  });

  it("renders full shell chrome with demo banner, exit CTAs, and onboarding coachmark", async () => {
    render(
      <TopicDetailView
        topic={mockTopic}
        onUpdate={vi.fn().mockResolvedValue(true)}
        onDelete={vi.fn().mockResolvedValue(true)}
      />,
    );

    expect(
      screen.getByRole("region", { name: /Demo workspace/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Four sample topics — you’re on AI Agents (three papers + a note). Focus Studio starts empty. Explore freely — nothing here affects real data.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Go to full workspace/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Exit demo/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Welcome to ResearchQuest/i),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /Export topic/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Edit$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Delete$/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Topic Quests/i)).toBeInTheDocument();
    expect(screen.getByText(/Connected work/i)).toBeInTheDocument();
    expect(screen.getByText(/Total links/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByText(/Retrieval-Augmented Generation/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/Attention Is All You Need/i)).toBeInTheDocument();
      expect(screen.getByText(/ReAct:/i)).toBeInTheDocument();
    });
  });

  it("Exit demo leaves demo mode for the full workspace", async () => {
    const { disableDemoModeAndReload } = await import("../../../lib/supabase");
    render(
      <TopicDetailView
        topic={mockTopic}
        onUpdate={vi.fn().mockResolvedValue(true)}
        onDelete={vi.fn().mockResolvedValue(true)}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Exit demo/i }));
    expect(disableDemoModeAndReload).toHaveBeenCalledWith("/");
  });
});

/**
 * Demo workspace used when ResearchQuest runs in demo mode.
 *
 * Every table mirrors the production Supabase schema so the in-memory demo
 * client can serve the same hooks and views without a backend.
 */

export const DEMO_USER_ID = "demo-user-0001";
export const DEMO_USER_EMAIL = "demo@researchquest.app";
export const DEMO_USER_PASSWORD = "ResearchQuest!2026";
export const DEMO_USERNAME = "Ada Scholar";

export type Row = Record<string, unknown>;
type TableMap = Record<string, Row[]>;

function iso(daysAgo: number, hour = 9, minute = 0): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function dateOnly(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split("T")[0];
}

function uid(prefix: string, index: number): string {
  return `${prefix}-${String(index).padStart(4, "0")}`;
}

export function buildDemoTables(): TableMap {
  const userProfile: Row = {
    id: DEMO_USER_ID,
    username: DEMO_USERNAME,
    total_xp: 2480,
    current_level: 5,
    current_streak: 12,
    longest_streak: 18,
    last_activity_date: dateOnly(0),
    streak_freeze_tokens: 2,
    active_boost: null,
    rest_days: 1,
    auto_create_reading_tasks: true,
    theme_preference: "light",
    notes_count: 9,
    papers_count: 7,
    tasks_completed_count: 14,
    papers_with_insights_count: 3,
    created_at: iso(120),
    updated_at: iso(0, 8, 24),
  };

  const topics: Row[] = [
    {
      id: "topic-ai-agents",
      user_id: DEMO_USER_ID,
      name: "AI Agents for Research",
      description:
        "How autonomous and semi-autonomous agents support literature review, synthesis, and experimental design.",
      created_at: iso(42),
      updated_at: iso(1, 11, 5),
    },
    {
      id: "topic-memory",
      user_id: DEMO_USER_ID,
      name: "Memory & Attention",
      description:
        "Cognitive constraints, working memory, and attention in human-AI collaboration.",
      created_at: iso(38),
      updated_at: iso(2, 14, 22),
    },
    {
      id: "topic-repro",
      user_id: DEMO_USER_ID,
      name: "Reproducible Science",
      description:
        "Open methods, preregistration, and computational reproducibility across disciplines.",
      created_at: iso(30),
      updated_at: iso(3, 10, 40),
    },
    {
      id: "topic-hci",
      user_id: DEMO_USER_ID,
      name: "Human-Computer Interaction",
      description:
        "Designing tools that support sensemaking, reflection, and knowledge work.",
      created_at: iso(25),
      updated_at: iso(4, 9, 15),
    },
  ];

  const papers: Row[] = [
    {
      id: "paper-0001",
      user_id: DEMO_USER_ID,
      title: "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks",
      authors: ["Patrick Lewis", "Ethan Perez", "Aleksandra Piktus"],
      doi: "10.48550/arXiv.2005.11401",
      source_url: "https://arxiv.org/abs/2005.11401",
      status: "Reading",
      topic_ids: ["topic-ai-agents"],
      abstract:
        "Large pre-trained language models struggle to store and access knowledge. RAG combines parametric and non-parametric memory for knowledge-intensive tasks.",
      publication_date: "2020-05-22",
      created_at: iso(21, 9, 12),
      updated_at: iso(0, 7, 45),
    },
    {
      id: "paper-0002",
      user_id: DEMO_USER_ID,
      title: "The WEIRD Problem: Cognitive Science and Human Cognition",
      authors: ["Joseph Henrich", "Steven J. Heine", "Ara Norenzayan"],
      doi: "10.1017/S0140525X0999152X",
      source_url: "https://doi.org/10.1017/S0140525X0999152X",
      status: "To Read",
      topic_ids: ["topic-memory", "topic-hci"],
      abstract:
        "Behavioral scientists routinely publish claims about human psychology based on samples drawn entirely from Western, Educated, Industrialized, Rich, and Democratic societies.",
      publication_date: "2010-06-01",
      created_at: iso(18, 15, 30),
      updated_at: iso(1, 12, 10),
    },
    {
      id: "paper-0003",
      user_id: DEMO_USER_ID,
      title: "Ten Simple Rules for Reproducible Computational Research",
      authors: ["Geir Kjetil Sandve", "Anton Nekrutenko", "James Taylor", "Eivind Hovig"],
      doi: "10.1371/journal.pcbi.1003285",
      source_url: "https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1003285",
      status: "Read",
      topic_ids: ["topic-repro"],
      abstract:
        "A set of practical rules for making computational research reproducible, from version control to archiving the analysis environment.",
      publication_date: "2013-11-07",
      created_at: iso(16, 11, 0),
      updated_at: iso(3, 16, 5),
    },
    {
      id: "paper-0004",
      user_id: DEMO_USER_ID,
      title: "Attention Is All You Need",
      authors: ["Ashish Vaswani", "Noam Shazeer", "Niki Parmar", "Jakob Uszkoreit"],
      doi: "10.48550/arXiv.1706.03762",
      source_url: "https://arxiv.org/abs/1706.03762",
      status: "Read",
      topic_ids: ["topic-ai-agents", "topic-memory"],
      abstract:
        "The Transformer architecture replaces recurrence with attention mechanisms and achieves state-of-the-art results on translation tasks.",
      publication_date: "2017-06-12",
      created_at: iso(14, 13, 20),
      updated_at: iso(5, 9, 0),
    },
    {
      id: "paper-0005",
      user_id: DEMO_USER_ID,
      title: "A Theory of Collective Mind: How Humans Coordinate with AI",
      authors: ["Anthropic Research"],
      doi: "10.48550/arXiv.2305.14552",
      source_url: "https://arxiv.org/abs/2305.14552",
      status: "To Read",
      topic_ids: ["topic-hci", "topic-ai-agents"],
      abstract:
        "A working theory of collective cognition and how shared goals, transparency, and legibility shape human-AI collaboration.",
      publication_date: "2023-05-24",
      created_at: iso(12, 10, 0),
      updated_at: iso(1, 8, 30),
    },
    {
      id: "paper-0006",
      user_id: DEMO_USER_ID,
      title: "The CRediT Taxonomy: Credit Where Credit Is Due",
      authors: ["Amy Brand", "Liz Allen", "Micah Altman", "Marjorie Hlava"],
      doi: "10.1087/20150211",
      source_url: "https://doi.org/10.1087/20150211",
      status: "To Read",
      topic_ids: ["topic-repro"],
      abstract:
        "A high-level taxonomy of 14 contributor roles for scholarly output, enabling transparent and comparable author credit.",
      publication_date: "2015-04-01",
      created_at: iso(9, 12, 45),
      updated_at: iso(2, 15, 20),
    },
    {
      id: "paper-0007",
      user_id: DEMO_USER_ID,
      title: "ReAct: Synergizing Reasoning and Acting in Language Models",
      authors: ["Shunyu Yao", "Jeffrey Zhao", "Dian Yu", "Nan Du"],
      doi: "10.48550/arXiv.2210.03629",
      source_url: "https://arxiv.org/abs/2210.03629",
      status: "Reading",
      topic_ids: ["topic-ai-agents"],
      abstract:
        "Interleaving reasoning traces and actions enables language models to reason, act, and observe in grounded environments.",
      publication_date: "2022-10-07",
      created_at: iso(7, 14, 10),
      updated_at: iso(0, 10, 15),
    },
  ];

  const notes: Row[] = [
    {
      id: "note-0001",
      user_id: DEMO_USER_ID,
      title: "RAG design notes",
      markdown_body:
        "# Retrieval-Augmented Generation\n\n## Core idea\n- Separate parametric memory (weights) from non-parametric memory (retrieval index).\n- The retriever and generator are trained jointly, but the index can be updated without retraining.\n\n## Open questions\n- When does retrieval help vs. hurt?\n- How should we evaluate faithfulness of generated answers?\n\n> Relevant to the AI Agents topic and the focus session on Tuesday.",
      tags: ["agent", "llm", "synthesis"],
      linked_entity_ids: ["paper-0001", "idea-0001"],
      created_at: iso(20, 10, 0),
      updated_at: iso(0, 8, 10),
    },
    {
      id: "note-0002",
      user_id: DEMO_USER_ID,
      title: "Interview prep: research narratives",
      markdown_body:
        "## One-paragraph narrative\n\nI study how people keep research knowledge coherent under cognitive load, and how tools can make uncertainty legible instead of overwhelming.\n\n## Proof points\n- Built a topic-aware research workflow.\n- Tracked 14 completed tasks this quarter.\n- Maintained a 12-day research streak.",
      tags: ["career", "narrative"],
      linked_entity_ids: ["idea-0002"],
      created_at: iso(17, 16, 30),
      updated_at: iso(1, 17, 0),
    },
    {
      id: "note-0003",
      user_id: DEMO_USER_ID,
      title: "Preregistration checklist",
      markdown_body:
        "- [ ] Specify hypotheses before analysis\n- [ ] Fix exclusion criteria\n- [ ] Commit analysis scripts to version control\n- [ ] Pre-register at OSF\n- [ ] Report both confirmatory and exploratory results",
      tags: ["repro", "methods"],
      linked_entity_ids: ["paper-0003", "topic-repro"],
      created_at: iso(15, 9, 0),
      updated_at: iso(3, 13, 0),
    },
    {
      id: "note-0004",
      user_id: DEMO_USER_ID,
      title: "Attention mechanisms literature map",
      markdown_body:
        "## Papers\n- Transformer: self-attention without recurrence.\n- ReAct: interleave reasoning and acting.\n- RAG: combine retrieval with generation.\n\n## Synthesis\nAttention solves *what to look at*; retrieval solves *what to remember*; agents solve *what to do next*.",
      tags: ["literature", "llm"],
      linked_entity_ids: ["paper-0004", "paper-0007", "idea-0003"],
      created_at: iso(13, 11, 0),
      updated_at: iso(4, 12, 0),
    },
    {
      id: "note-0005",
      user_id: DEMO_USER_ID,
      title: "Experiment sketch: legible uncertainty",
      markdown_body:
        "## Research question\nDoes surfacing confidence intervals on AI suggestions change how scholars revise drafts?\n\n## Design\n- Between-subjects, 60 participants.\n- Task: review a synthetic literature summary.\n- Measure: edit distance, time-on-task, perceived trust.\n\n## Materials needed\n- [ ] Draft summary generator\n- [ ] Confidence estimator\n- [ ] Qualtrics template",
      tags: ["experiment", "hci"],
      linked_entity_ids: ["idea-0004", "paper-0005"],
      created_at: iso(11, 13, 30),
      updated_at: iso(2, 9, 45),
    },
    {
      id: "note-0006",
      user_id: DEMO_USER_ID,
      title: "Weekly reflection",
      markdown_body:
        "## Wins\n- Completed the RAG reading task.\n- Added insights to two papers.\n- Kept the streak alive for 12 days.\n\n## Friction\n- Feeds triage takes longer than expected.\n- Need a better routine for capturing ideas while reading.",
      tags: ["reflection"],
      linked_entity_ids: [],
      created_at: iso(1, 18, 0),
      updated_at: iso(1, 18, 0),
    },
    {
      id: "note-0007",
      user_id: DEMO_USER_ID,
      title: "Quotes worth keeping",
      markdown_body:
        "> \"The goal is to make the invisible work of research visible.\"\n\n> \"Uncertainty is not the absence of knowledge; it is a property of the knowledge we have.\"",
      tags: ["quotes"],
      linked_entity_ids: [],
      created_at: iso(5, 17, 0),
      updated_at: iso(5, 17, 0),
    },
    {
      id: "note-0008",
      user_id: DEMO_USER_ID,
      title: "Agent safety reading list",
      markdown_body:
        "1. ReAct - reasoning and acting\n2. RAG - grounding answers\n3. Collective mind theory - coordination\n4. CRediT - transparent contribution",
      tags: ["safety", "agents"],
      linked_entity_ids: ["paper-0001", "paper-0005", "paper-0007"],
      created_at: iso(6, 12, 0),
      updated_at: iso(6, 12, 0),
    },
    {
      id: "note-0009",
      user_id: DEMO_USER_ID,
      title: "Methods for reproducibility",
      markdown_body:
        "- Version control for scripts and data.\n- Pin dependency versions.\n- Document environment.\n- Archive code with the paper.\n- Run checks in clean containers.",
      tags: ["repro", "methods"],
      linked_entity_ids: ["paper-0003"],
      created_at: iso(8, 10, 0),
      updated_at: iso(8, 10, 0),
    },
  ];

  const ideas: Row[] = [
    {
      id: "idea-0001",
      user_id: DEMO_USER_ID,
      title: "A topic-aware research companion",
      description:
        "A research assistant that clusters notes, papers, and tasks by topic and suggests the next high-leverage action.",
      stage: "Supported",
      linked_note_ids: ["note-0001"],
      linked_paper_ids: ["paper-0001"],
      created_at: iso(26, 10, 0),
      updated_at: iso(0, 9, 0),
    },
    {
      id: "idea-0002",
      user_id: DEMO_USER_ID,
      title: "Narrative-first portfolio for research roles",
      description:
        "Frame project work as a coherent research narrative with evidence, decisions, and lessons learned.",
      stage: "Developing",
      linked_note_ids: ["note-0002"],
      linked_paper_ids: [],
      created_at: iso(22, 14, 0),
      updated_at: iso(1, 10, 0),
    },
    {
      id: "idea-0003",
      user_id: DEMO_USER_ID,
      title: "From attention to agentic reading",
      description:
        "Study how scholars transition from reading to acting: when do they ask the literature questions and pursue evidence?",
      stage: "Seed",
      linked_note_ids: ["note-0004"],
      linked_paper_ids: ["paper-0004", "paper-0007"],
      created_at: iso(19, 15, 0),
      updated_at: iso(2, 11, 0),
    },
    {
      id: "idea-0004",
      user_id: DEMO_USER_ID,
      title: "Legible uncertainty in AI-assisted drafting",
      description:
        "Surface confidence and evidence provenance in AI drafting tools so scholars can judge what to trust.",
      stage: "Mature",
      linked_note_ids: ["note-0005"],
      linked_paper_ids: ["paper-0005"],
      created_at: iso(32, 9, 0),
      updated_at: iso(0, 12, 0),
    },
    {
      id: "idea-0005",
      user_id: DEMO_USER_ID,
      title: "Reproducibility scorecard for reading workflows",
      description:
        "A lightweight checklist that turns reproducibility best practices into reviewable reading tasks.",
      stage: "Developing",
      linked_note_ids: ["note-0003", "note-0009"],
      linked_paper_ids: ["paper-0003"],
      created_at: iso(28, 13, 0),
      updated_at: iso(3, 14, 0),
    },
    {
      id: "idea-0006",
      user_id: DEMO_USER_ID,
      title: "Coordination rituals for human-AI teams",
      description:
        "Design explicit handoff points and shared checklists for humans and agents working on the same research pipeline.",
      stage: "Seed",
      linked_note_ids: [],
      linked_paper_ids: ["paper-0005"],
      created_at: iso(10, 16, 0),
      updated_at: iso(4, 8, 0),
    },
  ];

  const tasks: Row[] = [
    {
      id: "task-0001",
      user_id: DEMO_USER_ID,
      title: "Read RAG paper and capture three takeaways",
      description: "Finish the methods section and extract reusable design decisions.",
      priority: "high",
      due_date: dateOnly(0),
      completed: false,
      category: "Reading",
      created_at: iso(20, 9, 0),
      updated_at: iso(0, 7, 30),
    },
    {
      id: "task-0002",
      user_id: DEMO_USER_ID,
      title: "Pre-register uncertainty experiment",
      description: "Draft the OSF registration before the methods review.",
      priority: "high",
      due_date: dateOnly(1),
      completed: false,
      category: "Research",
      created_at: iso(12, 11, 0),
      updated_at: iso(1, 9, 0),
    },
    {
      id: "task-0003",
      user_id: DEMO_USER_ID,
      title: "Summarize attention mechanisms cluster",
      description: "Merge the three related notes into a single synthesis note.",
      priority: "medium",
      due_date: dateOnly(2),
      completed: false,
      category: "Synthesis",
      created_at: iso(15, 10, 0),
      updated_at: iso(2, 10, 0),
    },
    {
      id: "task-0004",
      user_id: DEMO_USER_ID,
      title: "Update portfolio research narrative",
      description: "Add the weekly reflection and the completed task metrics.",
      priority: "low",
      due_date: dateOnly(4),
      completed: false,
      category: "Career",
      created_at: iso(8, 14, 0),
      updated_at: iso(3, 12, 0),
    },
    {
      id: "task-0005",
      user_id: DEMO_USER_ID,
      title: "Archive old feed items",
      description: "Triage the jobs and news feed into papers or archive.",
      priority: "low",
      due_date: dateOnly(6),
      completed: true,
      category: "Feeds",
      created_at: iso(10, 16, 0),
      updated_at: iso(4, 9, 0),
    },
    {
      id: "task-0006",
      user_id: DEMO_USER_ID,
      title: "Draft hypothesis list for HCI study",
      description: "Three falsifiable hypotheses with measures and analyses.",
      priority: "medium",
      due_date: dateOnly(3),
      completed: false,
      category: "Research",
      created_at: iso(7, 13, 0),
      updated_at: iso(0, 11, 0),
    },
    {
      id: "task-0007",
      user_id: DEMO_USER_ID,
      title: "Read CRediT taxonomy paper",
      description: "Map contributor roles to the current paper draft.",
      priority: "medium",
      due_date: dateOnly(5),
      completed: true,
      category: "Reading",
      created_at: iso(9, 12, 0),
      updated_at: iso(2, 9, 0),
    },
  ];

  const feedItems: Row[] = [
    {
      id: "feed-0001",
      user_id: DEMO_USER_ID,
      source_id: null,
      type: "paper",
      title: "Agentic workflows for literature review",
      summary:
        "New preprint proposes a multi-step agent pipeline for citation graph exploration.",
      url: "https://arxiv.org/abs/2608.00001",
      payload: { venue: "arXiv", authors: ["M. Lee", "S. Chen"] },
      status: "new",
      external_id: "arxiv2608.00001",
      published_at: iso(0, 6, 0),
      created_at: iso(0, 6, 0),
      updated_at: iso(0, 6, 0),
    },
    {
      id: "feed-0002",
      user_id: DEMO_USER_ID,
      source_id: null,
      type: "paper",
      title: "Measuring trust in AI-assisted academic writing",
      summary:
        "An empirical study of trust calibration when scholars use LLM drafting tools.",
      url: "https://doi.org/10.1000/fake-trust",
      payload: { venue: "CHI 2026", authors: ["A. Patel"] },
      status: "triaged",
      external_id: "chi2026-trust",
      published_at: iso(1, 8, 0),
      created_at: iso(1, 8, 0),
      updated_at: iso(0, 9, 0),
    },
    {
      id: "feed-0003",
      user_id: DEMO_USER_ID,
      source_id: null,
      type: "job",
      title: "Research Engineer, Knowledge Tools",
      summary:
        "Remote role building research workflows for scientists; deadline in two weeks.",
      url: "https://example.com/jobs/knowledge-tools",
      payload: { company: "Cortex Labs", location: "Remote" },
      status: "new",
      external_id: "job-cortex-2026",
      published_at: iso(1, 14, 0),
      created_at: iso(1, 14, 0),
      updated_at: iso(1, 14, 0),
    },
    {
      id: "feed-0004",
      user_id: DEMO_USER_ID,
      source_id: null,
      type: "news",
      title: "New reproducibility guidelines from major funder",
      summary:
        "A summary of updated open-science requirements for grant submissions.",
      url: "https://example.com/news/repro-guidelines",
      payload: { source: "Research Policy Brief" },
      status: "new",
      external_id: "news-repro-2026",
      published_at: iso(2, 10, 0),
      created_at: iso(2, 10, 0),
      updated_at: iso(2, 10, 0),
    },
    {
      id: "feed-0005",
      user_id: DEMO_USER_ID,
      source_id: null,
      type: "paper",
      title: "Memory-augmented retrieval for long documents",
      summary:
        "Combines external memory with retrieval to improve long-form synthesis.",
      url: "https://arxiv.org/abs/2608.00002",
      payload: { venue: "arXiv", authors: ["J. Wu", "T. Kim"] },
      status: "archived",
      external_id: "arxiv2608.00002",
      published_at: iso(4, 9, 0),
      created_at: iso(4, 9, 0),
      updated_at: iso(3, 9, 0),
    },
    {
      id: "feed-0006",
      user_id: DEMO_USER_ID,
      source_id: null,
      type: "custom",
      title: "Method note: qualitative coding with LLMs",
      summary:
        "Community draft describing a rubric for evaluating LLM-assisted coding.",
      url: "https://example.com/methods/llm-coding",
      payload: { source: "Community wiki" },
      status: "promoted",
      external_id: "wiki-llm-coding",
      published_at: iso(5, 11, 0),
      created_at: iso(5, 11, 0),
      updated_at: iso(2, 12, 0),
    },
  ];

  const focusSessions: Row[] = [
    {
      id: "focus-0001",
      user_id: DEMO_USER_ID,
      duration_seconds: 1500,
      completed_at: iso(0, 8, 0),
      created_at: iso(0, 8, 0),
      updated_at: iso(0, 8, 0),
    },
    {
      id: "focus-0002",
      user_id: DEMO_USER_ID,
      duration_seconds: 2700,
      completed_at: iso(0, 11, 0),
      created_at: iso(0, 11, 0),
      updated_at: iso(0, 11, 0),
    },
    {
      id: "focus-0003",
      user_id: DEMO_USER_ID,
      duration_seconds: 900,
      completed_at: iso(1, 9, 0),
      created_at: iso(1, 9, 0),
      updated_at: iso(1, 9, 0),
    },
    {
      id: "focus-0004",
      user_id: DEMO_USER_ID,
      duration_seconds: 2400,
      completed_at: iso(2, 10, 0),
      created_at: iso(2, 10, 0),
      updated_at: iso(2, 10, 0),
    },
  ];

  const dailyLogs: Row[] = Array.from({ length: 7 }, (_, index) => ({
    id: `daily-${String(index).padStart(2, "0")}`,
    user_id: DEMO_USER_ID,
    date: dateOnly(index),
    summary: index === 0 ? "Deep reading session and task completion." : undefined,
    xp_earned: [45, 20, 35, 55, 15, 30, 25][index],
    streak_count: 12 - index,
    created_at: iso(index, 20, 0),
  }));

  const achievements: Row[] = [
    {
      id: "ach-0001",
      user_id: DEMO_USER_ID,
      achievement_type: "first_paper",
      title: "First Paper",
      description: "Added your first research paper",
      xp_awarded: 50,
      earned_at: iso(21, 10, 0),
    },
    {
      id: "ach-0002",
      user_id: DEMO_USER_ID,
      achievement_type: "research_streak_7",
      title: "Research Streak",
      description: "7 days consecutive research activity",
      xp_awarded: 100,
      earned_at: iso(8, 10, 0),
    },
    {
      id: "ach-0003",
      user_id: DEMO_USER_ID,
      achievement_type: "task_warrior",
      title: "Task Warrior",
      description: "Completed 25 tasks",
      xp_awarded: 150,
      earned_at: iso(4, 9, 0),
    },
  ];

  const topicQuests: Row[] = [
    {
      id: "quest-0001",
      user_id: DEMO_USER_ID,
      topic_id: "topic-ai-agents",
      objective: "Review and enrich \"AI Agents for Research\"",
      target_count: 3,
      progress_count: 1,
      due_date: dateOnly(3),
      status: "active",
      created_at: iso(1, 10, 0),
      updated_at: iso(0, 9, 0),
    },
    {
      id: "quest-0002",
      user_id: DEMO_USER_ID,
      topic_id: "topic-repro",
      objective: "Review and enrich \"Reproducible Science\"",
      target_count: 2,
      progress_count: 2,
      due_date: dateOnly(8),
      status: "completed",
      created_at: iso(10, 10, 0),
      updated_at: iso(3, 9, 0),
    },
  ];

  const topicLinks = (table: string, pairs: Array<[string, string]>): Row[] =>
    pairs.map(([topicId, entityId], index) => {
      const column =
        table === "topic_notes"
          ? "note_id"
          : table === "topic_papers"
            ? "paper_id"
            : "idea_id";
      return {
        id: `${table}-${String(index + 1).padStart(3, "0")}`,
        user_id: DEMO_USER_ID,
        topic_id: topicId,
        [column]: entityId,
        created_at: iso(6, 10, 0),
      };
    });

  const topicNotes = topicLinks("topic_notes", [
    ["topic-ai-agents", "note-0001"],
    ["topic-ai-agents", "note-0004"],
    ["topic-ai-agents", "note-0008"],
    ["topic-memory", "note-0004"],
    ["topic-hci", "note-0005"],
    ["topic-repro", "note-0003"],
    ["topic-repro", "note-0009"],
    ["topic-hci", "note-0002"],
  ]);

  const topicPapers = topicLinks("topic_papers", [
    ["topic-ai-agents", "paper-0001"],
    ["topic-ai-agents", "paper-0007"],
    ["topic-memory", "paper-0002"],
    ["topic-memory", "paper-0004"],
    ["topic-hci", "paper-0002"],
    ["topic-hci", "paper-0005"],
    ["topic-repro", "paper-0003"],
    ["topic-repro", "paper-0006"],
  ]);

  const topicIdeas = topicLinks("topic_ideas", [
    ["topic-ai-agents", "idea-0001"],
    ["topic-ai-agents", "idea-0003"],
    ["topic-memory", "idea-0003"],
    ["topic-hci", "idea-0004"],
    ["topic-hci", "idea-0006"],
    ["topic-repro", "idea-0005"],
  ]);

  return {
    user_profiles: [userProfile],
    topics,
    papers,
    notes,
    ideas,
    tasks,
    feed_items: feedItems,
    focus_sessions: focusSessions,
    daily_logs: dailyLogs,
    research_achievements: achievements,
    topic_quests: topicQuests,
    topic_notes: topicNotes,
    topic_papers: topicPapers,
    topic_ideas: topicIdeas,
  };
}

export function generateId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

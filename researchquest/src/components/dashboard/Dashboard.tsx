import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  Plus,
  Flame,
  Award,
  Star,
  CheckSquare,
  BookOpen,
  Lightbulb,
  Hash,
  Target,
  Clock,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Layers,
  Medal,
  TrendingUp,
  Gauge,
  ListChecks,
} from "lucide-react";
import { useAppStore } from "../../store/appStore";
import { useShallow } from "zustand/react/shallow";
import { getLevelTitle } from "../../utils/gamification";
import { ListSkeleton } from "../ui/Skeleton";
import { getTopN } from "../../utils/collections";
import { useTasks } from "../../hooks/useTasks";
import { useTopics } from "../../hooks/useTopics";
import { useGamificationDashboard } from "../../hooks/useGamificationDashboard";
import {
  DAILY_MISSIONS,
  useDailyMissionsStore,
} from "../../store/dailyMissionsStore";
import { auditWorkspace } from "../../utils/adversarialAnalysis";
import { ResearchRadar } from "./ResearchRadar";
import { SprintBoard } from "./SprintBoard";
import { WorkspaceAuditDialog } from "../analysis/WorkspaceAuditDialog";
import type { Note, Paper, Idea, TopicWithCounts, Task } from "../../types/database";

const STAGE_STYLES: Record<string, string> = {
  Seed: "bg-bg-elevated text-text-secondary border border-border-subtle",
  Developing: "bg-gold-soft text-gold-strong border border-gold/20",
  Supported: "bg-blue-soft text-blue-strong border border-blue/20",
  Mature: "bg-violet-soft text-violet-strong border border-violet/20",
};

const STATUS_STYLES: Record<string, string> = {
  "To Read": "bg-gold-soft text-gold-strong border border-gold/20",
  Reading: "bg-blue-soft text-blue-strong border border-blue/20",
  Read: "bg-success-bg text-success border border-success/20",
};

function stageStyle(stage: string): string {
  return STAGE_STYLES[stage] ?? STAGE_STYLES.Seed;
}

function statusStyle(status: string): string {
  return STATUS_STYLES[status] ?? STATUS_STYLES["To Read"];
}

function NotePreview({ note, onOpen }: { note: Note; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="surface-card group w-full p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
    >
      <div className="flex items-start gap-3">
        <span className="icon-tile bg-blue-soft text-blue-strong">
          <FileText className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate text-sm font-semibold text-text-primary group-hover:text-accent-strong transition-colors">
              {note.title || "Untitled Note"}
            </h3>
            <span className="shrink-0 text-caption text-text-tertiary">
              {new Date(note.updated_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-small text-text-secondary">
            {note.markdown_body.slice(0, 160) || "No content"}
          </p>
          {note.tags && note.tags.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {note.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-border-subtle bg-bg-elevated px-2 py-0.5 text-caption text-text-secondary"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

function IdeaPreview({ idea, onOpen }: { idea: Idea; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="surface-card group w-full p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
    >
      <div className="flex items-start gap-3">
        <span className="icon-tile bg-gold-soft text-gold-strong">
          <Lightbulb className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate text-sm font-semibold text-text-primary">
              {idea.title}
            </h3>
            <span className={`status-chip shrink-0 ${stageStyle(idea.stage)}`}>
              {idea.stage}
            </span>
          </div>
          {idea.description && (
            <p className="mt-1 line-clamp-2 text-small text-text-secondary">
              {idea.description}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

function TopicPreview({ topic, onOpen }: { topic: TopicWithCounts; onOpen: () => void }) {
  const items = topic.note_count + topic.paper_count + topic.idea_count;
  return (
    <button
      onClick={onOpen}
      className="surface-card group w-full p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
    >
      <div className="flex items-center gap-3">
        <span className="icon-tile bg-accent-soft text-accent-strong">
          <Hash className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-text-primary">
            {topic.name}
          </h3>
          <p className="text-caption text-text-tertiary">
            {topic.note_count} notes · {topic.paper_count} papers ·{" "}
            {topic.idea_count} ideas
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-bg-elevated px-2.5 py-1 text-caption font-medium text-text-secondary">
          {items} items
        </span>
      </div>
    </button>
  );
}

function PaperPreview({ paper, onOpen }: { paper: Paper; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="surface-card group w-full p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
    >
      <div className="flex items-start gap-3">
        <span className="icon-tile bg-violet-soft text-violet-strong">
          <BookOpen className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h4 className="truncate text-sm font-semibold text-text-primary">
              {paper.title}
            </h4>
            <span className={`status-chip shrink-0 ${statusStyle(paper.status)}`}>
              {paper.status}
            </span>
          </div>
          <p className="mt-1 truncate text-caption text-text-secondary">
            {paper.authors?.join(", ") || "Unknown Author"}
          </p>
        </div>
      </div>
    </button>
  );
}

function TaskPreview({ task, onOpen }: { task: Task; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="surface-card group w-full p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
    >
      <div className="flex items-center gap-3">
        <span className="icon-tile bg-coral-soft text-coral-strong">
          <CheckSquare className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h4
            className={`truncate text-sm font-semibold ${
              task.completed
                ? "text-text-tertiary line-through"
                : "text-text-primary"
            }`}
          >
            {task.title}
          </h4>
          <p className="mt-0.5 text-caption text-text-tertiary">
            {task.category || "Task"} · {task.priority}
          </p>
        </div>
        {task.due_date && (
          <span className="shrink-0 text-caption font-medium text-text-secondary">
            {new Date(task.due_date).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </span>
        )}
      </div>
    </button>
  );
}

function ProgressRing({
  value,
  size = 96,
  stroke = 9,
  label,
  tone = "accent",
}: {
  value: number;
  size?: number;
  stroke?: number;
  label: string;
  tone?: "accent" | "gold" | "violet" | "coral";
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;
  const color =
    tone === "gold"
      ? "var(--gold)"
      : tone === "violet"
        ? "var(--violet)"
        : tone === "coral"
          ? "var(--coral)"
          : "var(--accent)";
  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--bg-elevated)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="font-serif text-xl font-bold text-text-primary">
            {Math.round(value)}%
          </div>
          <div className="text-caption text-text-tertiary">{label}</div>
        </div>
      </div>
    </div>
  );
}

export function Dashboard() {
  const {
    user,
    notes,
    papers,
    ideas,
    topics,
    dashboardLibrary,
    focusSessionSecondsToday,
    notesLoading,
    papersLoading,
    ideasLoading,
    topicsLoading,
    setCurrentView,
    setSelectedNote,
    setSelectedPaper,
    setSelectedIdea,
    setSelectedTopic,
  } = useAppStore(
    useShallow((state) => ({
      user: state.user,
      notes: state.notes,
      papers: state.papers,
      ideas: state.ideas,
      topics: state.topics,
      dashboardLibrary: state.dashboardLibrary,
      focusSessionSecondsToday: state.focusSessionSecondsToday,
      notesLoading: state.notesLoading,
      papersLoading: state.papersLoading,
      ideasLoading: state.ideasLoading,
      topicsLoading: state.topicsLoading,
      setCurrentView: state.setCurrentView,
      setSelectedNote: state.setSelectedNote,
      setSelectedPaper: state.setSelectedPaper,
      setSelectedIdea: state.setSelectedIdea,
      setSelectedTopic: state.setSelectedTopic,
    })),
  );

  const { tasks } = useTasks(user?.id);
  const { activeQuest } = useTopics(user?.id);
  const { weekly, achievements, loading: gamificationLoading } =
    useGamificationDashboard(user?.id);
  const missionProgress = useDailyMissionsStore((state) => state.progress);
  const missionCompleted = useDailyMissionsStore((state) => state.completedToday);
  const [showAudit, setShowAudit] = useState(false);

  useEffect(() => {
    useDailyMissionsStore.getState().resetIfNeeded();
  }, []);

  const healthAudit = useMemo(
    () => auditWorkspace(notes, papers, ideas, Object.values(topics)),
    [notes, papers, ideas, topics],
  );
  const missionPossibleXp = DAILY_MISSIONS.reduce((sum, mission) => sum + mission.xp, 0);
  const missionEarnedXp = DAILY_MISSIONS.filter(
    (mission) => (missionProgress[mission.id] ?? 0) >= mission.target,
  ).reduce((sum, mission) => sum + mission.xp, 0);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const stats = useMemo(() => {
    if (!user) return null;
    const xpInLevel = (user.total_xp || 0) % 500;
    const progress = Math.min(100, (xpInLevel / 500) * 100);
    return {
      level: user.current_level || 1,
      title: getLevelTitle(user.current_level || 1),
      xp: user.total_xp || 0,
      streak: user.current_streak ?? 0,
      progress,
      xpInLevel,
    };
  }, [user]);

  const focusMinutesToday = Math.floor(focusSessionSecondsToday / 60);
  const focusProgress = Math.min(100, (focusMinutesToday / 120) * 100);

  const { pendingTaskCount, completedTaskCount } = useMemo(() => {
    let pending = 0;
    let completed = 0;
    for (let i = 0; i < tasks.length; i++) {
      if (tasks[i].completed) {
        completed++;
      } else {
        pending++;
      }
    }
    return { pendingTaskCount: pending, completedTaskCount: completed };
  }, [tasks]);

  const notesCount = notes.length > 0 ? notes.length : dashboardLibrary.counts.notes;
  const papersCount = papers.length > 0 ? papers.length : dashboardLibrary.counts.papers;
  const ideasCount = ideas.length > 0 ? ideas.length : dashboardLibrary.counts.ideas;
  const notesSectionLoading = notesLoading || (dashboardLibrary.loading && notes.length === 0);
  const papersSectionLoading = papersLoading || (dashboardLibrary.loading && papers.length === 0);
  const ideasSectionLoading = ideasLoading || (dashboardLibrary.loading && ideas.length === 0);

  const recentNotes = useMemo(() => {
    if (notes.length === 0) return dashboardLibrary.recentNotes;
    return getTopN(notes, 3, (a, b) =>
      b.updated_at > a.updated_at ? 1 : b.updated_at < a.updated_at ? -1 : 0,
    );
  }, [dashboardLibrary.recentNotes, notes]);

  const readingList = useMemo(() => {
    if (papers.length === 0) return dashboardLibrary.readingList;
    return getTopN(
      papers,
      3,
      (a, b) =>
        b.created_at > a.created_at ? 1 : b.created_at < a.created_at ? -1 : 0,
      (p) => p.status === "To Read",
    );
  }, [dashboardLibrary.readingList, papers]);

  const activeIdeas = useMemo(() => {
    if (ideas.length === 0) return dashboardLibrary.activeIdeas;
    return getTopN(ideas, 3, (a, b) =>
      b.updated_at > a.updated_at ? 1 : b.updated_at < a.updated_at ? -1 : 0,
    );
  }, [dashboardLibrary.activeIdeas, ideas]);

  const activeTopics = useMemo(() => {
    return getTopN(Object.values(topics), 3, (a, b) =>
      b.updated_at > a.updated_at ? 1 : b.updated_at < a.updated_at ? -1 : 0,
    );
  }, [topics]);

  const upcomingTasks = useMemo(() => {
    return getTopN(
      tasks,
      3,
      (a, b) => {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date > b.due_date ? 1 : a.due_date < b.due_date ? -1 : 0;
      },
      (t) => !t.completed,
    );
  }, [tasks]);

  const navigateTo = (
    view: "notes" | "papers" | "focus" | "tasks" | "ideas" | "topics",
  ) => {
    setCurrentView(view);
    window.history.pushState(null, "", `/${view}`);
  };

  if (!user) {
    return null;
  }

  const openNote = (note: Note) => {
    setSelectedNote(note);
    navigateTo("notes");
    window.history.pushState(null, "", `/notes/${note.id}`);
  };

  const openPaper = (paper: Paper) => {
    setSelectedPaper(paper);
    navigateTo("papers");
    window.history.pushState(null, "", `/papers/${paper.id}`);
  };

  const openIdea = (idea: Idea) => {
    setSelectedIdea(idea);
    navigateTo("ideas");
    window.history.pushState(null, "", `/ideas/${idea.id}`);
  };

  const openTopic = (topic: TopicWithCounts) => {
    setSelectedTopic(topic);
    navigateTo("topics");
    window.history.pushState(null, "", `/topics/${topic.id}`);
  };

  const questProgress = activeQuest
    ? Math.min(100, (activeQuest.progress_count / Math.max(1, activeQuest.target_count)) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-10 p-6 md:p-10">
      {/* Hero */}
      <section className="hero-ambient surface-panel relative overflow-hidden p-7 md:p-10">
        <div className="relative z-10 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-center">
          <div className="max-w-3xl">
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="status-chip bg-accent-soft text-accent-strong">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                ResearchQuest
              </span>
              <span className="status-chip bg-bg-elevated text-text-secondary">
                Level {stats?.level} · {stats?.title}
              </span>
            </div>
            <h1 className="font-serif text-title font-bold text-text-primary md:text-hero">
              {greeting}, {user.username || "Scholar"}.
            </h1>
            <p className="mt-4 max-w-2xl text-body-lg text-text-secondary">
              Shape today&apos;s inquiry. Your reading queue, active ideas, and
              next research move are all in view.
            </p>
            <div
              className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
              aria-label="Dashboard actions"
            >
              <button
                onClick={() => navigateTo("focus")}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-text-primary px-5 text-sm font-semibold text-bg-base shadow-lift transition-transform hover:-translate-y-0.5 hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
              >
                <Target className="h-4 w-4" aria-hidden="true" />
                Start Focus Session
              </button>
              <button
                onClick={() => navigateTo("notes")}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border-moderate bg-bg-surface px-5 text-sm font-semibold text-text-primary shadow-sm transition-all hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lift focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Open Notes
              </button>
              <button
                onClick={() => navigateTo("papers")}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-text-secondary transition-colors hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
              >
                Research Library
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Command deck */}
          <aside className="surface-card p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-serif text-lg font-bold text-text-primary">
                Command deck
              </h2>
              <span className="section-kicker">Today</span>
            </div>
            <div className="flex items-center justify-center gap-6">
              <ProgressRing
                value={stats?.progress ?? 0}
                label="XP to level"
                tone="accent"
              />
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <span className="icon-tile bg-gold-soft text-gold-strong">
                    <Flame className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <div className="text-lg font-bold text-text-primary">
                      {stats?.streak}{" "}
                      {stats?.streak === 1 ? "day" : "days"}
                    </div>
                    <div className="text-caption text-text-tertiary">Streak</div>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="icon-tile bg-violet-soft text-violet-strong">
                    <Clock className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <div className="text-lg font-bold text-text-primary">
                      {focusMinutesToday} min
                    </div>
                    <div className="text-caption text-text-tertiary">Focus today</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-caption font-semibold uppercase tracking-wider text-text-secondary">
                  {stats?.xpInLevel} XP in level
                </span>
                <span className="text-caption text-text-tertiary">500 XP</span>
              </div>
              <div className="progress-track h-2 w-full">
                <div
                  className="progress-fill"
                  style={{ width: `${stats?.progress ?? 0}%` }}
                />
              </div>
            </div>
            {activeQuest && (
              <div className="mt-6 rounded-lg border border-border-subtle bg-bg-elevated p-3.5">
                <div className="flex items-center gap-2 text-caption font-semibold uppercase tracking-wider text-text-secondary">
                  <ShieldCheck className="h-3.5 w-3.5 text-accent-strong" aria-hidden="true" />
                  Active quest
                </div>
                <p className="mt-1.5 text-small font-medium text-text-primary">
                  {activeQuest.objective}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="progress-track h-1.5 flex-1">
                    <div
                      className="progress-fill"
                      style={{ width: `${questProgress}%` }}
                    />
                  </div>
                  <span className="text-caption font-medium text-text-secondary">
                    {activeQuest.progress_count}/{activeQuest.target_count}
                  </span>
                </div>
              </div>
            )}
          </aside>
        </div>
      </section>

      {/* Stats strip */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Research stats">
        <div className="surface-card flex items-center gap-4 p-5">
          <span className="icon-tile bg-accent-soft text-accent-strong">
            <Award className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <div className="font-serif text-2xl font-bold text-text-primary">
              {stats?.level}
            </div>
            <div className="text-caption text-text-tertiary">{stats?.title}</div>
          </div>
          <span className="ml-auto text-caption text-text-secondary">
            {stats?.xp.toLocaleString()} XP
          </span>
        </div>
        <div className="surface-card flex items-center gap-4 p-5">
          <span className="icon-tile bg-gold-soft text-gold-strong">
            <Star className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <div className="font-serif text-2xl font-bold text-text-primary">
              {stats?.streak}{" "}
              <span className="text-base font-sans font-medium">
                {stats?.streak === 1 ? "day" : "days"}
              </span>
            </div>
            <div className="text-caption text-text-tertiary">Research streak</div>
          </div>
        </div>
        <div className="surface-card flex items-center gap-4 p-5">
          <span className="icon-tile bg-violet-soft text-violet-strong">
            <Target className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <div className="font-serif text-2xl font-bold text-text-primary">
              {focusMinutesToday} <span className="text-base font-sans font-medium">min</span>
            </div>
            <div className="text-caption text-text-tertiary">Focus today</div>
          </div>
          <div className="ml-auto hidden sm:block">
            <ProgressRing value={focusProgress} size={52} stroke={6} label="Focus goal" />
          </div>
        </div>
        <div className="surface-card flex items-center gap-4 p-5">
          <span className="icon-tile bg-coral-soft text-coral-strong">
            <Layers className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <div className="font-serif text-2xl font-bold text-text-primary">
              {pendingTaskCount} <span className="text-base font-sans font-medium">open</span>
            </div>
            <div className="text-caption text-text-tertiary">
              {completedTaskCount} completed{" "}
              {completedTaskCount === 1 ? "task" : "tasks"}
            </div>
          </div>
        </div>
      </section>

      {/* Research radar + health + missions */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <ResearchRadar
          notes={notes}
          papers={papers}
          ideas={ideas}
          topics={Object.values(topics)}
        />

        <div className="space-y-4">
          <div className="surface-panel p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-serif text-lg font-bold text-text-primary">
                  Workspace health
                </h2>
                <p className="mt-0.5 text-caption text-text-tertiary">
                  Adversarial audit across {papers.length + ideas.length} records
                </p>
              </div>
              <span className="icon-tile bg-accent-soft text-accent-strong">
                <Gauge className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
            <div className="flex items-center gap-5">
              <ProgressRing
                value={healthAudit.score}
                size={84}
                stroke={8}
                label="Health"
                tone={
                  healthAudit.score >= 78
                    ? "accent"
                    : healthAudit.score >= 55
                      ? "gold"
                      : "coral"
                }
              />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-caption font-medium text-text-secondary">
                    High severity
                  </span>
                  <span className="text-caption font-bold text-coral-strong">
                    {healthAudit.severityCounts.high}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-caption font-medium text-text-secondary">
                    Evidence gaps
                  </span>
                  <span className="text-caption font-bold text-gold-strong">
                    {healthAudit.categoryCounts.evidence_gap}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-caption font-medium text-text-secondary">
                    Risks
                  </span>
                  <span className="text-caption font-bold text-violet-strong">
                    {healthAudit.categoryCounts.risk}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowAudit(true)}
              className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-text-primary px-4 text-sm font-semibold text-bg-base shadow-lift transition-transform hover:-translate-y-0.5 hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Open full audit
            </button>
          </div>

          <div className="surface-panel p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-serif text-lg font-bold text-text-primary">
                  Daily missions
                </h2>
                <p className="mt-0.5 text-caption text-text-tertiary">
                  {missionCompleted}/{DAILY_MISSIONS.length} complete · {missionEarnedXp}/
                  {missionPossibleXp} XP
                </p>
              </div>
              <span className="icon-tile bg-gold-soft text-gold-strong">
                <ListChecks className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
            <div className="space-y-3">
              {DAILY_MISSIONS.map((mission) => {
                const progress = Math.min(mission.target, missionProgress[mission.id] ?? 0);
                const done = progress >= mission.target;
                return (
                  <div key={mission.id} className="flex items-center gap-3">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-caption font-bold ${
                        done
                          ? "border-success/30 bg-success-bg text-success"
                          : "border-border-moderate bg-bg-elevated text-text-tertiary"
                      }`}
                    >
                      {done ? "✓" : progress}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`truncate text-small font-medium ${
                            done ? "text-text-tertiary line-through" : "text-text-primary"
                          }`}
                        >
                          {mission.label}
                        </span>
                        <span className="shrink-0 text-caption font-semibold text-text-secondary">
                          +{mission.xp} XP
                        </span>
                      </div>
                      <div className="progress-track mt-1.5 h-1.5 w-full">
                        <div
                          className={done ? "progress-fill bg-success" : "progress-fill"}
                          style={{ width: `${(progress / mission.target) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Sprint board */}
      <section aria-label="Weekly sprint">
        <SprintBoard />
      </section>

      {/* Gameplay band */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="surface-panel p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-serif text-lg font-bold text-text-primary">
                Weekly momentum
              </h2>
              <p className="mt-0.5 text-caption text-text-tertiary">
                XP earned across the last 7 days
              </p>
            </div>
            <span className="icon-tile bg-accent-soft text-accent-strong">
              <TrendingUp className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          <div className="flex h-44 w-full items-end gap-3">
            {weekly.map((point, index) => {
              const maxXp = Math.max(1, ...weekly.map((item) => item.xp));
              const height = Math.max(8, Math.round((point.xp / maxXp) * 132));
              return (
                <div
                  key={point.day}
                  className="group flex min-w-0 flex-1 flex-col items-center gap-2"
                  title={`${point.label}: ${point.xp} XP`}
                >
                  <div className="relative flex w-full flex-1 items-end justify-center">
                    <div
                      className={`w-full max-w-9 rounded-t-md transition-all duration-700 ${
                        index === weekly.length - 1
                          ? "brand-gradient shadow-glow"
                          : "bg-accent-soft group-hover:bg-accent/40"
                      }`}
                      style={{ height }}
                    />
                  </div>
                  <div className="text-caption font-medium text-text-tertiary">
                    {point.label}
                  </div>
                  <div className="text-caption font-bold text-text-secondary">
                    {point.xp}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="surface-panel p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-serif text-lg font-bold text-text-primary">
                Recent achievements
              </h2>
              <p className="mt-0.5 text-caption text-text-tertiary">
                Milestones unlocked on this run
              </p>
            </div>
            <span className="icon-tile bg-gold-soft text-gold-strong">
              <Medal className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          {gamificationLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((index) => (
                <div key={index} className="h-14 animate-pulse rounded-lg bg-bg-elevated" />
              ))}
            </div>
          ) : achievements.length === 0 ? (
            <div className="surface-card p-6 text-center">
              <p className="font-serif italic text-text-tertiary">
                No achievements yet. Keep going.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {achievements.map((achievement) => (
                <div
                  key={achievement.id}
                  className="surface-card flex items-center gap-3 p-3.5"
                >
                  <span className="icon-tile bg-gold-soft text-gold-strong">
                    <Medal className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-small font-semibold text-text-primary">
                      {achievement.title}
                    </div>
                    <div className="truncate text-caption text-text-tertiary">
                      {achievement.description}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-gold-soft px-2.5 py-1 text-caption font-bold text-gold-strong">
                    +{achievement.xp_awarded} XP
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Library counts */}
      <div
        className="surface-panel flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3.5 text-small text-text-secondary"
        aria-label="Library counts"
      >
        <span className="inline-flex items-center gap-2">
          <FileText className="h-4 w-4 text-blue-strong" aria-hidden="true" />
          Notes {notesCount}
        </span>
        <span className="inline-flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-violet-strong" aria-hidden="true" />
          Papers {papersCount}
        </span>
        <span className="inline-flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-gold-strong" aria-hidden="true" />
          Ideas {ideasCount}
        </span>
        <span className="inline-flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-coral-strong" aria-hidden="true" />
          Tasks {tasks.length}
        </span>
        <span className="inline-flex items-center gap-2">
          <Hash className="h-4 w-4 text-accent-strong" aria-hidden="true" />
          Topics {Object.keys(topics).length}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="space-y-10">
          {/* Recent Notes */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-serif text-lg font-bold text-text-primary">
                Recent Notes
              </h2>
              <button
                onClick={() => navigateTo("notes")}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-small font-medium text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                View all <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="sr-only" role="status" aria-live="polite">
              {!notesSectionLoading && recentNotes.length === 0 ? "No notes yet" : ""}
            </div>
            <div className="space-y-3">
              {notesSectionLoading ? (
                <ListSkeleton count={3} itemType="note" />
              ) : recentNotes.length === 0 ? (
                <div className="surface-card p-6 text-center">
                  <p className="font-serif italic text-text-tertiary">No notes yet</p>
                  <button
                    onClick={() => navigateTo("notes")}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border-moderate bg-bg-surface px-3 py-1.5 text-small font-medium text-text-primary transition-colors hover:border-border-strong"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" /> Create Note
                  </button>
                </div>
              ) : (
                recentNotes.map((note) => (
                  <NotePreview key={note.id} note={note} onOpen={() => openNote(note)} />
                ))
              )}
            </div>
          </section>

          {/* Active Ideas */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-serif text-lg font-bold text-text-primary">
                Active Ideas
              </h2>
              <button
                onClick={() => navigateTo("ideas")}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-small font-medium text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                View Board <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="sr-only" role="status" aria-live="polite">
              {!ideasSectionLoading && activeIdeas.length === 0 ? "No active ideas" : ""}
            </div>
            <div className="space-y-3">
              {ideasSectionLoading ? (
                <ListSkeleton count={3} itemType="idea" />
              ) : activeIdeas.length === 0 ? (
                <div className="surface-card p-6 text-center">
                  <p className="font-serif italic text-text-tertiary">No active ideas.</p>
                  <button
                    onClick={() => navigateTo("ideas")}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border-moderate bg-bg-surface px-3 py-1.5 text-small font-medium text-text-primary transition-colors hover:border-border-strong"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" /> Add Idea
                  </button>
                </div>
              ) : (
                activeIdeas.map((idea) => (
                  <IdeaPreview key={idea.id} idea={idea} onOpen={() => openIdea(idea)} />
                ))
              )}
            </div>
          </section>

          {/* Active Topics */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-serif text-lg font-bold text-text-primary">
                Active Topics
              </h2>
              <button
                onClick={() => navigateTo("topics")}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-small font-medium text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                View Directory <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="sr-only" role="status" aria-live="polite">
              {!topicsLoading && activeTopics.length === 0 ? "No active topics" : ""}
            </div>
            <div className="space-y-3">
              {topicsLoading ? (
                <ListSkeleton count={3} itemType="note" />
              ) : activeTopics.length === 0 ? (
                <div className="surface-card p-6 text-center">
                  <p className="font-serif italic text-text-tertiary">No active topics.</p>
                  <button
                    onClick={() => navigateTo("topics")}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border-moderate bg-bg-surface px-3 py-1.5 text-small font-medium text-text-primary transition-colors hover:border-border-strong"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" /> Add Topic
                  </button>
                </div>
              ) : (
                activeTopics.map((topic) => (
                  <TopicPreview key={topic.id} topic={topic} onOpen={() => openTopic(topic)} />
                ))
              )}
            </div>
          </section>
        </div>

        <div className="space-y-10">
          {/* Up next */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-serif text-lg font-bold text-text-primary">
                Up Next to Read
              </h2>
              <button
                onClick={() => navigateTo("papers")}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-small font-medium text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                View Library <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="sr-only" role="status" aria-live="polite">
              {!papersSectionLoading && readingList.length === 0
                ? "Your reading list is empty"
                : ""}
            </div>
            <div className="space-y-3">
              {papersSectionLoading ? (
                <ListSkeleton count={3} itemType="paper" />
              ) : readingList.length === 0 ? (
                <div className="surface-card p-6 text-center">
                  <p className="font-serif italic text-text-tertiary">
                    Your reading list is empty.
                  </p>
                  <button
                    onClick={() => navigateTo("papers")}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border-moderate bg-bg-surface px-3 py-1.5 text-small font-medium text-text-primary transition-colors hover:border-border-strong"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" /> Add Paper
                  </button>
                </div>
              ) : (
                readingList.map((paper) => (
                  <PaperPreview key={paper.id} paper={paper} onOpen={() => openPaper(paper)} />
                ))
              )}
            </div>
          </section>

          {/* Upcoming tasks */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-serif text-lg font-bold text-text-primary">
                Upcoming Tasks
              </h2>
              <button
                onClick={() => navigateTo("tasks")}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-small font-medium text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                Task Manager <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-3">
              {upcomingTasks.length === 0 && tasks.length === 0 ? (
                <div className="surface-card p-6 text-center">
                  <p className="font-serif italic text-text-tertiary">
                    You&apos;re clear. Choose a focus session when you&apos;re ready.
                  </p>
                </div>
              ) : upcomingTasks.length === 0 ? (
                <div className="surface-card p-6 text-center">
                  <p className="font-serif italic text-text-tertiary">
                    All tasks complete. Nice work.
                  </p>
                </div>
              ) : (
                upcomingTasks.map((task) => (
                  <TaskPreview
                    key={task.id}
                    task={task}
                    onOpen={() => navigateTo("tasks")}
                  />
                ))
              )}
            </div>
          </section>
        </div>
      </div>

      <WorkspaceAuditDialog open={showAudit} onOpenChange={setShowAudit} />
    </div>
  );
}

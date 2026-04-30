import { logger } from "../../utils/logger";
import {
  FileText,
  Lightbulb,
  Target,
  CheckSquare,
  Plus,
  X,
  Hash,
  BookOpen,
} from "lucide-react";
import {
  MagnifyingGlassIcon,
} from "@radix-ui/react-icons";
import { useAppStore } from "../../store/appStore";
import { useShallow } from "zustand/react/shallow";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import { useNotes } from "../../hooks/useNotes";
import { usePapers } from "../../hooks/usePapers";
import { useIdeas } from "../../hooks/useIdeas";
import { NoteList } from "../entities/NoteList";
import { PaperList } from "../entities/PaperList";
import { IdeaList } from "../entities/IdeaList";
import type {
  ReadingStatus,
  IdeaStage,
  Note,
  Paper,
  Idea,
} from "../../types/database";
import { useGamificationStore } from "../../store/gamificationStore";
import { formatTimeUntil } from "../../utils/time";
import { deriveTitleFromMarkdown } from "../../utils/text";
import { toast } from "sonner";
import { FocusStudioWidget } from "./FocusStudioWidget";
import { AddIdeaDialog } from "../ideas/AddIdeaDialog";

const TABS = [
  { id: "notes" as const, label: "Notes", icon: FileText },
  { id: "papers" as const, label: "Papers", icon: BookOpen },
  { id: "ideas" as const, label: "Ideas", icon: Lightbulb },
  { id: "tasks" as const, label: "Tasks", icon: CheckSquare },
  { id: "topics" as const, label: "Topics", icon: Hash },
  { id: "focus" as const, label: "Focus", icon: Target },
];

interface DeadlinePreview {
  id: string;
  title: string;
  due_date: string;
}

interface LeftSidebarProps {
  onNavigate?: () => void;
}

type SidebarSearchState = Record<
  "notes" | "papers" | "ideas" | "tasks" | "focus",
  string
>;

function parseQuickIdeaInput(
  input: string,
): { title: string; description?: string } | null {
  const normalized = input.trim();
  if (!normalized) {
    return null;
  }

  const lineSplit = normalized.split(/\n+/);
  if (lineSplit.length > 1) {
    const [firstLine, ...rest] = lineSplit;
    const description = rest.join(" ").trim();
    return {
      title: firstLine.trim(),
      description: description || undefined,
    };
  }

  const delimiters = [" — ", " – ", " - ", ": "];
  for (const delimiter of delimiters) {
    if (normalized.includes(delimiter)) {
      const [maybeTitle, maybeDescription] = normalized.split(delimiter);
      const title = maybeTitle.trim();
      const description = maybeDescription.trim();
      if (title && description) {
        return { title, description };
      }
    }
  }

  return { title: normalized };
}

export function LeftSidebar({ onNavigate }: LeftSidebarProps = {}) {
  // ⚡ PERFORMANCE OPTIMIZATION:
  // Using useShallow to prevent unnecessary re-renders of the entire LeftSidebar
  // when unrelated properties in the global appStore change.
  const {
    currentView,
    setCurrentView,
    setUserProfile,
    setSelectedNote,
    setSelectedPaper,
    setSelectedIdea,
    selectedNote,
    selectedPaper,
    selectedIdea,
  } = useAppStore(
    useShallow((state) => ({
      currentView: state.currentView,
      setCurrentView: state.setCurrentView,
      setUserProfile: state.setUser,
      setSelectedNote: state.setSelectedNote,
      setSelectedPaper: state.setSelectedPaper,
      setSelectedIdea: state.setSelectedIdea,
      selectedNote: state.selectedNote,
      selectedPaper: state.selectedPaper,
      selectedIdea: state.selectedIdea,
    }))
  );
  const activeBoost = useGamificationStore((state) => state.activeBoost);
  const boostCountdown = useGamificationStore((state) => state.boostCountdown);
  const hydrateFromProfile = useGamificationStore(
    (state) => state.hydrateFromProfile,
  );
  const [searchQueries, setSearchQueries] = useState<SidebarSearchState>({
    notes: "",
    papers: "",
    ideas: "",
    tasks: "",
    focus: "",
  });
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [todayXP, setTodayXP] = useState(0);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<DeadlinePreview[]>(
    [],
  );
  const [isAddIdeaDialogOpen, setIsAddIdeaDialogOpen] = useState(false);
  const realtimeChannelsRef = useRef<RealtimeChannel[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // URL-based navigation handler
  const handleTabClick = (tabId: typeof currentView) => {
    setCurrentView(tabId);

    // Clear selected items when switching views to show default content
    if (tabId === "papers") {
      setSelectedPaper(null);
    } else if (tabId === "ideas") {
      setSelectedIdea(null);
    } else if (tabId === "notes") {
      setSelectedNote(null);
    }

    const newUrl = tabId === "notes" ? "/" : `/${tabId}`;
    window.history.pushState(null, "", newUrl);
    onNavigate?.();
  };

  // Get hooks
  const {
    notes,
    loading: notesLoading,
    createNote,
    updateNote,
    deleteNote,
    restoreNote,
  } = useNotes(userId);
  const {
    papers,
    loading: papersLoading,
    updatePaper,
    deletePaper,
    restorePaper,
  } = usePapers(userId);
  const {
    ideas,
    loading: ideasLoading,
    createIdea,
    updateIdea,
    deleteIdea,
    restoreIdea,
  } = useIdeas(userId);
  // Determine current loading state
  const loading = useMemo(() => {
    if (currentView === "notes") return notesLoading;
    if (currentView === "papers") return papersLoading;
    if (currentView === "ideas") return ideasLoading;
    return false;
  }, [currentView, ideasLoading, notesLoading, papersLoading]);

  const showSidebarSearch = currentView !== "tasks" && currentView !== "focus" && currentView !== "topics";

  useEffect(() => {
    let isMounted = true;

    const clearRealtimeChannels = () => {
      realtimeChannelsRef.current.forEach((channel) => {
        try {
          channel.unsubscribe();
        } catch (unsubscribeError) {
          logger.error(
            "Failed to unsubscribe from Supabase channel",
            unsubscribeError instanceof Error ? unsubscribeError.message : "Unknown error",
          );
        }
      });
      realtimeChannelsRef.current = [];
    };

    const fetchTodayXp = async (userId: string) => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("daily_logs")
        .select("xp_earned")
        .eq("user_id", userId)
        .eq("date", today)
        .maybeSingle();

      if (!isMounted) {
        return;
      }

      if (error) {
        logger.error("Failed to fetch today's XP:", error);
        return;
      }

      if (data) {
        setTodayXP(data.xp_earned);
      } else {
        setTodayXP(0);
      }
    };

    const fetchUpcomingDeadlines = async (userId: string) => {
      const now = new Date();
      const horizon = new Date();
      horizon.setDate(now.getDate() + 7);

      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, due_date, status")
        .eq("user_id", userId)
        .neq("status", "completed")
        .neq("status", "done")
        .not("due_date", "is", null)
        .gte("due_date", now.toISOString())
        .lte("due_date", horizon.toISOString())
        .order("due_date", { ascending: true })
        .limit(5);

      if (!isMounted) {
        return;
      }

      if (error) {
        logger.error("Failed to load upcoming deadlines:", error);
        return;
      }

      const tasks =
        (data as
          | { id: string; title: string; due_date: string | null }[]
          | null) ?? [];
      setUpcomingDeadlines(
        tasks
          .filter((item) => Boolean(item.due_date))
          .map((item) => ({
            id: item.id,
            title: item.title,
            due_date: item.due_date as string,
          })),
      );
    };

    const init = async () => {
      const { data, error } = await supabase.auth.getUser();

      if (!isMounted) {
        return;
      }

      if (error) {
        logger.error("Failed to get user:", error);
        return;
      }

      const user = data.user;
      setUserId(user?.id);

      if (!user?.id) {
        setTodayXP(0);
        setUpcomingDeadlines([]);
        return;
      }

      clearRealtimeChannels();
      await fetchTodayXp(user.id);
      await fetchUpcomingDeadlines(user.id);

      const profileChannel = supabase
        .channel("profile_changes")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "user_profiles",
            filter: `id=eq.${user.id}`,
          },
          (payload) => {
            setUserProfile(payload.new as any);
            hydrateFromProfile(payload.new as any);
          },
        )
        .subscribe();

      const logsChannel = supabase
        .channel("daily_logs_changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "daily_logs",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            void fetchTodayXp(user.id);
          },
        )
        .subscribe();

      const tasksChannel = supabase
        .channel("deadline_updates")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "tasks",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            void fetchUpcomingDeadlines(user.id);
          },
        )
        .subscribe();

      realtimeChannelsRef.current = [profileChannel, logsChannel, tasksChannel];
    };

    void init();

    return () => {
      isMounted = false;
      clearRealtimeChannels();
    };
  }, [setUserProfile, hydrateFromProfile]);

  const handleAddClick = useCallback(async () => {
    if (currentView === "notes") {
      const newNote = await createNote({
        markdown_body: "",
        tags: [],
      });
      if (newNote) {
        setSelectedNote(newNote);
        window.history.pushState(null, "", `/notes/${newNote.id}`);
      }
    } else if (currentView === "papers") {
      // Clear selected paper to show the AddPaperView in main content
      setSelectedPaper(null);
    } else if (currentView === "ideas") {
      setIsAddIdeaDialogOpen(true);
    }
  }, [createNote, currentView, setSelectedNote, setSelectedPaper]);

  const handleCreateIdea = async (data: {
    title: string;
    description?: string;
  }) => {
    const newIdea = await createIdea({
      title: data.title,
      description: data.description,
      stage: "Seed",
    });

    if (newIdea) {
      setSelectedIdea(newIdea);
      window.history.pushState(null, "", `/ideas/${newIdea.id}`);
      setIsAddIdeaDialogOpen(false);
      toast.success("Idea created successfully");
    }
  };

  // Handlers for list items (memoized)
  const handleSelectNote = useCallback(
    (note: Note) => {
      setSelectedNote(note);
      window.history.pushState(null, "", `/notes/${note.id}`);
    },
    [setSelectedNote],
  );

  const handleDeleteNote = useCallback(
    async (note: Note) => {
      const success = await deleteNote(note.id);
      if (success && selectedNote?.id === note.id) {
        setSelectedNote(null);
      }
      return success;
    },
    [deleteNote, selectedNote?.id, setSelectedNote],
  );

  const handleRestoreNote = useCallback(
    async (note: Note) => {
      const restored = await restoreNote(note);
      if (restored) {
        setSelectedNote(restored);
      }
      return restored;
    },
    [restoreNote, setSelectedNote],
  );

  const handleRestorePaper = useCallback(
    async (paper: Paper) => {
      const restored = await restorePaper(paper);
      if (restored) {
        setSelectedPaper(restored);
      }
      return restored;
    },
    [restorePaper, setSelectedPaper],
  );

  const handleSelectPaper = useCallback(
    (paper: Paper) => {
      setSelectedPaper(paper);
      window.history.pushState(null, "", `/papers/${paper.id}`);
    },
    [setSelectedPaper],
  );

  const handlePaperStatusChange = useCallback(
    (id: string, status: ReadingStatus) => {
      updatePaper(id, { status });
    },
    [updatePaper],
  );

  const handleSelectIdea = useCallback(
    (idea: Idea) => {
      setSelectedIdea(idea);
      window.history.pushState(null, "", `/ideas/${idea.id}`);
    },
    [setSelectedIdea],
  );

  const handleIdeaStageChange = useCallback(
    (id: string, stage: IdeaStage, oldStage: IdeaStage) => {
      updateIdea(id, { stage }, oldStage);
    },
    [updateIdea],
  );

  const handleRestoreIdea = useCallback(
    async (idea: Idea) => {
      const restored = await restoreIdea(idea);
      if (restored) {
        setSelectedIdea(restored);
      }
      return restored;
    },
    [restoreIdea, setSelectedIdea],
  );

  // Filter entities by search query (memoized for performance)
  const activeSearchQuery = searchQueries[currentView];
  const normalizedQuery = useMemo(
    () => activeSearchQuery.trim().toLowerCase(),
    [activeSearchQuery],
  );

  // ⚡ PERFORMANCE OPTIMIZATION: Pre-compute derived text fields (like markdown title extraction and toLowerCase)
  // so that expensive string parsing is decoupled from the fast keystroke filtering loop.
  const searchableNotes = useMemo(() => {
    return notes.map((note) => ({
      note,
      titleText: (note.title || deriveTitleFromMarkdown(note.markdown_body) || "").toLowerCase(),
      bodyText: note.markdown_body.toLowerCase(),
      tagsText: (note.tags || []).join(" ").toLowerCase(),
    }));
  }, [notes]);

  const filteredNotes = useMemo(() => {
    // Optimization: Don't filter if not viewing notes
    if (currentView !== "notes") return [];

    if (!normalizedQuery) return notes;

    return searchableNotes
      .filter((sn) =>
        sn.titleText.includes(normalizedQuery) ||
        sn.bodyText.includes(normalizedQuery) ||
        sn.tagsText.includes(normalizedQuery)
      )
      .map((sn) => sn.note);
  }, [searchableNotes, normalizedQuery, currentView, notes]);

  const searchablePapers = useMemo(() => {
    return papers.map((paper) => ({
      paper,
      titleText: (paper.title || "").toLowerCase(),
      authorsText: (paper.authors || []).join(" ").toLowerCase(),
    }));
  }, [papers]);

  const filteredPapers = useMemo(() => {
    // Optimization: Don't filter if not viewing papers
    if (currentView !== "papers") return [];

    if (!normalizedQuery) return papers;

    return searchablePapers
      .filter((sp) =>
        sp.titleText.includes(normalizedQuery) ||
        sp.authorsText.includes(normalizedQuery)
      )
      .map((sp) => sp.paper);
  }, [searchablePapers, normalizedQuery, currentView, papers]);

  const searchableIdeas = useMemo(() => {
    return ideas.map((idea) => ({
      idea,
      titleText: (idea.title || "").toLowerCase(),
      descriptionText: (idea.description || "").toLowerCase(),
    }));
  }, [ideas]);

  const filteredIdeas = useMemo(() => {
    // Optimization: Don't filter if not viewing ideas
    if (currentView !== "ideas") return [];

    if (!normalizedQuery) return ideas;

    return searchableIdeas
      .filter((si) =>
        si.titleText.includes(normalizedQuery) ||
        si.descriptionText.includes(normalizedQuery)
      )
      .map((si) => si.idea);
  }, [searchableIdeas, normalizedQuery, currentView, ideas]);

  const nextDeadline = upcomingDeadlines[0];

  const nextDeadlineBadge = useMemo(() => {
    if (!nextDeadline) {
      return null;
    }

    return formatTimeUntil(nextDeadline.due_date);
  }, [nextDeadline]);

  const workspaceStats = useMemo(
    () => [
      { key: "notes", label: "Notes", count: notes.length, icon: FileText },
      { key: "papers", label: "Papers", count: papers.length, icon: BookOpen },
      { key: "ideas", label: "Ideas", count: ideas.length, icon: Lightbulb },
      {
        key: "focus",
        label: "Focus queue",
        count: upcomingDeadlines.length,
        icon: Target,
      },
    ],
    [ideas.length, notes.length, papers.length, upcomingDeadlines.length],
  );

  const readingStatusCounts = useMemo(() => {
    return papers.reduce(
      (acc, paper) => {
        acc[paper.status] = (acc[paper.status] ?? 0) + 1;
        return acc;
      },
      {
        "To Read": 0,
        Reading: 0,
        Read: 0,
      } as Record<ReadingStatus, number>,
    );
  }, [papers]);

  const ideaStageCounts = useMemo(() => {
    return ideas.reduce(
      (acc, idea) => {
        acc[idea.stage] = (acc[idea.stage] ?? 0) + 1;
        return acc;
      },
      {
        Seed: 0,
        Developing: 0,
        Supported: 0,
        Mature: 0,
      } as Record<IdeaStage, number>,
    );
  }, [ideas]);

  const focusPrompts = useMemo(() => {
    const prompts: { title: string; detail: string }[] = [];

    if (currentView === "notes" && notes.length > 0) {
      prompts.push({
        title: "Bundle a note",
        detail:
          "Group related notes into a lightweight summary to spot emerging patterns.",
      });
    }

    if (currentView === "papers" && readingStatusCounts["To Read"] > 0) {
      prompts.push({
        title: "Schedule a skim",
        detail:
          "Choose one “To Read” paper and pencil in a 15-minute skim to unblock progress.",
      });
    }

    if (currentView === "ideas" && ideaStageCounts.Seed > 0) {
      prompts.push({
        title: "Nudge a seed forward",
        detail:
          "Pick a seed-stage idea and jot the smallest experiment that would advance it.",
      });
    }

    if (currentView === "focus") {
      if (upcomingDeadlines.length > 0) {
        const deadline = upcomingDeadlines[0];
        prompts.push({
          title: "Tackle your nearest deadline",
          detail: `Use a timer to make progress on “${deadline.title}” due ${formatTimeUntil(deadline.due_date)}.`,
        });
      }

      prompts.push({
        title: "Pick a single target",
        detail:
          "Choose one note, paper, or task in the Focus tab and commit to a 25-minute deep work sprint.",
      });
    }

    if (!activeBoost) {
      prompts.push({
        title: "Plan a focus boost",
        detail:
          "Line up a 25-minute boost window so the next deep work block is ready when you are.",
      });
    }

    if (todayXP === 0) {
      prompts.push({
        title: "Log a micro-win",
        detail:
          "Capture a two-minute action—like clarifying a task or clipping a quote—to start today’s streak.",
      });
    }

    if (prompts.length === 0) {
      prompts.push(
        {
          title: "Review your workspace",
          detail:
            "Scan the lists below and decide which item deserves your next deliberate step.",
        },
        {
          title: "Archive the stale",
          detail:
            "Clear out anything that no longer sparks energy so the active work stays visible.",
        },
      );
    }

    return prompts.slice(0, 3);
  }, [
    activeBoost,
    currentView,
    ideaStageCounts,
    notes.length,
    readingStatusCounts,
    todayXP,
    upcomingDeadlines,
  ]);

  const focusReflection = useMemo(() => {
    if (todayXP === 0) {
      return "No XP logged yet—start with a five-minute capture to open today’s momentum loop.";
    }

    if (todayXP < 50) {
      return `Nice warm-up with ${todayXP} XP. Stack another quick win while the energy is light.`;
    }

    return `Great flow today! Bank a short reflection so future-you remembers what unlocked ${todayXP} XP.`;
  }, [todayXP]);

  return (
    <>
      <div className="flex-1 flex flex-col h-full overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Navigation Tabs */}
          <nav className="space-y-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentView === tab.id;
              let badgeText: string | null = null;
              let badgeStyle = "";
              const badgeAlignment = isActive ? "ml-2" : "ml-auto";

              if (tab.id === "tasks" && nextDeadlineBadge) {
                badgeText = nextDeadlineBadge;
                badgeStyle =
                  "bg-warning-bg text-warning border border-warning/30";
              } else if (tab.id === "notes" && activeBoost && boostCountdown) {
                badgeText = boostCountdown;
                badgeStyle =
                  "bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-200";
              }

              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-md transition-all duration-200 relative focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 ${
                    isActive
                      ? "bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-100 font-semibold shadow-sm"
                      : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <div
                    className={`absolute left-2 top-1 bottom-1 w-1.5 bg-primary-500 rounded-full transition-all duration-200 ${
                      isActive
                        ? "opacity-100 scale-y-100"
                        : "opacity-0 scale-y-0"
                    }`}
                    aria-hidden="true"
                  />
                  <Icon
                    className={`w-5 h-5 ${
                      isActive
                        ? "text-primary-600 dark:text-primary-200"
                        : "text-text-secondary"
                    }`}
                    aria-hidden="true"
                  />
                  <span
                    className={`text-small ${isActive ? "font-semibold" : "font-medium"}`}
                  >
                    {tab.label}
                  </span>
                  {isActive && (
                    <span
                      className="ml-auto text-caption font-semibold text-primary-500 dark:text-primary-200"
                      aria-hidden="true"
                    >
                      Active
                    </span>
                  )}
                  {badgeText && (
                    <span
                      className={`${badgeAlignment} text-caption px-2 py-0.5 rounded-full font-semibold ${badgeStyle}`}
                    >
                      {badgeText}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Search Bar */}
          {showSidebarSearch && (
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={`Search ${currentView}...`}
                aria-label={`Search ${currentView}`}
                value={activeSearchQuery}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  setSearchQueries((prev) => ({
                    ...prev,
                    [currentView]: nextValue,
                  }));
                }}
                className="w-full pl-10 pr-10 py-2 bg-bg-base border border-border-moderate rounded-sm text-small focus:outline-none focus:ring-1 focus:ring-primary-500 transition-shadow"
              />
              {activeSearchQuery && (
                <button
                  onClick={() => {
                    setSearchQueries((prev) => ({
                      ...prev,
                      [currentView]: "",
                    }));
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-sm text-text-tertiary hover:text-text-primary hover:bg-bg-elevated transition-colors focus:outline-none focus:ring-1 focus:ring-primary-500"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          )}

          {/* Add Button (hide for tasks, topics, and focus) */}
          {currentView !== "tasks" && currentView !== "focus" && currentView !== "topics" && (
            <button
              onClick={() => {
                handleAddClick();
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-500 text-bg-base rounded-sm hover:opacity-90 transition-opacity font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
              aria-label={`Create new ${currentView.slice(0, -1)}`}
            >
              <Plus className="w-5 h-5" aria-hidden="true" />
              <span>{`New ${currentView.slice(0, -1)}`}</span>
            </button>
          )}

          {/* Entity List */}
          <div className="space-y-2">
            <h3 className="text-small font-semibold text-text-secondary px-2">
              Recent {currentView}
            </h3>

            {currentView === "notes" && (
              <NoteList
                notes={filteredNotes}
                loading={loading}
                onSelectNote={handleSelectNote}
                onDeleteNote={handleDeleteNote}
                onRestoreNote={handleRestoreNote}
                selectedNoteId={selectedNote?.id}
                selectedNote={selectedNote}
                searchQuery={activeSearchQuery}
              />
            )}

            {currentView === "papers" && (
              <PaperList
                papers={filteredPapers}
                loading={loading}
                onSelectPaper={handleSelectPaper}
                onDeletePaper={deletePaper}
                onRestorePaper={handleRestorePaper}
                onStatusChange={handlePaperStatusChange}
                selectedPaperId={selectedPaper?.id}
                searchQuery={activeSearchQuery}
              />
            )}

            {currentView === "ideas" && (
              <IdeaList
                ideas={filteredIdeas}
                loading={loading}
                onSelectIdea={handleSelectIdea}
                onDeleteIdea={deleteIdea}
                onRestoreIdea={handleRestoreIdea}
                onStageChange={handleIdeaStageChange}
                selectedIdeaId={selectedIdea?.id}
              />
            )}

            {currentView === "tasks" && (
              <div className="text-center py-12 text-text-tertiary">
                <CheckSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-small">Task manager is in the main panel</p>
              </div>
            )}

            {currentView === "topics" && (
              <div className="text-center py-12 text-text-tertiary">
                <Hash className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-small">Topic manager is in the main panel</p>
              </div>
            )}

            {currentView === "focus" && (
              <div className="space-y-3">
                <div className="p-4 border border-border-subtle rounded-lg bg-bg-base/60 text-sm text-text-secondary">
                  Set a target in the main panel, choose a timer preset, and
                  block distractions while you work through a single thread.
                </div>
                <div className="space-y-2">
                  <h4 className="text-small font-semibold text-text-secondary px-2 flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary-500" />
                    Upcoming focus candidates
                  </h4>
                  {upcomingDeadlines.length > 0 ? (
                    <ul className="space-y-2">
                      {upcomingDeadlines.slice(0, 4).map((deadline) => (
                        <li
                          key={deadline.id}
                          className="p-3 rounded-md border border-border-subtle bg-bg-base/80"
                        >
                          <p className="text-small font-semibold text-text-primary line-clamp-2">
                            {deadline.title}
                          </p>
                          <p className="text-caption text-text-tertiary mt-1">
                            Due{" "}
                            {new Date(deadline.due_date).toLocaleString(
                              undefined,
                              {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-caption text-text-tertiary px-2">
                      No deadlines this week—pick a note or paper you’ve been
                      meaning to revisit.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Focus Studio Widget */}
          <FocusStudioWidget
            workspaceStats={workspaceStats}
            readingStatusCounts={readingStatusCounts}
            ideaStageCounts={ideaStageCounts}
            focusPrompts={focusPrompts}
            focusReflection={focusReflection}
          />
        </div>
      </div>

      <AddIdeaDialog
        isOpen={isAddIdeaDialogOpen}
        onClose={() => setIsAddIdeaDialogOpen(false)}
        onConfirm={handleCreateIdea}
        isLoading={ideasLoading}
      />
    </>
  );
}

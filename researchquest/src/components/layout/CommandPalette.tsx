import { useEffect, useMemo, useState } from "react";
import { Command } from "cmdk";
import {
  FileText,
  BookOpen,
  Lightbulb,
  Target,
  CheckSquare,
  Plus,
  Moon,
  Sun,
  Search,
  Download,
  Keyboard,
  Database,
  LayoutDashboard,
  Hash,
} from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "../../store/appStore";
import { useShallow } from "zustand/react/shallow";
import { useNotes } from "../../hooks/useNotes";
import { usePapers } from "../../hooks/usePapers";
import { useIdeas } from "../../hooks/useIdeas";
import { useTasks } from "../../hooks/useTasks";
import { supabase } from "../../lib/supabase";
import { exportData } from "../../utils/export";
import { DataManagementDialog } from "../settings/DataManagementDialog";
import { navigateToView } from "../../lib/softNavigation";
import type { AppView } from "../../lib/router";
import "./CommandPalette.css";

type SearchEntryType = "note" | "paper" | "idea" | "task" | "topic";

interface SearchEntry {
  type: SearchEntryType;
  item: { id: string };
  label: string;
  snippet?: string | null;
}

interface GlobalSearchRow {
  entity_type: string;
  entity_id: string;
  title: string | null;
  snippet: string | null;
  rank: number;
  updated_at: string;
}

/** Client-side page size: ranking runs over the full collection BEFORE capping. */
const SEARCH_PAGE_SIZE = 50;
const GLOBAL_SEARCH_LIMIT = 20;
const GLOBAL_SEARCH_DEBOUNCE_MS = 250;

/**
 * Rank a client-side label against the query (higher is better, < 0 is no
 * match). Runs over the full collection before the 50-item cap so deep
 * matches are never cut off by a pre-slice.
 */
function rankLabel(label: string, query: string): number {
  const haystack = label.toLowerCase();
  const needle = query.toLowerCase();
  if (!needle) return 0;
  if (haystack === needle) return 100;
  if (haystack.startsWith(needle)) return 75;
  const index = haystack.indexOf(needle);
  if (index >= 0) return 50 - Math.min(index, 40);
  if (
    haystack.split(/[\s_/-]+/).some((word) => word.startsWith(needle))
  )
    return 25;
  return -1;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [serverRows, setServerRows] = useState<GlobalSearchRow[] | null>(null);
  const [showDataDialog, setShowDataDialog] = useState(false);

  // ⚡ PERFORMANCE OPTIMIZATION:
  // Using useShallow with an object selector to prevent CommandPalette from
  // unnecessarily re-rendering on unrelated state changes in the global appStore.
  const {
    setTheme,
    effectiveTheme,
    setSelectedNote,
    setSelectedPaper,
    setSelectedIdea,
    setSelectedTopic,
    setSelectedTask,
    user,
    topics,
  } = useAppStore(
    useShallow((state) => ({
      setTheme: state.setTheme,
      effectiveTheme: state.effectiveTheme,
      setSelectedNote: state.setSelectedNote,
      setSelectedPaper: state.setSelectedPaper,
      setSelectedIdea: state.setSelectedIdea,
      setSelectedTopic: state.setSelectedTopic,
      setSelectedTask: state.setSelectedTask,
      user: state.user,
      topics: state.topics,
    })),
  );

  const topicsArray = useMemo(() => Object.values(topics), [topics]);

  // Fetch data for search (create* fns back the honest "New X" actions)
  const { notes, createNote } = useNotes(user?.id);
  const { papers } = usePapers(user?.id);
  const { ideas, createIdea } = useIdeas(user?.id);
  const { tasks, createTask } = useTasks(user?.id, { owner: false });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        // Ctrl/⌘+K is reserved for the palette everywhere, including inside
        // editors. Insert Link moved to Ctrl/⌘+Shift+K (see ShortcutsDialog).
        e.preventDefault();
        setOpen((open) => !open);
      } else if (e.key === "/") {
        if (!isEditable) {
          e.preventDefault();
          setOpen((open) => !open);
        }
      }
    };

    const handleOpenCommandPalette = () => {
      setOpen(true);
    };

    document.addEventListener("keydown", down);
    document.addEventListener("open-command-palette", handleOpenCommandPalette);

    return () => {
      document.removeEventListener("keydown", down);
      document.removeEventListener(
        "open-command-palette",
        handleOpenCommandPalette,
      );
    };
  }, []);

  // Server-ranked search via the global_search RPC (rank + snippet + group),
  // gated with a client-filter fallback for demo mode (where the RPC stub
  // returns null) and for any RPC failure.
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || !user?.id) {
      setServerRows(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const response = (await supabase.rpc("global_search", {
            search_user_id: user.id,
            search_query: trimmed,
            limit_count: GLOBAL_SEARCH_LIMIT,
          })) as unknown as {
            data?: unknown;
            error?: unknown;
          };
          if (cancelled) return;
          if (response?.error || !Array.isArray(response?.data)) {
            // Demo mode / RPC unavailable: fall back to client filtering.
            setServerRows(null);
            return;
          }
          setServerRows(response.data as GlobalSearchRow[]);
        } catch {
          if (!cancelled) setServerRows(null);
        }
      })();
    }, GLOBAL_SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, user?.id]);

  // Navigation handlers using App's custom routing
  const handleNavigate = (view: AppView) => {
    navigateToView(view);
    setOpen(false);
  };

  const handleSelectNote = (note: any) => {
    setSelectedNote(note);
    navigateToView("notes", `/notes/${note.id}`);
    setOpen(false);
  };

  const handleSelectPaper = (paper: any) => {
    setSelectedPaper(paper);
    navigateToView("papers", `/papers/${paper.id}`);
    setOpen(false);
  };

  const handleSelectIdea = (idea: any) => {
    setSelectedIdea(idea);
    navigateToView("ideas", `/ideas/${idea.id}`);
    setOpen(false);
  };

  const handleSelectTask = (task: any) => {
    setSelectedTask(task);
    navigateToView("tasks", `/tasks/${task.id}`);
    setOpen(false);
  };

  const handleSelectTopic = (topic: any) => {
    setSelectedTopic(topic);
    navigateToView("topics", `/topics/${topic.id}`);
    setOpen(false);
  };

  // Honest "New X" actions: create the entity for real, then deep-link to it.
  // (The crud hooks own their success/error toasts.)
  const handleCreateNote = async (title?: string) => {
    const trimmed = title?.trim();
    const created = await createNote({
      ...(trimmed ? { title: trimmed } : {}),
      markdown_body: trimmed ?? "",
    });
    if (created) {
      setSelectedNote(created);
      navigateToView("notes", `/notes/${created.id}`);
    }
    setOpen(false);
  };

  const handleCreateIdea = async (title?: string) => {
    const created = await createIdea({
      title: title?.trim() ? title.trim() : "Untitled Idea",
    });
    if (created) {
      setSelectedIdea(created);
      navigateToView("ideas", `/ideas/${created.id}`);
    }
    setOpen(false);
  };

  const handleCreateTask = async (title?: string) => {
    const created = await createTask({
      title: title?.trim() ? title.trim() : "Untitled Task",
    });
    if (created) {
      setSelectedTask(created);
      navigateToView("tasks", `/tasks/${created.id}`);
    }
    setOpen(false);
  };

  const selectEntry = (entry: SearchEntry) => {
    if (entry.type === "note") handleSelectNote(entry.item);
    if (entry.type === "paper") handleSelectPaper(entry.item);
    if (entry.type === "idea") handleSelectIdea(entry.item);
    if (entry.type === "task") handleSelectTask(entry.item);
    if (entry.type === "topic") handleSelectTopic(entry.item);
  };

  const toggleTheme = () => {
    const newTheme = effectiveTheme === "light" ? "dark" : "light";
    document.body.classList.add("theme-transitioning");
    setTheme(newTheme);
    setTimeout(() => {
      document.body.classList.remove("theme-transitioning");
    }, 300);
    setOpen(false);
  };

  const handleExport = async () => {
    const { user, notes, papers, ideas, topics, tasks } =
      useAppStore.getState();
    if (!user?.id) {
      toast.error("Sign in to export your data.");
      setOpen(false);
      return;
    }

    try {
      const cleanTopics = Object.values(topics).map((t) => ({
        id: t.id,
        user_id: t.user_id,
        name: t.name,
        ...(t.description !== undefined ? { description: t.description } : {}),
        created_at: t.created_at,
        updated_at: t.updated_at,
      }));

      await exportData({
        userId: user.id,
        user,
        notes,
        papers,
        ideas,
        topics: cleanTopics,
        tasks,
      });
      toast.success("Backup download started");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Backup export failed",
      );
    }
    setOpen(false);
  };

  const handleOpenDataManagement = () => {
    // Open the dialog owned by the palette instead of relying on the Sidebar
    // listener: the Sidebar is unmounted in Zen mode,
    // which made the old `open-data-management` event a silent no-op.
    setShowDataDialog(true);
    setOpen(false);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setQuery("");
      setServerRows(null);
    }
  };

  // Client-side rank-then-cap: score every candidate BEFORE slicing so deep
  // matches are never cut off by a pre-slice.
  const clientEntries = useMemo<SearchEntry[]>(() => {
    const all: SearchEntry[] = [
      ...notes.map((n) => ({
        type: "note" as const,
        item: n,
        label: n.title || "Untitled Note",
      })),
      ...papers.map((p) => ({
        type: "paper" as const,
        item: p,
        label: p.title || "Untitled Paper",
      })),
      ...ideas.map((i) => ({
        type: "idea" as const,
        item: i,
        label: i.title || "Untitled Idea",
      })),
      ...tasks.map((t) => ({
        type: "task" as const,
        item: t,
        label: t.title || "Untitled Task",
      })),
      ...(topicsArray || []).map((t) => ({
        type: "topic" as const,
        item: t,
        label: t.name || "Untitled Topic",
      })),
    ];
    const trimmed = query.trim();
    if (!trimmed) return all.slice(0, SEARCH_PAGE_SIZE);
    return all
      .map((entry) => ({ entry, score: rankLabel(entry.label, trimmed) }))
      .filter(({ score }) => score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, SEARCH_PAGE_SIZE)
      .map(({ entry }) => entry);
  }, [notes, papers, ideas, tasks, topicsArray, query]);

  // Server-ranked rows (already ordered by rank server-side); resolve each
  // row to its store entity for selection, falling back to the row payload.
  const serverEntries = useMemo<SearchEntry[] | null>(() => {
    if (!serverRows) return null;
    const notesById = new Map(notes.map((n) => [n.id, n]));
    const papersById = new Map(papers.map((p) => [p.id, p]));
    const ideasById = new Map(ideas.map((i) => [i.id, i]));
    return serverRows.slice(0, SEARCH_PAGE_SIZE).map((row) => {
      const type: SearchEntryType =
        row.entity_type === "paper"
          ? "paper"
          : row.entity_type === "idea"
            ? "idea"
            : "note";
      const full =
        type === "paper"
          ? papersById.get(row.entity_id)
          : type === "idea"
            ? ideasById.get(row.entity_id)
            : notesById.get(row.entity_id);
      return {
        type,
        item: full ?? { id: row.entity_id },
        label: row.title || `Untitled ${type}`,
        snippet: row.snippet,
      };
    });
  }, [serverRows, notes, papers, ideas]);

  const searchEntries = serverEntries ?? clientEntries;
  const trimmedQuery = query.trim();

  return (
    <>
      <Command.Dialog
        className="w-[calc(100vw-2rem)] max-w-xl"
        open={open}
        onOpenChange={handleOpenChange}
        label="Command Menu"
      >
        <div
          className="flex items-center border-b border-border-subtle px-3"
          cmdk-input-wrapper=""
        >
          <Search className="w-5 h-5 text-text-tertiary mr-2" />
          <Command.Input
            className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
            placeholder="Type a command or search..."
            value={query}
            onValueChange={setQuery}
          />
        </div>

        <Command.List>
          <Command.Empty role="status" aria-live="polite">
            No results found.
          </Command.Empty>

          <Command.Group heading="Navigation">
            <Command.Item onSelect={() => handleNavigate("dashboard")}>
              <LayoutDashboard />
              <span>Go to Today</span>
            </Command.Item>
            <Command.Item onSelect={() => handleNavigate("notes")}>
              <FileText />
              <span>Go to Notes</span>
            </Command.Item>
            <Command.Item onSelect={() => handleNavigate("papers")}>
              <BookOpen />
              <span>Go to Papers</span>
            </Command.Item>
            <Command.Item onSelect={() => handleNavigate("ideas")}>
              <Lightbulb />
              <span>Go to Ideas</span>
            </Command.Item>
            <Command.Item onSelect={() => handleNavigate("tasks")}>
              <CheckSquare />
              <span>Go to Tasks</span>
            </Command.Item>
            <Command.Item onSelect={() => handleNavigate("topics")}>
              <Hash />
              <span>Go to Topics</span>
            </Command.Item>
            <Command.Item onSelect={() => handleNavigate("focus")}>
              <Target />
              <span>Go to Focus</span>
            </Command.Item>
          </Command.Group>

          <Command.Group heading="Actions">
            <Command.Item onSelect={() => void handleCreateNote()}>
              <Plus />
              <span>New Note</span>
            </Command.Item>

            <Command.Item onSelect={() => handleNavigate("papers")}>
              <BookOpen />
              <span>Go to Papers to add</span>
            </Command.Item>

            <Command.Item onSelect={() => void handleCreateIdea()}>
              <Plus />
              <span>New Idea</span>
            </Command.Item>

            <Command.Item onSelect={() => void handleCreateTask()}>
              <Plus />
              <span>New Task</span>
            </Command.Item>

            <Command.Item onSelect={() => handleNavigate("topics")}>
              <Hash />
              <span>Go to Topics to manage</span>
            </Command.Item>

            {trimmedQuery && (
              <Command.Item
                value={`Create note "${trimmedQuery}"`}
                onSelect={() => void handleCreateNote(trimmedQuery)}
              >
                <Plus />
                <span>Create note &ldquo;{trimmedQuery}&rdquo;</span>
              </Command.Item>
            )}

            <Command.Item onSelect={handleOpenDataManagement}>
              <Database />
              <span>Data Management...</span>
            </Command.Item>

            <Command.Item onSelect={() => void handleExport()}>
              <Download />
              <span>Quick Export All Data</span>
            </Command.Item>

            <Command.Item onSelect={toggleTheme}>
              {effectiveTheme === "light" ? <Moon /> : <Sun />}
              <span>Toggle Theme</span>
            </Command.Item>

            <Command.Item
              onSelect={() => {
                document.dispatchEvent(
                  new CustomEvent("open-shortcuts-help"),
                );
                setOpen(false);
              }}
            >
              <Keyboard />
              <span>Keyboard Shortcuts</span>
            </Command.Item>
          </Command.Group>

          <Command.Group heading="Search Results">
            {searchEntries.map((entry) => (
              <Command.Item
                key={`${entry.type}-${entry.item.id}`}
                onSelect={() => selectEntry(entry)}
                value={`${entry.type} ${entry.item.id} ${entry.label}`}
                className="command-palette-result"
              >
                {entry.type === "note" && (
                  <FileText className="text-primary-500" />
                )}
                {entry.type === "paper" && <BookOpen className="text-blue-500" />}
                {entry.type === "idea" && (
                  <Lightbulb className="text-yellow-500" />
                )}
                {entry.type === "task" && (
                  <CheckSquare className="text-green-500" />
                )}
                {entry.type === "topic" && <Hash className="text-purple-500" />}
                <div className="flex min-w-0 flex-col">
                  <span>{entry.label}</span>
                  {entry.snippet ? (
                    <span className="command-palette-snippet">
                      {entry.snippet}
                    </span>
                  ) : null}
                  <span className="text-xs text-text-tertiary capitalize">
                    {entry.type}
                  </span>
                </div>
              </Command.Item>
            ))}
          </Command.Group>
        </Command.List>
      </Command.Dialog>
      <DataManagementDialog
        open={showDataDialog}
        onClose={() => setShowDataDialog(false)}
      />
    </>
  );
}

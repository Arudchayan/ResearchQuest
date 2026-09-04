import { ConfirmDialog, useConfirmDialog } from "../ui/ConfirmDialog";
import { logger } from "../../utils/logger";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import { useAppStore } from "../../store/appStore";
import { useShallow } from "zustand/react/shallow";
import { useTopics } from "../../hooks/useTopics";
import type {
  TopicWithCounts,
  Note,
  Paper,
  Idea,
  TopicQuest,
} from "../../types/database";
import { Badge, type BadgeVariant } from "../ui/Badge";
import { deriveTitleFromMarkdown } from "../../utils/text";
import {
  Pencil,
  Save,
  XCircle,
  FileText,
  BookOpen,
  Lightbulb,
  ArrowRight,
  Trash2,
  Download,
  Table,
  FileJson,
  Target,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  convertTopicsToMarkdown,
  convertTopicsToCSV,
  convertTopicsToJSON,
  downloadFile,
} from "../../utils/export";
import { InlineError } from "../ui/ErrorFallback";
import { Skeleton } from "../ui/Skeleton";
import { DEMO_FIRST_RUN_TOPIC_ID } from "../../lib/demoData";
import { isDemoMode } from "../../lib/supabase";

type AssociationKind = "notes" | "papers" | "ideas";

type AssociationLoadErrors = Record<AssociationKind, string | null>;

const EMPTY_ASSOCIATION_ERRORS: AssociationLoadErrors = {
  notes: null,
  papers: null,
  ideas: null,
};

interface AssociationLoadResult<T> {
  readonly items: T[];
  readonly error: string | null;
}

interface TopicDetailViewProps {
  topic: TopicWithCounts;
  onUpdate: (
    topicId: string,
    updates: { name?: string; description?: string },
  ) => Promise<boolean>;
  onDelete: (topicId: string) => Promise<boolean>;
}

export function TopicDetailView({
  topic,
  onUpdate,
  onDelete,
}: TopicDetailViewProps) {
  // ⚡ OPTIMIZATION: Use useShallow with an object selector to prevent TopicDetailView from unnecessarily re-rendering on unrelated state changes in the global appStore.
  const { setCurrentView, setSelectedNote, setSelectedPaper, setSelectedIdea } =
    useAppStore(
      useShallow((state) => ({
        setCurrentView: state.setCurrentView,
        setSelectedNote: state.setSelectedNote,
        setSelectedPaper: state.setSelectedPaper,
        setSelectedIdea: state.setSelectedIdea,
      })),
    );
  const [name, setName] = useState(topic.name);
  const [description, setDescription] = useState(topic.description || "");
  const [isEditing, setIsEditing] = useState(false);
  const { confirm: confirmDialog, isOpen, config } = useConfirmDialog();
  const [loadingAssociations, setLoadingAssociations] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [associationErrors, setAssociationErrors] =
    useState<AssociationLoadErrors>(EMPTY_ASSOCIATION_ERRORS);
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionNoteDraft, setSessionNoteDraft] = useState("");
  const sessionNoteRef = useRef<HTMLTextAreaElement>(null);

  const { quests, questsLoading, refreshQuests, advanceQuest } = useTopics(
    userId ?? undefined,
    { owner: false },
  );

  const topicQuests = useMemo(
    () => quests.filter((quest) => quest.topic_id === topic.id),
    [quests, topic.id],
  );

  const questStatusVariant: Record<TopicQuest["status"], BadgeVariant> = {
    active: "neutral",
    completed: "success",
    expired: "warning",
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    setName(topic.name);
    setDescription(topic.description || "");
    setIsEditing(false);
  }, [topic.id, topic.name, topic.description]);

  const loadAssociations = useCallback(async () => {
    if (!userId) {
      setNotes([]);
      setPapers([]);
      setIdeas([]);
      setAssociationErrors(EMPTY_ASSOCIATION_ERRORS);
      setLoadingAssociations(false);
      return;
    }

    setLoadingAssociations(true);
    try {

    const fetchIds = async (
      table: string,
      column: string,
    ): Promise<{ readonly ids: string[]; readonly error: string | null }> => {
      const { data, error } = await supabase
        .from(table)
        .select(column)
        .eq("topic_id", topic.id);

      if (error) {
        logger.error(`Failed to load ${table}`, error);
        return { ids: [], error: error.message };
      }

      return {
        ids: (data || []).flatMap((row) => {
          const value = row[column as keyof typeof row];
          return typeof value === "string" ? [value] : [];
        }),
        error: null,
      };
    };

    // ⚡ OPTIMIZATION: Combine ID fetching and row querying into independent, chained promises.
    // This removes the sequential bottleneck of waiting for all IDs across all entity types
    // to load before fetching *any* of the associated row data.
    const fetchAssociatedRows = async <T,>(
      idTable: string,
      idColumn: string,
      rowTable: string,
    ): Promise<AssociationLoadResult<T>> => {
      const idResult = await fetchIds(idTable, idColumn);
      if (idResult.error) return { items: [], error: idResult.error };
      if (!idResult.ids.length) return { items: [], error: null };

      const { data, error } = await supabase
        .from(rowTable)
        .select("*")
        .in("id", idResult.ids);

      if (error) {
        logger.error(`Failed to load ${rowTable}`, error);
        return { items: [], error: error.message };
      }

      return { items: (data || []) as T[], error: null };
    };

    const [notesData, papersData, ideasData] = await Promise.all([
      fetchAssociatedRows<Note>("topic_notes", "note_id", "notes"),
      fetchAssociatedRows<Paper>("topic_papers", "paper_id", "papers"),
      fetchAssociatedRows<Idea>("topic_ideas", "idea_id", "ideas"),
    ]);

    setNotes(notesData.items);
    setPapers(papersData.items);
    setIdeas(ideasData.items);
    setAssociationErrors({
      notes: notesData.error,
      papers: papersData.error,
      ideas: ideasData.error,
    });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to load linked work. Please try again.";
      logger.error("Failed to load topic associations", error);
      setAssociationErrors({ notes: message, papers: message, ideas: message });
    } finally {
      setLoadingAssociations(false);
    }
  }, [topic.id, userId]);

  useEffect(() => {
    void loadAssociations();
  }, [loadAssociations, topic.idea_count, topic.note_count, topic.paper_count]);

  const emptySessionNote = useMemo(
    () => notes.find((note) => !note.markdown_body?.trim()) ?? null,
    [notes],
  );
  /** Demo stranger landing only — never strip chrome for real signed-in users. */
  const isFirstRunTopic =
    isDemoMode && topic.id === DEMO_FIRST_RUN_TOPIC_ID;

  useLayoutEffect(() => {
    if (!emptySessionNote) return;
    setSessionNoteDraft(emptySessionNote.markdown_body ?? "");
    sessionNoteRef.current?.focus();
  }, [emptySessionNote]);

  const handleOpenFocusStudio = useCallback(() => {
    setCurrentView("focus");
    window.history.pushState(null, "", "/focus");
  }, [setCurrentView]);

  const handleSessionNoteChange = useCallback(
    (value: string) => {
      setSessionNoteDraft(value);
      if (!emptySessionNote) return;
      setNotes((prev) =>
        prev.map((note) =>
          note.id === emptySessionNote.id
            ? { ...note, markdown_body: value }
            : note,
        ),
      );
    },
    [emptySessionNote],
  );

  const handleSessionNoteBlur = useCallback(async () => {
    if (!emptySessionNote) return;
    const { error } = await supabase
      .from("notes")
      .update({ markdown_body: sessionNoteDraft })
      .eq("id", emptySessionNote.id);
    if (error) {
      logger.error("Failed to save session note", error);
      toast.error("Could not save note");
    }
  }, [emptySessionNote, sessionNoteDraft]);

  const handleSave = async () => {
    const success = await onUpdate(topic.id, { name, description });
    if (success) {
      setIsEditing(false);
    }
  };

  const handleDelete = async () => {
    const shouldDelete = await confirmDialog({
      title: "Delete Topic",
      message: "Delete this topic? This will remove its links to notes, papers, and ideas.",
      confirmText: "Delete",
      variant: "danger",
    });
    if (!shouldDelete) return;

    const success = await onDelete(topic.id);
    if (success) {
      toast.success("Topic deleted");
    }
  };

  const handleNavigate = useCallback(
    (view: "notes" | "papers" | "ideas", item: Note | Paper | Idea) => {
      setCurrentView(view);
      if (view === "notes") {
        setSelectedNote(item as Note);
        window.history.pushState(null, "", `/notes/${item.id}`);
      } else if (view === "papers") {
        setSelectedPaper(item as Paper);
        window.history.pushState(null, "", `/papers/${item.id}`);
      } else if (view === "ideas") {
        setSelectedIdea(item as Idea);
        window.history.pushState(null, "", `/ideas/${item.id}`);
      }
    },
    [setCurrentView, setSelectedIdea, setSelectedNote, setSelectedPaper],
  );

  const handleExport = (format: "markdown" | "csv" | "json") => {
    try {
      let content = "";
      let filename = "";
      const timestamp = new Date().toISOString().split("T")[0];

      switch (format) {
        case "markdown":
          content = convertTopicsToMarkdown([topic]);
          filename = `topic-${topic.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${timestamp}.md`;
          break;
        case "csv":
          content = convertTopicsToCSV([topic]);
          filename = `topic-${topic.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${timestamp}.csv`;
          break;
        case "json":
          content = convertTopicsToJSON([topic]);
          filename = `topic-${topic.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${timestamp}.json`;
          break;
      }

      downloadFile(content, filename, format);
      toast.success(`Exported topic as ${format.toUpperCase()}`);
    } catch (error) {
      logger.error("Export failed", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to export topic",
      );
    }
  };

  const associationSummary = useMemo(
    () => [
      {
        label: "Notes",
        recordedCount: topic.note_count,
        displayCount: associationErrors.notes ? topic.note_count : notes.length,
        error: associationErrors.notes,
        items: notes,
        icon: FileText,
        view: "notes" as const,
      },
      {
        label: "Papers",
        recordedCount: topic.paper_count,
        displayCount: associationErrors.papers ? topic.paper_count : papers.length,
        error: associationErrors.papers,
        items: papers,
        icon: BookOpen,
        view: "papers" as const,
      },
      {
        label: "Ideas",
        recordedCount: topic.idea_count,
        displayCount: associationErrors.ideas ? topic.idea_count : ideas.length,
        error: associationErrors.ideas,
        items: ideas,
        icon: Lightbulb,
        view: "ideas" as const,
      },
    ],
    [
      ideas,
      notes,
      papers,
      associationErrors,
      topic.idea_count,
      topic.note_count,
      topic.paper_count,
    ],
  );

  if (isFirstRunTopic) {
    return (
      <div className="p-4 sm:p-8 max-w-3xl mx-auto space-y-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2 min-w-0">
            <h1 className="font-serif text-2xl font-bold text-text-primary">
              {topic.name}
            </h1>
            <p className="text-body text-text-secondary">
              {topic.description ||
                "One topic. Three papers. A note. A focus session."}
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenFocusStudio}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-control bg-black px-4 py-2 text-white transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
          >
            <Target className="w-4 h-4" aria-hidden="true" />
            Focus Studio
          </button>
        </header>

        <section className="space-y-3" aria-label="Papers">
          <h2 className="text-small font-semibold uppercase tracking-wide text-text-secondary">
            Three papers
          </h2>
          {loadingAssociations ? (
            <div className="space-y-2" role="status" aria-label="Loading papers">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-4/5" />
              <Skeleton className="h-10 w-3/4" />
            </div>
          ) : associationErrors.papers ? (
            <InlineError
              message={`Could not load papers. ${associationErrors.papers}`}
              onRetry={() => void loadAssociations()}
            />
          ) : (
            <ul className="space-y-2">
              {papers.map((paper) => (
                <li
                  key={paper.id}
                  className="rounded-control border border-border-subtle bg-bg-surface px-4 py-3"
                >
                  <p className="text-small font-medium text-text-primary">
                    {paper.title}
                  </p>
                  {paper.authors?.length ? (
                    <p className="text-caption text-text-secondary mt-1">
                      {paper.authors.join(", ")}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3" aria-label="Your note">
          <h2 className="text-small font-semibold uppercase tracking-wide text-text-secondary">
            Your note
          </h2>
          <label htmlFor="topic-session-note" className="sr-only">
            Session note
          </label>
          <textarea
            id="topic-session-note"
            ref={sessionNoteRef}
            value={sessionNoteDraft}
            onChange={(event) => handleSessionNoteChange(event.target.value)}
            onBlur={() => {
              void handleSessionNoteBlur();
            }}
            rows={8}
            autoFocus
            className="w-full rounded-control border border-border-subtle bg-bg-base px-3 py-2 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
            placeholder="Start writing…"
            aria-label="Session note"
          />
        </section>
      </div>
    );
  }

  return (
    <>
      <ConfirmDialog
        isOpen={isOpen}
        title={config.title || "Confirm Action"}
        message={config.message || "Are you sure?"}
        {...(config.confirmText !== undefined ? { confirmText: config.confirmText } : {})}
        {...(config.cancelText !== undefined ? { cancelText: config.cancelText } : {})}
        {...(config.variant !== undefined ? { variant: config.variant } : {})}
        onConfirm={config.onConfirm ?? (() => {})}
        onClose={config.onClose ?? (() => {})}
      />
      <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div className="bg-bg-surface border border-border-subtle rounded-xl shadow-sm p-4 sm:p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex-1 space-y-2">
            {isEditing ? (
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={50}
                placeholder="Topic name..."
                aria-label="Topic name"
                className="w-full rounded-control border border-border-subtle bg-bg-base px-3 py-2 text-subtitle font-semibold text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
              />
            ) : (
              <h2 className="text-2xl font-bold text-text-primary">
                {topic.name}
              </h2>
            )}
            {isEditing ? (
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                maxLength={500}
                className="w-full rounded-control border border-border-subtle bg-bg-base px-3 py-2 text-small text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
                placeholder="Describe what belongs in this topic..."
                aria-label="Topic description"
              />
            ) : (
              <p className="text-body text-text-secondary whitespace-pre-wrap">
                {topic.description ||
                  "Add a description to guide your future self."}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2 md:w-auto">
            {isEditing ? (
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="inline-flex items-center gap-2 rounded-control bg-primary-500 px-3 py-2 text-bg-base transition-colors hover:bg-primary-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
                >
                  <Save className="w-4 h-4" aria-hidden="true" />
                  Save
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setName(topic.name);
                    setDescription(topic.description || "");
                  }}
                  className="inline-flex items-center gap-2 rounded-control bg-bg-elevated px-3 py-2 text-text-secondary transition-colors hover:bg-bg-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
                >
                  <XCircle className="w-4 h-4" aria-hidden="true" />
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button
                      className="inline-flex items-center gap-2 rounded-control bg-bg-elevated px-3 py-2 text-text-secondary transition-colors hover:bg-bg-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
                      title="Export topic"
                      aria-label="Export topic"
                    >
                      <Download className="w-4 h-4" />
                      Export
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      className="z-dropdown min-w-40 rounded-control border border-border-subtle bg-bg-surface p-1 shadow-md animate-in fade-in zoom-in-95"
                      align="end"
                    >
                      <DropdownMenu.Item
                        className="flex cursor-pointer items-center gap-2 rounded-control px-2 py-1.5 text-small text-text-primary outline-none hover:bg-bg-elevated focus-visible:bg-bg-elevated"
                        onSelect={() => handleExport("markdown")}
                      >
                        <FileText className="w-4 h-4 text-text-secondary" />
                        Markdown
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        className="flex cursor-pointer items-center gap-2 rounded-control px-2 py-1.5 text-small text-text-primary outline-none hover:bg-bg-elevated focus-visible:bg-bg-elevated"
                        onSelect={() => handleExport("csv")}
                      >
                        <Table className="w-4 h-4 text-text-secondary" />
                        CSV
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        className="flex cursor-pointer items-center gap-2 rounded-control px-2 py-1.5 text-small text-text-primary outline-none hover:bg-bg-elevated focus-visible:bg-bg-elevated"
                        onSelect={() => handleExport("json")}
                      >
                        <FileJson className="w-4 h-4 text-text-secondary" />
                        JSON
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
                <button
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-2 rounded-control bg-bg-elevated px-3 py-2 text-text-secondary transition-colors hover:bg-bg-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
                >
                  <Pencil className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  className="inline-flex items-center gap-2 rounded-control bg-destructive-bg px-3 py-2 text-destructive transition-colors hover:bg-destructive/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-3 bg-bg-elevated rounded-lg border border-border-subtle">
            <p className="text-caption text-text-secondary">Created</p>
            <p className="text-small font-semibold text-text-primary">
              {new Date(topic.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="p-3 bg-bg-elevated rounded-lg border border-border-subtle">
            <p className="text-caption text-text-secondary">Last updated</p>
            <p className="text-small font-semibold text-text-primary">
              {new Date(topic.updated_at).toLocaleString()}
            </p>
          </div>
          <div className="p-3 bg-bg-elevated rounded-lg border border-border-subtle">
            <p className="text-caption text-text-secondary">Total links</p>
            <p className="text-small font-semibold text-text-primary">
              {topic.note_count + topic.paper_count + topic.idea_count}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-bg-surface border border-border-subtle rounded-xl shadow-sm">
        <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-text-primary">
              Topic Quests
            </h3>
            <p className="text-caption text-text-secondary">
              Small challenges to keep this topic moving.
            </p>
          </div>
          <button
            onClick={() => void refreshQuests()}
            disabled={questsLoading}
            aria-label="Refresh topic quests"
            className="inline-flex items-center gap-2 rounded-control bg-bg-elevated px-3 py-2 text-small text-text-secondary transition-colors hover:bg-bg-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {questsLoading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        <div className="divide-y divide-border-subtle">
          {questsLoading && topicQuests.length === 0 ? (
            <div
              className="space-y-2 px-6 py-4"
              role="status"
              aria-label="Loading quests"
            >
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-1.5 w-full" />
            </div>
          ) : topicQuests.length === 0 ? (
            <p className="px-6 py-4 text-caption text-text-tertiary">
              No quests for this topic yet.
            </p>
          ) : (
            topicQuests.map((quest) => {
              const progressPercent =
                quest.target_count > 0
                  ? Math.min(
                      100,
                      Math.round(
                        (quest.progress_count / quest.target_count) * 100,
                      ),
                    )
                  : 0;
              return (
                <div key={quest.id} className="space-y-3 px-6 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-body font-medium text-text-primary">
                        {quest.objective}
                      </p>
                      <p className="text-small text-text-secondary">
                        {quest.progress_count} of {quest.target_count}{" "}
                        {quest.target_count === 1 ? "item" : "items"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant={questStatusVariant[quest.status]}>
                        {quest.status.charAt(0).toUpperCase() +
                          quest.status.slice(1)}
                      </Badge>
                      {quest.status === "active" && (
                        <button
                          type="button"
                          onClick={() => void advanceQuest(topic.id)}
                          disabled={questsLoading}
                          className="inline-flex items-center gap-1 rounded-control bg-bg-elevated px-2.5 py-1.5 text-small font-medium text-text-secondary transition-colors hover:bg-bg-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Mark progress
                        </button>
                      )}
                    </div>
                  </div>
                  <div
                    className="h-1.5 w-full overflow-hidden rounded-full bg-bg-elevated"
                    role="progressbar"
                    aria-label={`Progress for ${quest.objective}`}
                    aria-valuemin={0}
                    aria-valuemax={quest.target_count}
                    aria-valuenow={quest.progress_count}
                  >
                    <div
                      className="h-full bg-primary-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  {quest.due_date && (
                    <p className="text-caption text-text-tertiary">
                      Due {new Date(quest.due_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="bg-bg-surface border border-border-subtle rounded-xl shadow-sm">
        <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-text-primary">
              Connected work
            </h3>
            <p className="text-caption text-text-secondary">
              Jump back into the work linked to this topic.
            </p>
          </div>
          <button
            onClick={() => void loadAssociations()}
            disabled={loadingAssociations}
            className="inline-flex items-center gap-2 rounded-control bg-bg-elevated px-3 py-2 text-small text-text-secondary transition-colors hover:bg-bg-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingAssociations ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        <div className="divide-y divide-border-subtle">
          {associationSummary.map(
            ({ label, recordedCount, displayCount, error, items, icon: Icon, view }) => (
              <div key={label} className="px-6 py-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-primary-500" aria-hidden="true" />
                    <h4 className="text-small font-semibold text-text-primary">
                      {label}{" "}
                      <span className="text-text-tertiary font-normal">
                        ({displayCount})
                      </span>
                    </h4>
                  </div>
                  {items[0] && (
                    <button
                      onClick={() => {
                        if (items[0]) {
                          handleNavigate(view, items[0]);
                        }
                      }}
                      className="inline-flex items-center gap-1 text-caption text-primary-500 hover:text-primary-600"
                    >
                      Open latest <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {loadingAssociations ? (
                  <div className="space-y-2" role="status" aria-label={`Loading linked ${label.toLowerCase()}`}>
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-4/5" />
                  </div>
                ) : error ? (
                  <InlineError
                    message={`Could not load linked ${label.toLowerCase()}. ${error}`}
                    onRetry={() => void loadAssociations()}
                  />
                ) : displayCount === 0 ? (
                  <p className="text-caption text-text-tertiary">
                    No {label.toLowerCase()} linked yet.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {items.slice(0, 3).map((item) => (
                      <li key={item.id}>
                        <button
                          onClick={() => handleNavigate(view, item)}
                          className="w-full text-left px-4 py-2 bg-bg-elevated hover:bg-primary-500/10 rounded-md transition-colors"
                        >
                          <p className="text-small font-medium text-text-primary line-clamp-1">
                            {"title" in item && item.title
                              ? item.title
                              : label === "Notes"
                                ? deriveTitleFromMarkdown((item as Note).markdown_body)
                                : "Untitled"}
                          </p>
                          <p className="text-caption text-text-secondary line-clamp-2">
                            {"description" in item && item.description
                              ? item.description
                              : "abstract" in item && item.abstract
                                ? item.abstract
                                : label === "Notes"
                                  ? (item as Note).markdown_body.slice(0, 120)
                                  : ""}
                          </p>
                        </button>
                      </li>
                    ))}
                    {recordedCount !== displayCount && (
                      <li className="text-caption text-text-tertiary">
                        Showing {displayCount} available {label.toLowerCase()}; the stored count will reconcile on the next topic refresh.
                      </li>
                    )}
                    {displayCount > 3 && (
                      <li className="text-caption text-text-tertiary">
                        {displayCount - 3} more {label.toLowerCase()} linked
                      </li>
                    )}
                  </ul>
                )}
              </div>
            ),
          )}
        </div>
      </div>
    </div>
    </>
  );
}

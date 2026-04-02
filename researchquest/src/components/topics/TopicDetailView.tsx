import { ConfirmDialog, useConfirmDialog } from "../ui/ConfirmDialog";
import { logger } from "../../utils/logger";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import { useAppStore } from "../../store/appStore";
import { useShallow } from "zustand/react/shallow";
import type { TopicWithCounts, Note, Paper, Idea } from "../../types/database";
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
} from "lucide-react";

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
  const [userId, setUserId] = useState<string | null>(null);

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
      setLoadingAssociations(false);
      return;
    }

    setLoadingAssociations(true);

    const fetchIds = async <T extends string>(
      table: string,
      column: string,
    ): Promise<T[]> => {
      const { data, error } = await supabase
        .from(table)
        .select(column)
        .eq("topic_id", topic.id);

      if (error) {
        logger.error(`Failed to load ${table}`, error);
        return [];
      }

      return (data || []).map((row) => row[column as keyof typeof row] as T);
    };

    // ⚡ OPTIMIZATION: Combine ID fetching and row querying into independent, chained promises.
    // This removes the sequential bottleneck of waiting for all IDs across all entity types
    // to load before fetching *any* of the associated row data.
    const fetchAssociatedRows = async <T,>(
      idTable: string,
      idColumn: string,
      rowTable: string,
    ): Promise<T[]> => {
      const ids = await fetchIds<string>(idTable, idColumn);
      if (!ids.length) return [];

      const { data, error } = await supabase
        .from(rowTable)
        .select("*")
        .in("id", ids);

      if (error) {
        logger.error(`Failed to load ${rowTable}`, error);
        return [];
      }

      return (data || []) as T[];
    };

    const [notesData, papersData, ideasData] = await Promise.all([
      fetchAssociatedRows<Note>("topic_notes", "note_id", "notes"),
      fetchAssociatedRows<Paper>("topic_papers", "paper_id", "papers"),
      fetchAssociatedRows<Idea>("topic_ideas", "idea_id", "ideas"),
    ]);

    setNotes(notesData);
    setPapers(papersData);
    setIdeas(ideasData);
    setLoadingAssociations(false);
  }, [topic.id, userId]);

  useEffect(() => {
    void loadAssociations();
  }, [loadAssociations, topic.idea_count, topic.note_count, topic.paper_count]);

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

  const associationSummary = useMemo(
    () => [
      {
        label: "Notes",
        count: topic.note_count,
        items: notes,
        icon: FileText,
        view: "notes" as const,
      },
      {
        label: "Papers",
        count: topic.paper_count,
        items: papers,
        icon: BookOpen,
        view: "papers" as const,
      },
      {
        label: "Ideas",
        count: topic.idea_count,
        items: ideas,
        icon: Lightbulb,
        view: "ideas" as const,
      },
    ],
    [
      ideas,
      notes,
      papers,
      topic.idea_count,
      topic.note_count,
      topic.paper_count,
    ],
  );

  return (
    <>
      <ConfirmDialog
        isOpen={isOpen}
        title={config.title || "Confirm Action"}
        message={config.message || "Are you sure?"}
        confirmText={config.confirmText}
        cancelText={config.cancelText}
        variant={config.variant}
        onConfirm={config.onConfirm!}
        onClose={config.onClose!}
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
                className="w-full px-3 py-2 text-xl font-semibold bg-bg-base border border-border-subtle rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            ) : (
              <h1 className="text-2xl font-bold text-text-primary">
                {topic.name}
              </h1>
            )}
            {isEditing ? (
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                maxLength={500}
                className="w-full px-3 py-2 text-small bg-bg-base border border-border-subtle rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Describe what belongs in this topic..."
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
                  className="inline-flex items-center gap-2 px-3 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setName(topic.name);
                    setDescription(topic.description || "");
                  }}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-bg-elevated text-text-secondary rounded-md hover:bg-bg-base transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-bg-elevated text-text-secondary rounded-md hover:bg-bg-base transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-destructive/10 text-destructive rounded-md hover:bg-destructive/20 transition-colors"
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
            <h2 className="text-lg font-semibold text-text-primary">
              Connected work
            </h2>
            <p className="text-caption text-text-secondary">
              Jump back into the work linked to this topic.
            </p>
          </div>
          <button
            onClick={() => void loadAssociations()}
            className="inline-flex items-center gap-2 px-3 py-2 text-small bg-bg-elevated text-text-secondary rounded-md hover:bg-bg-base transition-colors"
          >
            Refresh
          </button>
        </div>
        <div className="divide-y divide-border-subtle">
          {associationSummary.map(
            ({ label, count, items, icon: Icon, view }) => (
              <div key={label} className="px-6 py-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-primary-500" />
                    <h3 className="text-small font-semibold text-text-primary">
                      {label}{" "}
                      <span className="text-text-tertiary font-normal">
                        ({count})
                      </span>
                    </h3>
                  </div>
                  {count > 0 && (
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
                  <p className="text-caption text-text-tertiary">Loading...</p>
                ) : count === 0 ? (
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
                    {count > 3 && (
                      <li className="text-caption text-text-tertiary">
                        {count - 3} more {label.toLowerCase()} linked
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

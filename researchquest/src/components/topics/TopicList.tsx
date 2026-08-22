import { ConfirmDialog, useConfirmDialog } from "../ui/ConfirmDialog";
import { EmptyState } from "../ui/EmptyState";
import { Skeleton } from "../ui/Skeleton";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { Trash2, Notebook, BookOpen, Lightbulb, Hash } from "lucide-react";
import { useAppStore } from "../../store/appStore";
import type { TopicWithCounts } from "../../types/database";
import { highlightMatch } from "../../utils/highlight";

interface TopicListProps {
  topics: TopicWithCounts[];
  loading: boolean;
  highlightQuery?: string;
  onSelectTopic: (topic: TopicWithCounts) => void;
  onDeleteTopic: (topicId: string) => Promise<boolean>;
}

export function TopicList({
  topics,
  loading,
  highlightQuery = "",
  onSelectTopic,
  onDeleteTopic,
}: TopicListProps) {
  const selectedTopic = useAppStore((state) => state.selectedTopic);
  const { confirm: confirmDialog, isOpen, config } = useConfirmDialog();

  if (loading) {
    return (
      <div className="space-y-2" role="status" aria-label="Loading topics...">
        <div aria-hidden="true" className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="space-y-3 rounded-surface border border-border-subtle bg-bg-surface p-4"
            >
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3 w-full" />
              <div className="grid grid-cols-3 gap-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!topics.length) {
    if (highlightQuery) {
      return (
        <EmptyState
          className="min-h-64"
          icon={<Hash className="h-6 w-6" />}
          title="No matches found"
          description="Try a different keyword or clear your search."
        />
      );
    }

    return (
      <EmptyState
        className="min-h-64"
        icon={<Hash className="h-6 w-6" />}
        title="No topics yet"
        description="Create a topic to start organizing your research."
      />
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
    <div className="space-y-2">
      {topics.map((topic) => {
        const isActive = selectedTopic?.id === topic.id;
        return (
          <div
            key={topic.id}
            className={`group w-full min-w-0 rounded-surface border px-4 py-3 text-left transition duration-fast ${
              isActive
                ? "border-primary-500 bg-primary-50 text-text-primary"
                : "border-border-subtle bg-bg-surface hover:border-border-moderate hover:bg-bg-elevated"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  aria-label={`Open topic: ${topic.name || "Untitled"}`}
                  aria-pressed={isActive}
                  onClick={() => onSelectTopic(topic)}
                  className="block w-full min-w-0 cursor-pointer rounded-sm text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
                >
                  <h2 className="truncate text-body font-semibold text-text-primary">
                    {topic.name ? highlightMatch(topic.name, highlightQuery) : "Untitled"}
                  </h2>
                </button>
                {topic.description && (
                  <p className="mt-1 line-clamp-2 break-words text-caption text-text-secondary">
                    {highlightMatch(topic.description, highlightQuery)}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 group-focus-within:opacity-100">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={async (event) => {
                        event.stopPropagation();
                        const shouldDelete = await confirmDialog({
                          title: "Delete Topic",
                          message: `Delete "${topic.name}"? This will remove its links.`,
                          confirmText: "Delete",
                          variant: "danger",
                        });
                        if (shouldDelete) {
                          void onDeleteTopic(topic.id);
                        }
                      }}
                      aria-label={`Delete ${topic.name}`}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control bg-bg-elevated text-text-tertiary transition-colors hover:bg-destructive-bg hover:text-destructive focus-visible:outline focus-visible:outline-2 focus-visible:outline-destructive focus-visible:outline-offset-2 md:min-h-0 md:min-w-0 md:p-1"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete topic</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-caption text-text-tertiary">
              <span className="inline-flex min-w-0 items-center gap-1 truncate" title={`${topic.note_count} ${topic.note_count === 1 ? "note" : "notes"}`}>
                <Notebook className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{topic.note_count} {topic.note_count === 1 ? "note" : "notes"}</span>
              </span>
              <span className="inline-flex min-w-0 items-center gap-1 truncate" title={`${topic.paper_count} ${topic.paper_count === 1 ? "paper" : "papers"}`}>
                <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{topic.paper_count} {topic.paper_count === 1 ? "paper" : "papers"}</span>
              </span>
              <span className="inline-flex min-w-0 items-center gap-1 truncate" title={`${topic.idea_count} ${topic.idea_count === 1 ? "idea" : "ideas"}`}>
                <Lightbulb className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{topic.idea_count} {topic.idea_count === 1 ? "idea" : "ideas"}</span>
              </span>
            </div>
          </div>
        );
      })}
    </div>
    </>
  );
}

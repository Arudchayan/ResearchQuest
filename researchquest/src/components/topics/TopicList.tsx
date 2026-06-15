import { ConfirmDialog, useConfirmDialog } from "../ui/ConfirmDialog";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { Loader2, Trash2, Notebook, BookOpen, Lightbulb, Hash } from "lucide-react";
import { useAppStore } from "../../store/appStore";
import type { TopicWithCounts } from "../../types/database";
import { highlightMatch } from "../../utils/highlight";
import { useCallback } from "react";

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

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>, topic: TopicWithCounts) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSelectTopic(topic);
      }
    },
    [onSelectTopic],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-text-tertiary">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="ml-2 text-small">Loading topics...</span>
      </div>
    );
  }

  const emptyMessage = !topics.length
    ? (highlightQuery ? "No matches found. Try a different keyword or clear your search." : "No topics yet. Create a topic to start organizing your research")
    : "";

  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        {emptyMessage}
      </div>

      {!topics.length ? (
        highlightQuery ? (
          <div
            className="text-center py-12 text-text-tertiary"
            aria-hidden="true"
          >
            <Hash className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-small font-semibold text-text-secondary">
              No matches found
            </p>
            <p className="text-caption mt-1">
              Try a different keyword or clear your search.
            </p>
          </div>
        ) : (
          <div className="text-center py-12 text-text-tertiary" aria-hidden="true">
            <Hash className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-small">No topics yet</p>
            <p className="text-caption mt-1">Create a topic to start organizing your research</p>
          </div>
        )
      ) : (
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
          <div className="space-y-2">
            {topics.map((topic) => {
              const isActive = selectedTopic?.id === topic.id;
              return (
                <div
                  key={topic.id}
                  role="button"
                  tabIndex={0}
                  aria-label={topic.name}
                  onClick={() => onSelectTopic(topic)}
                  onKeyDown={(event) => handleKeyDown(event, topic)}
                  className={`w-full text-left px-4 py-3 rounded-md border transition-colors group focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    isActive
                      ? "border-primary-500 bg-primary-500/10 text-text-primary"
                      : "border-border-subtle bg-bg-surface hover:border-primary-500/60 hover:bg-primary-500/5"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-small text-text-primary">
                        {topic.name ? highlightMatch(topic.name, highlightQuery) : "Untitled"}
                      </p>
                      {topic.description && (
                        <p className="text-caption text-text-secondary mt-1 line-clamp-2">
                          {highlightMatch(topic.description, highlightQuery)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={async (event) => {
                              event.stopPropagation();
                              const confirmed = await confirmDialog({
                                title: "Delete topic",
                                message: `Are you sure you want to delete "${topic.name}"? This will remove the topic from all linked notes, papers, and ideas.`,
                                confirmText: "Delete",
                                variant: "danger",
                              });
                              if (confirmed) {
                                await onDeleteTopic(topic.id);
                              }
                            }}
                            className="p-1.5 rounded-md text-text-tertiary hover:text-red-500 hover:bg-red-500/10 transition-colors"
                            aria-label={`Delete ${topic.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Delete topic</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

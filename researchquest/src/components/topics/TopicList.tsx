import { ConfirmDialog, useConfirmDialog } from "../ui/ConfirmDialog";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { Trash2, Hash } from "lucide-react";
import { useAppStore } from "../../store/appStore";
import type { TopicWithCounts } from "../../types/database";
import { highlightMatch } from "../../utils/highlight";
import { useCallback } from "react";
import { ListSkeleton } from "../ui/Skeleton";

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

  const emptyMessage = (!loading && !topics.length)
    ? (highlightQuery ? "No matches found. Try a different keyword or clear your search." : "No topics yet. Create a topic to start organizing your research")
    : "";

  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        {emptyMessage}
      </div>

      {loading ? (
        <div className="space-y-2" role="status" aria-label="Loading topics...">
          <p className="sr-only">Loading topics...</p>
          <ListSkeleton count={3} itemType="note" />
        </div>
      ) : !topics.length ? (
        highlightQuery ? (
          <div
            className="surface-card text-center p-8 text-text-tertiary"
          >
            <div className="icon-tile mx-auto mb-3 bg-bg-elevated text-text-tertiary">
              <Hash className="h-5 w-5 opacity-70" aria-hidden="true" />
            </div>
            <p className="text-small font-semibold text-text-secondary">
              No matches found
            </p>
            <p className="text-caption mt-1">
              Try a different keyword or clear your search.
            </p>
          </div>
        ) : (
          <div className="surface-card text-center p-8 text-text-tertiary">
            <div className="icon-tile mx-auto mb-3 bg-bg-elevated text-text-tertiary">
              <Hash className="h-5 w-5 opacity-70" aria-hidden="true" />
            </div>
            <p className="text-small font-medium text-text-secondary">No topics yet</p>
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
                  className={`surface-card w-full text-left p-3.5 rounded-lg transition-all group focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    isActive
                      ? "border-primary-500 bg-primary-500/10 text-text-primary"
                      : "hover:-translate-y-0.5"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="icon-tile mt-0.5 bg-accent-soft text-accent-strong">
                      <Hash className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-small text-text-primary">
                            {topic.name ? highlightMatch(topic.name, highlightQuery) : "Untitled"}
                          </p>
                          {topic.description && (
                            <p className="text-caption text-text-secondary mt-1 line-clamp-2">
                              {highlightMatch(topic.description, highlightQuery)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
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
                                className="icon-btn h-8 w-8 rounded-lg text-text-tertiary hover:text-red-500 hover:bg-red-500/10"
                                aria-label={`Delete ${topic.name}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Delete topic</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-blue-soft px-2 py-0.5 text-caption font-medium text-blue-strong">
                          {topic.note_count} notes
                        </span>
                        <span className="rounded-full bg-violet-soft px-2 py-0.5 text-caption font-medium text-violet-strong">
                          {topic.paper_count} papers
                        </span>
                        <span className="rounded-full bg-gold-soft px-2 py-0.5 text-caption font-medium text-gold-strong">
                          {topic.idea_count} ideas
                        </span>
                      </div>
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

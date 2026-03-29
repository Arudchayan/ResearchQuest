import { useMemo, useState, memo, useCallback, useRef, useEffect } from "react";
import { Clock, Lightbulb, Trash2, TrendingUp, Search } from "lucide-react";
import type { Idea, IdeaStage } from "../../types/database";
import { ListSkeleton } from "../ui/Skeleton";
import { highlightMatch } from "../../utils/highlight";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { toast } from "sonner";

interface IdeaCardProps {
  idea: Idea;
  onSelect: (idea: Idea) => void;
  onDelete: (idea: Idea) => void;
  onStageChange: (id: string, stage: IdeaStage, oldStage: IdeaStage) => void;
  isSelected: boolean;
  searchQuery?: string;
}

const STAGE_FILTER_OPTIONS: { value: IdeaStage | "all"; label: string }[] = [
  { value: "all", label: "All stages" },
  { value: "Seed", label: "Seed" },
  { value: "Developing", label: "Developing" },
  { value: "Supported", label: "Supported" },
  { value: "Mature", label: "Mature" },
];

const IdeaCardComponent = ({
  idea,
  onSelect,
  onDelete,
  onStageChange,
  isSelected,
  searchQuery = "",
}: IdeaCardProps) => {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(idea);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(idea);
    }
  };

  const getStageColor = (stage: IdeaStage) => {
    switch (stage) {
      case "Seed":
        return "bg-warning-bg text-warning border-warning";
      case "Developing":
        return "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400";
      case "Supported":
        return "bg-purple-bg text-purple border-purple";
      case "Mature":
        return "bg-success-bg text-success border-success";
    }
  };

  return (
    <div
      role="button"
      onClick={() => onSelect(idea)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className={`p-3 rounded-md border cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 ${
        isSelected
          ? "bg-bg-elevated border-primary-500"
          : "bg-bg-surface border-border-subtle hover:border-border-moderate hover:shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Lightbulb className="w-4 h-4 text-text-tertiary flex-shrink-0" />
          <h4 className="text-small font-semibold text-text-primary line-clamp-2">
            {highlightMatch(idea.title, searchQuery)}
          </h4>
        </div>
        <button
          onClick={handleDelete}
          className="p-1 rounded hover:bg-bg-elevated transition-colors flex-shrink-0 text-text-tertiary"
          title="Delete idea"
          aria-label="Delete idea"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {idea.description && (
        <p className="text-caption text-text-secondary line-clamp-2 mb-2">
          {highlightMatch(idea.description, searchQuery)}
        </p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={idea.stage}
          onChange={(e) => {
            e.stopPropagation();
            onStageChange(idea.id, e.target.value as IdeaStage, idea.stage);
          }}
          className={`px-3 py-1.5 text-small rounded-md border ${getStageColor(idea.stage)} transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-[120px]`}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Update stage for ${idea.title}`}
        >
          <option value="Seed">Seed</option>
          <option value="Developing">Developing</option>
          <option value="Supported">Supported</option>
          <option value="Mature">Mature</option>
        </select>

        {(idea.linked_note_ids?.length || 0) +
          (idea.linked_paper_ids?.length || 0) >
          0 && (
          <div className="flex items-center gap-1 text-caption text-text-tertiary">
            <TrendingUp className="w-3 h-3" />
            <span>
              {(idea.linked_note_ids?.length || 0) +
                (idea.linked_paper_ids?.length || 0)}{" "}
              connections
            </span>
          </div>
        )}

        <div className="flex items-center gap-1 ml-auto text-caption text-text-tertiary">
          <Clock className="w-3 h-3" />
          <span>{new Date(idea.updated_at).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
};

export const IdeaCard = memo(IdeaCardComponent);

interface IdeaListProps {
  ideas: Idea[];
  onSelectIdea: (idea: Idea) => void;
  onDeleteIdea: (id: string) => Promise<boolean>;
  onRestoreIdea: (idea: Idea) => Promise<Idea | null>;
  onStageChange: (id: string, stage: IdeaStage, oldStage: IdeaStage) => void;
  selectedIdeaId?: string;
  loading?: boolean;
}

export function IdeaList({
  ideas,
  onSelectIdea,
  onDeleteIdea,
  onRestoreIdea,
  onStageChange,
  selectedIdeaId,
  loading = false,
}: IdeaListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<IdeaStage | "all">("all");
  const [ideaToDelete, setIdeaToDelete] = useState<Idea | null>(null);
  const [deleting, setDeleting] = useState(false);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDeletedRef = useRef<Idea | null>(null);

  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
    };
  }, []);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredIdeas = useMemo(() => {
    // Optimization: Return original array if no filters are active
    if (stageFilter === "all" && !normalizedQuery) {
      return ideas;
    }

    return ideas.filter((idea) => {
      const matchesStage = stageFilter === "all" || idea.stage === stageFilter;
      if (!matchesStage) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const titleMatch = idea.title.toLowerCase().includes(normalizedQuery);
      const descriptionMatch =
        idea.description?.toLowerCase().includes(normalizedQuery) ?? false;

      return titleMatch || descriptionMatch;
    });
  }, [ideas, normalizedQuery, stageFilter]);

  const handleDeleteRequest = useCallback((candidate: Idea) => {
    setIdeaToDelete(candidate);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!ideaToDelete) return;
    setDeleting(true);
    const idea = ideaToDelete;
    const success = await onDeleteIdea(idea.id);
    setDeleting(false);
    setIdeaToDelete(null);

    if (success) {
      lastDeletedRef.current = idea;
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }

      const toastId = toast.success("Idea deleted", {
        description: "Undo within 6 seconds to restore it.",
        duration: 6000,
        action: {
          label: "Undo",
          onClick: async () => {
            if (lastDeletedRef.current) {
              await onRestoreIdea(lastDeletedRef.current);
              lastDeletedRef.current = null;
              if (undoTimeoutRef.current) {
                clearTimeout(undoTimeoutRef.current);
                undoTimeoutRef.current = null;
              }
              toast.dismiss(toastId);
            }
          },
        },
      });

      undoTimeoutRef.current = setTimeout(() => {
        lastDeletedRef.current = null;
        toast.dismiss(toastId);
        undoTimeoutRef.current = null;
      }, 6000);
    }
  }, [ideaToDelete, onDeleteIdea, onRestoreIdea]);

  if (loading) {
    return <ListSkeleton count={5} itemType="idea" />;
  }

  if (ideas.length === 0) {
    return (
      <div className="text-center py-12 text-text-tertiary">
        <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-small">No ideas yet</p>
        <p className="text-caption mt-1">Create your first idea above</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <div className="space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 text-text-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Filter ideas by keyword..."
              className="w-full pl-10 pr-3 py-2 border border-border-subtle rounded-md bg-bg-base text-small focus:outline-none focus:ring-2 focus:ring-primary-500"
              aria-label="Filter ideas"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {STAGE_FILTER_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setStageFilter(value)}
                className={`px-3 py-1.5 rounded-full border text-caption font-medium transition-colors ${
                  stageFilter === value
                    ? "bg-primary-500/10 border-primary-500 text-primary-600"
                    : "bg-bg-base border-border-subtle text-text-secondary hover:border-border-moderate"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {filteredIdeas.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-border-subtle rounded-md text-caption text-text-tertiary">
            No ideas match your filters yet.
          </div>
        ) : (
          <div className="space-y-2">
            {filteredIdeas.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                onSelect={onSelectIdea}
                onDelete={handleDeleteRequest}
                onStageChange={onStageChange}
                isSelected={idea.id === selectedIdeaId}
                searchQuery={searchQuery}
              />
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={Boolean(ideaToDelete)}
        onClose={() => {
          if (!deleting) {
            setIdeaToDelete(null);
          }
        }}
        onConfirm={() => {
          void handleConfirmDelete();
        }}
        title="Delete idea"
        message={`Are you sure you want to delete "${ideaToDelete?.title || "Untitled Idea"}"? You can undo for a short time after deleting.`}
        confirmText="Delete"
        cancelText="Cancel"
        isLoading={deleting}
      />
    </>
  );
}

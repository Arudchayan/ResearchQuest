import { useState, memo, useCallback, useRef, useEffect } from "react";
import { Clock, BookOpen, Trash2, ExternalLink } from "lucide-react";
import type { Paper, ReadingStatus } from "../../types/database";
import { ListSkeleton } from "../ui/Skeleton";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { toast } from "sonner";

interface PaperCardProps {
  paper: Paper;
  onSelect: (paper: Paper) => void;
  onDelete: (paper: Paper) => void;
  onStatusChange: (id: string, status: ReadingStatus) => void;
  isSelected: boolean;
}

const PaperCardComponent = ({
  paper,
  onSelect,
  onDelete,
  onStatusChange,
  isSelected,
}: PaperCardProps) => {
  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete(paper);
    },
    [onDelete, paper],
  );

  const handleSelect = useCallback(() => {
    onSelect(paper);
  }, [onSelect, paper]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect(paper);
      }
    },
    [onSelect, paper],
  );

  const handleStatusChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      e.stopPropagation();
      onStatusChange(paper.id, e.target.value as ReadingStatus);
    },
    [onStatusChange, paper.id],
  );

  const getStatusColor = (status: ReadingStatus) => {
    switch (status) {
      case "Read":
        return "bg-success-bg text-success border-success";
      case "Reading":
        return "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400";
      default:
        return "bg-bg-elevated text-text-tertiary border-border-moderate";
    }
  };

  return (
    <div
      role="button"
      onClick={handleSelect}
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
          <BookOpen className="w-4 h-4 text-text-tertiary flex-shrink-0" />
          <h4 className="text-small font-semibold text-text-primary line-clamp-2">
            {paper.title}
          </h4>
        </div>
        <button
          onClick={handleDelete}
          className="p-1 rounded hover:bg-bg-elevated transition-colors flex-shrink-0 text-text-tertiary"
          title="Delete paper"
          aria-label="Delete paper"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {paper.authors && paper.authors.length > 0 && (
        <p className="text-caption text-text-secondary mb-1.5">
          {paper.authors.slice(0, 3).join(", ")}
          {paper.authors.length > 3 ? ", et al." : ""}
        </p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={paper.status}
          onChange={handleStatusChange}
          className={`px-2 py-1 text-caption rounded-md border ${getStatusColor(paper.status)} transition-colors`}
          onClick={(e) => e.stopPropagation()}
        >
          <option value="To Read">To Read</option>
          <option value="Reading">Reading</option>
          <option value="Read">Read</option>
        </select>

        {paper.doi && (
          <a
            href={`https://doi.org/${paper.doi}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-caption text-primary-500 hover:text-primary-600"
          >
            <ExternalLink className="w-3 h-3" />
            <span>DOI</span>
          </a>
        )}

        <div className="flex items-center gap-1 ml-auto text-caption text-text-tertiary">
          <Clock className="w-3 h-3" />
          <span>{new Date(paper.updated_at).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
};

export const PaperCard = memo(PaperCardComponent);

interface PaperListProps {
  papers: Paper[];
  onSelectPaper: (paper: Paper) => void;
  onDeletePaper: (id: string) => Promise<boolean>;
  onRestorePaper: (paper: Paper) => Promise<Paper | null>;
  onStatusChange: (id: string, status: ReadingStatus) => void;
  selectedPaperId?: string;
  loading?: boolean;
  searchQuery?: string;
}

export function PaperList({
  papers,
  onSelectPaper,
  onDeletePaper,
  onRestorePaper,
  onStatusChange,
  selectedPaperId,
  loading = false,
  searchQuery = "",
}: PaperListProps) {
  const [paperToDelete, setPaperToDelete] = useState<Paper | null>(null);
  const [deleting, setDeleting] = useState(false);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDeletedRef = useRef<Paper | null>(null);

  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
    };
  }, []);

  const handleDeleteRequest = useCallback((candidate: Paper) => {
    setPaperToDelete(candidate);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!paperToDelete) return;
    setDeleting(true);
    const paper = paperToDelete;
    const success = await onDeletePaper(paper.id);
    setDeleting(false);
    setPaperToDelete(null);

    if (success) {
      lastDeletedRef.current = paper;
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }

      const toastId = toast.success("Paper deleted", {
        description: "Undo within 6 seconds to restore it.",
        duration: 6000,
        action: {
          label: "Undo",
          onClick: async () => {
            if (lastDeletedRef.current) {
              await onRestorePaper(lastDeletedRef.current);
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
  }, [paperToDelete, onDeletePaper, onRestorePaper]);

  if (loading) {
    return <ListSkeleton count={5} itemType="paper" />;
  }

  if (papers.length === 0) {
    if (searchQuery) {
      return (
        <div
          className="text-center py-12 text-text-tertiary"
          role="status"
          aria-live="polite"
        >
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" aria-hidden="true" />
          <p className="text-small font-semibold text-text-secondary">
            No matches found
          </p>
          <p className="text-caption mt-1">
            Try a different keyword or clear your search.
          </p>
        </div>
      );
    }

    return (
      <div className="text-center py-12 text-text-tertiary" role="status" aria-live="polite">
        <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" aria-hidden="true" />
        <p className="text-small">No papers yet</p>
        <p className="text-caption mt-1">Add your first paper above</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {papers.map((paper) => (
          <PaperCard
            key={paper.id}
            paper={paper}
            onSelect={onSelectPaper}
            onDelete={handleDeleteRequest}
            onStatusChange={onStatusChange}
            isSelected={paper.id === selectedPaperId}
          />
        ))}
      </div>

      <ConfirmDialog
        isOpen={Boolean(paperToDelete)}
        onClose={() => {
          if (!deleting) {
            setPaperToDelete(null);
          }
        }}
        onConfirm={() => {
          void handleConfirmDelete();
        }}
        title="Delete paper"
        message={`Are you sure you want to delete "${paperToDelete?.title || "Untitled Paper"}"? You can undo for a short time after deleting.`}
        confirmText="Delete"
        cancelText="Cancel"
        isLoading={deleting}
      />
    </>
  );
}

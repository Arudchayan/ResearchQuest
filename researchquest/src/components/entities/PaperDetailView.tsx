import { useState, useEffect, useRef, useId } from "react";
import {
  BookOpen,
  Calendar,
  ExternalLink,
  Edit2,
  Save,
  X,
  Link as LinkIcon,
  Sparkles,
  Trash,
  Quote,
  FileText,
  Download,
  Table,
  FileJson,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { Paper, ReadingStatus } from "../../types/database";
import { toast } from "sonner";
import { isValidUrl } from "../../utils/security";
import { TopicSelector } from "../topics/TopicSelector";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { CitationDialog } from "../papers/CitationDialog";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { useNotes } from "../../hooks/useNotes";
import { useAppStore } from "../../store/appStore";
import {
  convertPapersToMarkdown,
  convertPapersToCSV,
  convertPapersToJSON,
  convertPapersToBibTeX,
  downloadFile,
} from "../../utils/export";
import { logger } from "../../utils/logger";

interface PaperDetailViewProps {
  paper: Paper;
  onUpdate: (paperId: string, updates: Partial<Paper>) => Promise<boolean>;
  onDelete?: (paperId: string) => Promise<boolean>;
}

export function PaperDetailView({
  paper,
  onUpdate,
  onDelete,
}: PaperDetailViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(paper.title);
  const [editedAuthors, setEditedAuthors] = useState(paper.authors.join(", "));
  const [editedAbstract, setEditedAbstract] = useState(paper.abstract || "");
  const [editedStatus, setEditedStatus] = useState(paper.status);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCitation, setShowCitation] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isMounted = useRef(true);

  const authorsInputId = useId();
  const statusInputId = useId();

  const { createNote } = useNotes(useAppStore.getState().user?.id);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    setEditedTitle(paper.title);
    setEditedAuthors(paper.authors.join(", "));
    setEditedAbstract(paper.abstract || "");
    setEditedStatus(paper.status);
    setIsEditing(false);
  }, [paper.id, paper.title, paper.authors, paper.abstract, paper.status]);

  const handleSave = async () => {
    const updates: Partial<Paper> = {
      title: editedTitle,
      authors: editedAuthors
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean),
      abstract: editedAbstract || undefined,
      status: editedStatus,
    };

    const success = await onUpdate(paper.id, updates);
    if (success) {
      setIsEditing(false);
      toast.success("Paper updated successfully");
    }
  };

  const handleCancel = () => {
    setEditedTitle(paper.title);
    setEditedAuthors(paper.authors.join(", "));
    setEditedAbstract(paper.abstract || "");
    setEditedStatus(paper.status);
    setIsEditing(false);
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    await onDelete(paper.id);

    if (isMounted.current) {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleCreateNote = async () => {
    const newNote = await createNote({
      title: `Notes on: ${paper.title}`,
      markdown_body: `# ${paper.title}\n\n[Paper Source](${paper.source_url || (paper.doi ? `https://doi.org/${paper.doi}` : "#")})\n\n## Summary\n${paper.abstract || ""}\n\n## Notes\n`,
      linked_entity_ids: [paper.id],
    });

    if (newNote) {
      useAppStore.getState().setSelectedNote(newNote);
      useAppStore.getState().setSelectedPaper(null);
      useAppStore.getState().setCurrentView("notes");
      window.history.pushState(null, "", `/notes/${newNote.id}`);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  };

  const getStatusColor = (status: ReadingStatus) => {
    switch (status) {
      case "Read":
        return "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700";
      case "Reading":
        return "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700";
      default:
        return "bg-gray-100 dark:bg-gray-900/20 text-gray-700 dark:text-gray-400 border-gray-300 dark:border-gray-700";
    }
  };

  const statusCopy: Record<ReadingStatus, { title: string; helper: string }> = {
    "To Read": {
      title: "Queue it up",
      helper:
        "Skim the abstract and block a quick focus session to unlock your first XP for this paper.",
    },
    Reading: {
      title: "Stay in flow",
      helper:
        "Log highlights or open questions while you read—updating progress keeps Focus Studio in sync.",
    },
    Read: {
      title: "Wrap and reflect",
      helper:
        "Capture a short summary or next action. Marking papers as read awards bonus XP streak credit.",
    },
  };

  const statusOrder: ReadingStatus[] = ["To Read", "Reading", "Read"];
  const statusForProgress = isEditing ? editedStatus : paper.status;
  const statusIndex = Math.max(0, statusOrder.indexOf(statusForProgress));
  const progressPercent = Math.round(
    ((statusIndex + 1) / statusOrder.length) * 100,
  );

  const handleExport = (format: "markdown" | "bibtex" | "csv" | "json") => {
    try {
      let content = "";
      let filename = "";
      const timestamp = new Date().toISOString().split("T")[0];

      switch (format) {
        case "markdown":
          content = convertPapersToMarkdown([paper]);
          filename = `paper-${paper.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${timestamp}.md`;
          break;
        case "bibtex":
          content = convertPapersToBibTeX([paper]);
          filename = `paper-${paper.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${timestamp}.bib`;
          break;
        case "csv":
          content = convertPapersToCSV([paper]);
          filename = `paper-${paper.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${timestamp}.csv`;
          break;
        case "json":
          content = convertPapersToJSON([paper]);
          filename = `paper-${paper.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${timestamp}.json`;
          break;
      }

      downloadFile(content, filename, format);
      toast.success(`Exported paper as ${format.toUpperCase()}`);
    } catch (err: any) {
      logger.error("Export failed", err);
      toast.error(err.message || "Failed to export paper");
    }
  };

  return (
    <>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-bg-surface rounded-lg border border-border-subtle shadow-sm">
          {/* Header */}
          <div className="p-6 border-b border-border-subtle">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="p-3 bg-bg-elevated rounded-lg">
                  <BookOpen className="w-6 h-6 text-primary-500" />
                </div>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    maxLength={255}
                    className="flex-1 text-2xl font-bold text-text-primary bg-bg-base border border-border-subtle rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Paper title..."
                    aria-label="Paper title"
                  />
                ) : (
                  <h1 className="text-2xl font-bold text-text-primary">
                    {paper.title}
                  </h1>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={handleSave}
                          className="p-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors"
                          aria-label="Save changes"
                        >
                          <Save className="w-5 h-5" aria-hidden="true" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Save changes</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={handleCancel}
                          className="p-2 bg-bg-elevated text-text-secondary rounded-md hover:bg-bg-base transition-colors"
                          aria-label="Cancel"
                        >
                          <X className="w-5 h-5" aria-hidden="true" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Cancel</TooltipContent>
                    </Tooltip>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <DropdownMenu.Root>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenu.Trigger asChild>
                            <button
                              className="p-2 bg-bg-elevated text-text-secondary rounded-md hover:bg-bg-base transition-colors"
                              aria-label="Export paper"
                            >
                              <Download className="w-5 h-5" aria-hidden="true" />
                            </button>
                          </DropdownMenu.Trigger>
                        </TooltipTrigger>
                        <TooltipContent>Export paper</TooltipContent>
                      </Tooltip>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content
                          className="min-w-[160px] bg-bg-surface border border-border-subtle rounded-md shadow-md p-1 z-50 animate-in fade-in zoom-in-95"
                          align="end"
                        >
                          <DropdownMenu.Item
                            className="flex items-center gap-2 px-2 py-1.5 text-sm text-text-primary hover:bg-bg-elevated rounded cursor-pointer outline-none"
                            onSelect={() => handleExport("markdown")}
                          >
                            <FileText className="w-4 h-4 text-text-secondary" />
                            Markdown
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            className="flex items-center gap-2 px-2 py-1.5 text-sm text-text-primary hover:bg-bg-elevated rounded cursor-pointer outline-none"
                            onSelect={() => handleExport("bibtex")}
                          >
                            <Quote className="w-4 h-4 text-text-secondary" />
                            BibTeX
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            className="flex items-center gap-2 px-2 py-1.5 text-sm text-text-primary hover:bg-bg-elevated rounded cursor-pointer outline-none"
                            onSelect={() => handleExport("csv")}
                          >
                            <Table className="w-4 h-4 text-text-secondary" />
                            CSV
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            className="flex items-center gap-2 px-2 py-1.5 text-sm text-text-primary hover:bg-bg-elevated rounded cursor-pointer outline-none"
                            onSelect={() => handleExport("json")}
                          >
                            <FileJson className="w-4 h-4 text-text-secondary" />
                            JSON
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setIsEditing(true)}
                          className="p-2 bg-bg-elevated text-text-secondary rounded-md hover:bg-bg-base transition-colors"
                          aria-label="Edit paper"
                        >
                          <Edit2 className="w-5 h-5" aria-hidden="true" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Edit paper</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={handleCreateNote}
                          className="p-2 bg-bg-elevated text-text-secondary rounded-md hover:bg-bg-base transition-colors"
                          aria-label="Create linked note"
                        >
                          <FileText className="w-5 h-5" aria-hidden="true" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Create linked note</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setShowCitation(true)}
                          className="p-2 bg-bg-elevated text-text-secondary rounded-md hover:bg-bg-base transition-colors"
                          aria-label="Cite paper"
                        >
                          <Quote className="w-5 h-5" aria-hidden="true" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Cite paper</TooltipContent>
                    </Tooltip>
                    {onDelete && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={handleDeleteClick}
                            className="p-2 bg-bg-elevated text-red-600 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            aria-label="Delete paper"
                          >
                            <Trash className="w-5 h-5" aria-hidden="true" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Delete paper</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Authors */}
            <div className="space-y-2 mb-4">
              <label htmlFor={authorsInputId} className="block text-sm font-medium text-text-secondary">
                Authors
              </label>
              {isEditing ? (
                <input
                  id={authorsInputId}
                  type="text"
                  value={editedAuthors}
                  onChange={(e) => setEditedAuthors(e.target.value)}
                  maxLength={1000}
                  className="w-full px-4 py-2 bg-bg-base border border-border-subtle rounded-md text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Author 1, Author 2, et al."
                />
              ) : (
                <p className="text-lg text-text-secondary">
                  {paper.authors.join(", ")}
                </p>
              )}
            </div>

            {/* Status Selector */}
            <div className="space-y-2">
              <label htmlFor={statusInputId} className="block text-sm font-medium text-text-secondary">
                Reading Status
              </label>
              {isEditing ? (
                <select
                  id={statusInputId}
                  value={editedStatus}
                  onChange={(e) =>
                    setEditedStatus(e.target.value as ReadingStatus)
                  }
                  className={`px-4 py-2 rounded-md border text-sm font-medium ${getStatusColor(editedStatus)} focus:outline-none focus:ring-2 focus:ring-primary-500`}
                >
                  <option value="To Read">📚 To Read</option>
                  <option value="Reading">📖 Reading</option>
                  <option value="Read">✅ Read</option>
                </select>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setIsEditing(true)}
                        className={`inline-flex items-center px-4 py-2 rounded-md border text-sm font-medium transition-all ${getStatusColor(paper.status)} hover:ring-2 hover:ring-primary-500`}
                        aria-label="Change status"
                      >
                        {paper.status === "To Read" && "📚"}
                        {paper.status === "Reading" && "📖"}
                        {paper.status === "Read" && "✅"}
                        <span className="ml-2">{paper.status}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Click to change status</TooltipContent>
                  </Tooltip>
                  <button
                    onClick={async () => {
                      // Cycle through statuses
                      const statusOrder: ReadingStatus[] = [
                        "To Read",
                        "Reading",
                        "Read",
                      ];
                      const currentIndex = statusOrder.indexOf(paper.status);
                      const nextStatus =
                        statusOrder[(currentIndex + 1) % statusOrder.length];
                      await onUpdate(paper.id, { status: nextStatus });
                    }}
                    className="px-3 py-2 text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium transition-colors"
                  >
                    Next →
                  </button>
                </div>
              )}
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between text-caption text-text-tertiary uppercase tracking-wide">
                  <span>{statusCopy[statusForProgress].title}</span>
                  <span>{progressPercent}% complete</span>
                </div>
                <div className="h-2 bg-bg-base rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary-500 via-primary-500 to-primary-600 transition-all"
                    style={{ width: `${progressPercent}%` }}
                    aria-hidden
                  />
                </div>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {statusCopy[statusForProgress].helper}
                </p>
                <div className="flex items-start gap-3 rounded-lg border border-border-subtle bg-bg-elevated/60 p-3">
                  <Sparkles className="w-4 h-4 text-primary-500 mt-0.5" />
                  <p className="text-sm text-text-secondary leading-relaxed">
                    Updating statuses, linking topics, or finishing summaries
                    all grant XP. Every change is reflected instantly in Focus
                    Studio so you can track your research momentum.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Abstract */}
          {(paper.abstract || isEditing) && (
            <div className="p-6 border-b border-border-subtle">
              <h2 className="text-lg font-semibold text-text-primary mb-3">
                Abstract
              </h2>
              {isEditing ? (
                <textarea
                  value={editedAbstract}
                  onChange={(e) => setEditedAbstract(e.target.value)}
                  rows={8}
                  maxLength={10000}
                  className="w-full px-4 py-3 bg-bg-base border border-border-subtle rounded-md text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  placeholder="Enter or paste the paper's abstract..."
                />
              ) : (
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <p className="text-body text-text-secondary leading-relaxed whitespace-pre-wrap">
                    {paper.abstract}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Metadata & Links */}
          <div className="p-6 space-y-4">
            <TopicSelector entityId={paper.id} entityType="paper" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {paper.publication_date && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-text-tertiary">
                    <Calendar className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      Publication Date
                    </span>
                  </div>
                  <p className="text-text-primary">{paper.publication_date}</p>
                </div>
              )}

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-text-tertiary">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm font-medium">Added to Library</span>
                </div>
                <p className="text-text-primary">
                  {new Date(paper.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>

            {/* External Links */}
            <div className="pt-4 border-t border-border-subtle">
              <div className="flex flex-wrap gap-3">
                {paper.doi && (
                  <a
                    href={`https://doi.org/${paper.doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors"
                  >
                    <LinkIcon className="w-4 h-4" />
                    View DOI
                  </a>
                )}
                {paper.source_url && isValidUrl(paper.source_url) && (
                  <a
                    href={paper.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-bg-elevated text-text-primary border border-border-subtle rounded-md hover:bg-bg-base transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View Source
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tips Card */}
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
            💡 Pro Tip
          </h3>
          <p className="text-sm text-blue-800 dark:text-blue-400">
            Update the reading status as you progress through the paper. This
            helps track your research progress and earns you XP!
          </p>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => void handleConfirmDelete()}
        title="Delete paper"
        message={`Are you sure you want to delete "${paper.title}"? You can undo for a short time after deleting.`}
        confirmText="Delete"
        cancelText="Cancel"
        isLoading={deleting}
      />

      <CitationDialog
        paper={paper}
        isOpen={showCitation}
        onOpenChange={setShowCitation}
      />
    </>
  );
}

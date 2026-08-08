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
  ShieldAlert,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { Paper, ReadingStatus } from "../../types/database";
import { toast } from "sonner";
import { isValidUrl } from "../../utils/security";
import { TopicSelector } from "../topics/TopicSelector";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { CitationDialog } from "../papers/CitationDialog";
import { AdversarialReviewPanel } from "../analysis/AdversarialReviewPanel";
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
  const [showAdversarial, setShowAdversarial] = useState(false);
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
        return "bg-success-bg text-success border border-success/20";
      case "Reading":
        return "bg-blue-soft text-blue-strong border border-blue/20";
      default:
        return "bg-gold-soft text-gold-strong border border-gold/20";
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
        <div className="surface-panel overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-border-subtle">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="icon-tile shrink-0 bg-violet-soft text-violet-strong">
                  <BookOpen className="h-6 w-6" aria-hidden="true" />
                </span>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    maxLength={255}
                    className="min-w-0 flex-1 rounded-lg border border-border-moderate bg-bg-surface px-4 py-2 text-xl font-bold text-text-primary shadow-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                    placeholder="Paper title..."
                    aria-label="Paper title"
                  />
                ) : (
                  <h1 className="min-w-0 break-words font-serif text-2xl font-bold text-text-primary">
                    {paper.title}
                  </h1>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {isEditing ? (
                  <>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={handleSave}
                          className="icon-btn bg-accent-soft text-accent-strong hover:bg-accent/20"
                          aria-label="Save changes"
                        >
                          <Save className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Save changes</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={handleCancel}
                          className="icon-btn bg-bg-elevated text-text-secondary hover:bg-bg-surface hover:text-text-primary"
                          aria-label="Cancel"
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
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
                              className="icon-btn bg-bg-elevated text-text-secondary hover:bg-bg-surface hover:text-text-primary"
                              aria-label="Export paper"
                            >
                              <Download className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </DropdownMenu.Trigger>
                        </TooltipTrigger>
                        <TooltipContent>Export paper</TooltipContent>
                      </Tooltip>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content
                          className="min-w-[160px] bg-bg-surface border border-border-moderate rounded-lg shadow-lift p-1 z-50 animate-in fade-in zoom-in-95"
                          align="end"
                        >
                          <DropdownMenu.Item
                            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-text-primary hover:bg-bg-elevated cursor-pointer outline-none"
                            onSelect={() => handleExport("markdown")}
                          >
                            <FileText className="h-4 w-4 text-text-secondary" />
                            Markdown
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-text-primary hover:bg-bg-elevated cursor-pointer outline-none"
                            onSelect={() => handleExport("bibtex")}
                          >
                            <Quote className="h-4 w-4 text-text-secondary" />
                            BibTeX
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-text-primary hover:bg-bg-elevated cursor-pointer outline-none"
                            onSelect={() => handleExport("csv")}
                          >
                            <Table className="h-4 w-4 text-text-secondary" />
                            CSV
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-text-primary hover:bg-bg-elevated cursor-pointer outline-none"
                            onSelect={() => handleExport("json")}
                          >
                            <FileJson className="h-4 w-4 text-text-secondary" />
                            JSON
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setIsEditing(true)}
                          className="icon-btn bg-bg-elevated text-text-secondary hover:bg-bg-surface hover:text-text-primary"
                          aria-label="Edit paper"
                        >
                          <Edit2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Edit paper</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={handleCreateNote}
                          className="icon-btn bg-bg-elevated text-text-secondary hover:bg-bg-surface hover:text-text-primary"
                          aria-label="Create linked note"
                        >
                          <FileText className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Create linked note</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setShowCitation(true)}
                          className="icon-btn bg-bg-elevated text-text-secondary hover:bg-bg-surface hover:text-text-primary"
                          aria-label="Cite paper"
                        >
                          <Quote className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Cite paper</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setShowAdversarial(true)}
                          className="icon-btn bg-coral-soft text-coral-strong hover:bg-coral/20"
                          aria-label="Adversarial review paper"
                        >
                          <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Adversarial review</TooltipContent>
                    </Tooltip>
                    {onDelete && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={handleDeleteClick}
                            className="icon-btn bg-coral-soft text-coral-strong hover:bg-coral/20"
                            aria-label="Delete paper"
                          >
                            <Trash className="h-4 w-4" aria-hidden="true" />
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
              <label htmlFor={authorsInputId} className="block text-small font-medium text-text-secondary">
                Authors
              </label>
              {isEditing ? (
                <input
                  id={authorsInputId}
                  type="text"
                  value={editedAuthors}
                  onChange={(e) => setEditedAuthors(e.target.value)}
                  maxLength={1000}
                  className="w-full rounded-lg border border-border-moderate bg-bg-surface px-4 py-2 text-body text-text-primary shadow-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                  placeholder="Author 1, Author 2, et al."
                />
              ) : (
                <p className="text-body text-text-secondary">
                  {paper.authors.join(", ")}
                </p>
              )}
            </div>

            {/* Status Selector */}
            <div className="space-y-2">
              <label htmlFor={statusInputId} className="block text-small font-medium text-text-secondary">
                Reading Status
              </label>
              {isEditing ? (
                <select
                  id={statusInputId}
                  value={editedStatus}
                  onChange={(e) =>
                    setEditedStatus(e.target.value as ReadingStatus)
                  }
                  className={`rounded-lg border px-4 py-2 text-sm font-medium ${getStatusColor(editedStatus)} focus:outline-none focus:ring-2 focus:ring-accent/30`}
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
                        className={`status-chip px-4 py-2 text-sm transition-all ${getStatusColor(paper.status)} hover:ring-2 hover:ring-accent/30`}
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
                    className="inline-flex h-9 items-center rounded-lg px-3 py-2 text-sm font-semibold text-accent-strong transition-colors hover:bg-accent-soft"
                  >
                    Next →
                  </button>
                </div>
              )}
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between text-caption font-semibold text-text-tertiary uppercase tracking-wider">
                  <span>{statusCopy[statusForProgress].title}</span>
                  <span>{progressPercent}% complete</span>
                </div>
                <div className="progress-track h-2 w-full">
                  <div className="progress-fill" style={{ width: `${progressPercent}%` }} aria-hidden />
                </div>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {statusCopy[statusForProgress].helper}
                </p>
                <div className="flex items-start gap-3 rounded-lg border border-border-subtle bg-bg-elevated p-3.5">
                  <span className="icon-tile h-8 w-8 shrink-0 bg-accent-soft text-accent-strong">
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                  </span>
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
              <h2 className="mb-3 font-serif text-lg font-semibold text-text-primary">
                Abstract
              </h2>
              {isEditing ? (
                <textarea
                  value={editedAbstract}
                  onChange={(e) => setEditedAbstract(e.target.value)}
                  rows={8}
                  maxLength={10000}
                  className="w-full resize-none rounded-lg border border-border-moderate bg-bg-surface px-4 py-3 text-body text-text-primary shadow-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                  placeholder="Enter or paste the paper's abstract..."
                />
              ) : (
                <div className="prose prose-sm max-w-none dark:prose-invert prose-a:text-accent prose-strong:text-text-primary">
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
                  <div className="flex items-center gap-2 text-caption font-semibold text-text-tertiary uppercase tracking-wider">
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      Publication Date
                    </span>
                  </div>
                  <p className="text-small font-medium text-text-primary">{paper.publication_date}</p>
                </div>
              )}

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-caption font-semibold text-text-tertiary uppercase tracking-wider">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm font-medium">Added to Library</span>
                </div>
                <p className="text-small font-medium text-text-primary">
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
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-text-primary px-4 text-sm font-semibold text-bg-base shadow-lift transition-transform hover:-translate-y-0.5 hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
                  >
                    <LinkIcon className="h-4 w-4" aria-hidden="true" />
                    View DOI
                  </a>
                )}
                {paper.source_url && isValidUrl(paper.source_url) && (
                  <a
                    href={paper.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border-moderate bg-bg-surface px-4 text-sm font-semibold text-text-primary shadow-sm transition-all hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lift"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    View Source
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tips Card */}
        <div className="surface-card mt-6 flex items-start gap-4 p-5">
          <span className="icon-tile shrink-0 bg-gold-soft text-gold-strong">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="text-small font-semibold text-text-primary">
              💡 Pro Tip
            </h3>
            <p className="mt-1 text-small text-text-secondary leading-relaxed">
              Update the reading status as you progress through the paper. This
              helps track your research progress and earns you XP!
            </p>
          </div>
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

      {showAdversarial && (
        <AdversarialReviewPanel
          open={showAdversarial}
          onOpenChange={setShowAdversarial}
          target={{
            type: "paper",
            title: paper.title,
            abstract: paper.abstract,
            authors: paper.authors,
            status: paper.status,
            sourceUrl: paper.source_url,
            publicationDate: paper.publication_date,
          }}
        />
      )}
    </>
  );
}

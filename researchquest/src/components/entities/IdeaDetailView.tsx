import { useState, useEffect, useRef } from "react";
import {
  Lightbulb,
  Calendar,
  TrendingUp,
  Edit2,
  Save,
  X,
  Trash,
  FileText,
  Search,
  Loader,
  Download,
  Table,
  FileJson,
  ShieldAlert,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { Idea, IdeaStage } from "../../types/database";
import { toast } from "sonner";
import { TopicSelector } from "../topics/TopicSelector";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { AdversarialReviewPanel } from "../analysis/AdversarialReviewPanel";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { useNotes } from "../../hooks/useNotes";
import { useAppStore } from "../../store/appStore";
import { performDeepResearch, type DeepResearchData } from "../../utils/deepResearch";
import { logger } from "../../utils/logger";
import {
  convertIdeasToMarkdown,
  convertIdeasToCSV,
  convertIdeasToJSON,
  downloadFile,
} from "../../utils/export";

interface IdeaDetailViewProps {
  idea: Idea;
  onUpdate: (
    ideaId: string,
    updates: Partial<Idea>,
    oldStage?: IdeaStage,
  ) => Promise<boolean>;
  onDelete?: (ideaId: string) => Promise<boolean>;
}

export function IdeaDetailView({
  idea,
  onUpdate,
  onDelete,
}: IdeaDetailViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(idea.title);
  const [editedDescription, setEditedDescription] = useState(
    idea.description || "",
  );
  const [editedStage, setEditedStage] = useState(idea.stage);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isMounted = useRef(true);

  // Deep research state
  const [isDeepResearching, setIsDeepResearching] = useState(false);
  const [showAdversarial, setShowAdversarial] = useState(false);

  const userId = useAppStore((state) => state.user?.id);
  const { createNote } = useNotes(userId);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    setEditedTitle(idea.title);
    setEditedDescription(idea.description || "");
    setEditedStage(idea.stage);
    setIsEditing(false);
    setSaveError("");
  }, [idea.id, idea.title, idea.description, idea.stage]);

  const handleSave = async () => {
    const nextTitle = editedTitle.trim();
    const nextDescription = editedDescription.trim();

    if (!nextTitle) {
      setSaveError("Title is required to save changes.");
      return;
    }

    const updates: Partial<Idea> = {};
    if (nextTitle !== idea.title) {
      updates.title = nextTitle;
    }

    const currentDescription = (idea.description || "").trim();
    if (nextDescription !== currentDescription) {
      updates.description = nextDescription;
    }

    if (editedStage !== idea.stage) {
      updates.stage = editedStage;
    }

    if (Object.keys(updates).length === 0) {
      setSaveError("No changes to save yet.");
      return;
    }

    setSaving(true);
    setSaveError("");
    const success = await onUpdate(idea.id, updates, idea.stage);
    setSaving(false);

    if (success) {
      const stageChanged = updates.stage && updates.stage !== idea.stage;
      const hasContentUpdates = Object.keys(updates).some(
        (key) => key !== "stage",
      );
      setIsEditing(false);
      if (hasContentUpdates || !stageChanged) {
        toast.success("Idea updated successfully");
      }
    } else {
      setSaveError("Unable to save changes. Please try again.");
    }
  };

  const handleCancel = () => {
    setEditedTitle(idea.title);
    setEditedDescription(idea.description || "");
    setEditedStage(idea.stage);
    setIsEditing(false);
    setSaveError("");
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    await onDelete(idea.id);

    if (isMounted.current) {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleCreateNote = async () => {
    const newNote = await createNote({
      title: `Notes on Idea: ${idea.title}`,
      markdown_body: `# ${idea.title}\n\n**Stage:** ${idea.stage}\n\n${idea.description || ""}\n\n## Brainstorming\n`,
      linked_entity_ids: [idea.id],
    });

    if (newNote) {
      useAppStore.getState().setSelectedNote(newNote);
      useAppStore.getState().setSelectedIdea(null);
      useAppStore.getState().setCurrentView("notes");
      window.history.pushState(null, "", `/notes/${newNote.id}`);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  };

  const handleDeepResearch = async () => {
    setIsDeepResearching(true);
    try {
      const result: DeepResearchData = await performDeepResearch(idea.title);

      const papersSection = result.papers && result.papers.length > 0
        ? `\n\n**Top Papers Found:**\n` +
          result.papers
            .map((p) => {
              const authors = p.authors.slice(0, 2).join(", ");
              const meta = [p.year, p.citationCount != null ? `${p.citationCount} citations` : null]
                .filter(Boolean)
                .join(" · ");
              return `- "${p.title}"${authors ? ` — ${authors}` : ""}${meta ? ` (${meta})` : ""}`;
            })
            .join("\n")
        : "";

      const researchText =
        `\n\n### Deep Research Insights\n${result.summary}\n\n**Suggested Keywords:** ${result.suggestedKeywords?.join(", ")}\n\n**Reasoning Steps:**\n${result.reasoningSteps?.map((step, i) => `${i + 1}. ${step}`).join("\n")}` +
        papersSection;

      const newDescription = (idea.description || "") + researchText;
      const success = await onUpdate(idea.id, { description: newDescription }, idea.stage);

      if (success) {
        toast.success("Deep research insights added to description");
      } else {
        toast.error("Failed to save research insights");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Deep research failed";
      logger.error("Deep research failed", err);
      toast.error(message);
    } finally {
      setIsDeepResearching(false);
    }
  };

  const handleExport = (format: "markdown" | "csv" | "json") => {
    try {
      let content = "";
      let filename = "";
      const timestamp = new Date().toISOString().split("T")[0];

      switch (format) {
        case "markdown":
          content = convertIdeasToMarkdown([idea]);
          filename = `idea-${idea.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${timestamp}.md`;
          break;
        case "csv":
          content = convertIdeasToCSV([idea]);
          filename = `idea-${idea.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${timestamp}.csv`;
          break;
        case "json":
          content = convertIdeasToJSON([idea]);
          filename = `idea-${idea.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${timestamp}.json`;
          break;
      }

      downloadFile(content, filename, format);
      toast.success(`Exported idea as ${format.toUpperCase()}`);
    } catch (err: any) {
      logger.error("Export failed", err);
      toast.error(err.message || "Failed to export idea");
    }
  };

  const getStageColor = (stage: IdeaStage) => {
    switch (stage) {
      case "Seed":
        return "bg-bg-elevated text-text-secondary border border-border-subtle";
      case "Developing":
        return "bg-gold-soft text-gold-strong border border-gold/20";
      case "Supported":
        return "bg-blue-soft text-blue-strong border border-blue/20";
      case "Mature":
        return "bg-violet-soft text-violet-strong border border-violet/20";
    }
  };

  const getStageDescription = (stage: IdeaStage) => {
    switch (stage) {
      case "Seed":
        return "Initial concept or thought - needs exploration and development";
      case "Developing":
        return "Actively being explored and refined with research backing";
      case "Supported":
        return "Well-researched with evidence supporting the concept";
      case "Mature":
        return "Fully developed idea ready for implementation or publication";
    }
  };

  return (
    <>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="surface-panel overflow-hidden">
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-border-subtle">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 flex-1">
                <div className="icon-tile h-11 w-11 rounded-xl bg-gold-soft text-gold-strong">
                  <Lightbulb className="h-5 w-5" aria-hidden="true" />
                </div>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="flex-1 min-w-0 h-12 rounded-lg border border-border-moderate bg-bg-base px-4 text-2xl font-bold text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="Idea title..."
                    aria-label="Idea title"
                  />
                ) : (
                  <h1 className="min-w-0 truncate font-serif text-2xl font-bold text-text-primary">
                    {idea.title}
                  </h1>
                )}
              </div>

              <div className="flex items-center gap-2 md:self-start">
                {isEditing ? (
                  <>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={handleSave}
                          disabled={saving}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent-strong text-accent-contrast shadow-lift transition-all hover:-translate-y-0.5 hover:opacity-95 disabled:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed"
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
                          className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-bg-elevated text-text-secondary transition-colors hover:bg-bg-base"
                          aria-label="Cancel"
                        >
                          <X className="w-5 h-5" aria-hidden="true" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Cancel</TooltipContent>
                    </Tooltip>
                  </>
                ) : (
                  <div className="flex items-center gap-2 md:self-start">
                    <DropdownMenu.Root>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenu.Trigger asChild>
                            <button
                              className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-bg-elevated text-text-secondary transition-colors hover:bg-bg-base"
                              aria-label="Export idea"
                            >
                              <Download className="w-5 h-5" aria-hidden="true" />
                            </button>
                          </DropdownMenu.Trigger>
                        </TooltipTrigger>
                        <TooltipContent>Export idea</TooltipContent>
                      </Tooltip>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content
                          className="min-w-[160px] bg-bg-surface border border-border-moderate rounded-lg shadow-lg p-1 z-50 animate-in fade-in zoom-in-95"
                          align="end"
                        >
                          <DropdownMenu.Item
                            className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-small text-text-primary hover:bg-bg-elevated cursor-pointer outline-none"
                            onSelect={() => handleExport("markdown")}
                          >
                            <FileText className="w-4 h-4 text-text-secondary" />
                            Markdown
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-small text-text-primary hover:bg-bg-elevated cursor-pointer outline-none"
                            onSelect={() => handleExport("csv")}
                          >
                            <Table className="w-4 h-4 text-text-secondary" />
                            CSV
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-small text-text-primary hover:bg-bg-elevated cursor-pointer outline-none"
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
                          onClick={handleDeepResearch}
                          disabled={isDeepResearching}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-soft text-blue-strong shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lift disabled:translate-y-0 disabled:opacity-50"
                          aria-label="Deep Research AI Reasoning"
                        >
                          {isDeepResearching ? <Loader className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" aria-hidden="true" />}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Deep Research AI Reasoning</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setShowAdversarial(true)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-coral-soft text-coral-strong shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lift"
                          aria-label="Adversarial review idea"
                        >
                          <ShieldAlert className="w-5 h-5" aria-hidden="true" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Adversarial review</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setIsEditing(true)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-bg-elevated text-text-secondary transition-colors hover:bg-bg-base"
                          aria-label="Edit idea"
                        >
                          <Edit2 className="w-5 h-5" aria-hidden="true" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Edit idea</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={handleCreateNote}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-bg-elevated text-text-secondary transition-colors hover:bg-bg-base"
                          aria-label="Create linked note"
                        >
                          <FileText className="w-5 h-5" aria-hidden="true" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Create linked note</TooltipContent>
                    </Tooltip>
                    {onDelete && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={handleDeleteClick}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-coral-soft text-coral-strong shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lift"
                            aria-label="Delete idea"
                          >
                            <Trash className="w-5 h-5" aria-hidden="true" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Delete idea</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Stage Selector */}
            <div className="space-y-2">
              <label htmlFor={isEditing ? `idea-stage-select-${idea.id}` : undefined} className="block text-sm font-medium text-text-secondary">
                Development Stage
              </label>
              {isEditing ? (
                <select id={`idea-stage-select-${idea.id}`}
                  value={editedStage}
                  onChange={(e) => setEditedStage(e.target.value as IdeaStage)}
                  className={`h-9 rounded-full border px-4 text-caption font-semibold uppercase tracking-wider ${getStageColor(editedStage)} focus:outline-none focus:ring-2 focus:ring-accent`}
                >
                  <option value="Seed">🌱 Seed</option>
                  <option value="Developing">🌿 Developing</option>
                  <option value="Supported">🌳 Supported</option>
                  <option value="Mature">🏆 Mature</option>
                </select>
              ) : (
                <div>
                  <div
                    className={`status-chip ${getStageColor(idea.stage)}`}
                  >
                    {idea.stage === "Seed" && "🌱"}
                    {idea.stage === "Developing" && "🌿"}
                    {idea.stage === "Supported" && "🌳"}
                    {idea.stage === "Mature" && "🏆"}
                    <span className="ml-2">{idea.stage}</span>
                  </div>
                  <p className="text-sm text-text-tertiary mt-2">
                    {getStageDescription(idea.stage)}
                  </p>
                </div>
              )}
              {saveError && isEditing && (
                <p className="text-sm text-destructive">{saveError}</p>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="p-4 sm:p-6 border-b border-border-subtle">
            <h2 className="text-lg font-semibold text-text-primary mb-3">
              Description
            </h2>
            {isEditing ? (
              <textarea
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                rows={8}
                className="w-full rounded-lg border border-border-moderate bg-bg-base px-4 py-3 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                placeholder="Describe your idea in detail..."
                aria-label="Idea description"
              />
            ) : (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                {idea.description ? (
                  <p className="text-body text-text-secondary whitespace-pre-wrap">
                    {idea.description}
                  </p>
                ) : (
                  <p className="text-body text-text-tertiary italic">
                    No description yet. Click edit to add one.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="p-4 sm:p-6 border-b border-border-subtle">
            <TopicSelector entityId={idea.id} entityType="idea" />
          </div>

          {/* Metadata */}
          <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-text-tertiary">
                <Calendar className="w-4 h-4" />
                <span className="text-sm font-medium">Created</span>
              </div>
              <p className="text-text-primary">
                {new Date(idea.created_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-text-tertiary">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm font-medium">Last Updated</span>
              </div>
              <p className="text-text-primary">
                {new Date(idea.updated_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>

            {(idea.linked_note_ids?.length ||
              idea.linked_paper_ids?.length) && (
              <div className="col-span-full space-y-1">
                <div className="flex items-center gap-2 text-text-tertiary">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-sm font-medium">Connections</span>
                </div>
                <p className="text-text-secondary">
                  {idea.linked_note_ids?.length || 0} notes,{" "}
                  {idea.linked_paper_ids?.length || 0} papers
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Tips Card */}
        <div className="mt-6 rounded-lg border border-blue-soft bg-blue-soft p-4">
          <h3 className="text-sm font-semibold text-blue-strong mb-2">
            💡 Tip: Develop Your Idea
          </h3>
          <p className="text-sm text-text-secondary">
            Progress your idea through stages as you gather evidence and develop
            it further. Link related papers and notes to build a strong
            foundation for your research.
          </p>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => void handleConfirmDelete()}
        title="Delete idea"
        message={`Are you sure you want to delete "${idea.title}"? You can undo for a short time after deleting.`}
        confirmText="Delete"
        cancelText="Cancel"
        isLoading={deleting}
      />

      {showAdversarial && (
        <AdversarialReviewPanel
          open={showAdversarial}
          onOpenChange={setShowAdversarial}
          target={{
            type: "idea",
            title: idea.title,
            description: idea.description,
            stage: idea.stage,
            linkedNoteIds: idea.linked_note_ids ?? [],
            linkedPaperIds: idea.linked_paper_ids ?? [],
          }}
        />
      )}
    </>
  );
}

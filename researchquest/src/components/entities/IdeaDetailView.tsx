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
} from "lucide-react";
import type { Idea, IdeaStage } from "../../types/database";
import { toast } from "sonner";
import { TopicSelector } from "../topics/TopicSelector";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { useNotes } from "../../hooks/useNotes";
import { useAppStore } from "../../store/appStore";
import { performDeepResearch } from "../../utils/deepResearch";
import { logger } from "../../utils/logger";

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
      const result = await performDeepResearch(idea.title);
      
      const researchText = `\n\n### Deep Research Insights\n${result.summary}\n\n**Suggested Keywords:** ${result.suggestedKeywords?.join(', ')}\n\n**Reasoning Steps:**\n${result.reasoningSteps?.map((step: string, i: number) => `${i + 1}. ${step}`).join('\n')}`;
      
      const newDescription = (idea.description || "") + researchText;
      const success = await onUpdate(idea.id, { description: newDescription }, idea.stage);
      
      if (success) {
        toast.success("Deep research insights added to description");
      } else {
        toast.error("Failed to save research insights");
      }

    } catch (err: any) {
      logger.error("Deep research failed", err);
      toast.error(err.message || "Deep research failed");
    } finally {
      setIsDeepResearching(false);
    }
  };


  const getStageColor = (stage: IdeaStage) => {
    switch (stage) {
      case "Seed":
        return "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700";
      case "Developing":
        return "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700";
      case "Supported":
        return "bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-300 dark:border-purple-700";
      case "Mature":
        return "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700";
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
        <div className="bg-bg-surface rounded-lg border border-border-subtle shadow-sm">
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-border-subtle">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 flex-1">
                <div className="p-3 bg-bg-elevated rounded-lg">
                  <Lightbulb className="w-6 h-6 text-primary-500" />
                </div>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="flex-1 text-2xl font-bold text-text-primary bg-bg-base border border-border-subtle rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Idea title..."
                    aria-label="Idea title"
                  />
                ) : (
                  <h1 className="text-2xl font-bold text-text-primary">
                    {idea.title}
                  </h1>
                )}
              </div>

              <div className="flex items-center gap-2 md:self-start">
                {isEditing ? (
                  <>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="p-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      title="Save changes"
                      aria-label="Save changes"
                    >
                      <Save className="w-5 h-5" aria-hidden="true" />
                    </button>
                    <button
                      onClick={handleCancel}
                      className="p-2 bg-bg-elevated text-text-secondary rounded-md hover:bg-bg-base transition-colors"
                      title="Cancel"
                      aria-label="Cancel"
                    >
                      <X className="w-5 h-5" aria-hidden="true" />
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-2 md:self-start">
                    <button
                      onClick={handleDeepResearch}
                      disabled={isDeepResearching}
                      className="p-2 bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50"
                      title="Deep Research AI Reasoning"
                      aria-label="Deep Research AI Reasoning"
                    >
                      {isDeepResearching ? <Loader className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" aria-hidden="true" />}
                    </button>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="p-2 bg-bg-elevated text-text-secondary rounded-md hover:bg-bg-base transition-colors"
                      title="Edit idea"
                      aria-label="Edit idea"
                    >
                      <Edit2 className="w-5 h-5" aria-hidden="true" />
                    </button>
                    <button
                      onClick={handleCreateNote}
                      className="p-2 bg-bg-elevated text-text-secondary rounded-md hover:bg-bg-base transition-colors"
                      title="Create linked note"
                      aria-label="Create linked note"
                    >
                      <FileText className="w-5 h-5" aria-hidden="true" />
                    </button>
                    {onDelete && (
                      <button
                        onClick={handleDeleteClick}
                        className="p-2 bg-bg-elevated text-red-600 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Delete idea"
                        aria-label="Delete idea"
                      >
                        <Trash className="w-5 h-5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Stage Selector */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-text-secondary">
                Development Stage
              </label>
              {isEditing ? (
                <select
                  value={editedStage}
                  onChange={(e) => setEditedStage(e.target.value as IdeaStage)}
                  className={`px-4 py-2 rounded-md border text-sm font-medium ${getStageColor(editedStage)} focus:outline-none focus:ring-2 focus:ring-primary-500`}
                >
                  <option value="Seed">🌱 Seed</option>
                  <option value="Developing">🌿 Developing</option>
                  <option value="Supported">🌳 Supported</option>
                  <option value="Mature">🏆 Mature</option>
                </select>
              ) : (
                <div>
                  <div
                    className={`inline-flex items-center px-4 py-2 rounded-md border text-sm font-medium ${getStageColor(idea.stage)}`}
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
                className="w-full px-4 py-3 bg-bg-base border border-border-subtle rounded-md text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
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
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
            💡 Tip: Develop Your Idea
          </h3>
          <p className="text-sm text-blue-800 dark:text-blue-400">
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
    </>
  );
}

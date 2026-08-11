import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  Trash2,
  Lightbulb,
  ArrowRight,
  X,
  Search,
  Download,
  FileText,
  Table,
  FileJson,
  ArrowUpDown,
  ArrowLeft,
} from "lucide-react";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useAppStore } from "../../store/appStore";
import { useShallow } from "zustand/react/shallow";
import { highlightMatch } from "../../utils/highlight";
import { useIdeas } from "../../hooks/useIdeas";
import { IdeaDetailView } from "../entities/IdeaDetailView";
import type { IdeaStage, Idea } from "../../types/database";
import { cn } from "../../lib/utils";
import * as Dialog from "@radix-ui/react-dialog";
import { OnboardingGuide } from "../layout/OnboardingGuide";
import { InlineError } from "../ui/ErrorFallback";
import { toast } from "sonner";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { ListSkeleton } from "../ui/Skeleton";
import { getIdeaConfidence } from "../../utils/adversarialAnalysis";
import {
  convertIdeasToCSV,
  convertIdeasToJSON,
  convertIdeasToMarkdown,
  downloadFile,
} from "../../utils/export";
import { logger } from "../../utils/logger";
import { UNDO_WINDOW_MS } from "../../lib/constants";

type SortOption =
  | "updated_desc"
  | "updated_asc"
  | "created_desc"
  | "created_asc"
  | "title_asc"
  | "title_desc";

const STAGES: { id: IdeaStage; label: string; color: string; tint: string }[] = [
  { id: "Seed", label: "Seed", color: "bg-bg-elevated", tint: "from-bg-elevated" },
  { id: "Developing", label: "Developing", color: "bg-gold-soft", tint: "from-gold-soft" },
  { id: "Supported", label: "Supported", color: "bg-blue-soft", tint: "from-blue-soft" },
  { id: "Mature", label: "Mature", color: "bg-violet-soft", tint: "from-violet-soft" },
];

const STAGE_ICON_STYLES: Record<string, string> = {
  Seed: "bg-bg-elevated text-text-secondary",
  Developing: "bg-gold-soft text-gold-strong",
  Supported: "bg-blue-soft text-blue-strong",
  Mature: "bg-violet-soft text-violet-strong",
};

export function IdeasBoard() {
  // Using useShallow to prevent unnecessary re-renders of the entire IdeasBoard
  // when unrelated properties in the global appStore change.
  const {
    ideas,
    selectedIdea,
    setSelectedIdea,
    ideasLoading,
    userId,
    ideasSyncError,
  } = useAppStore(
    useShallow((state) => ({
      ideas: state.ideas,
      selectedIdea: state.selectedIdea,
      setSelectedIdea: state.setSelectedIdea,
      ideasLoading: state.ideasLoading,
      userId: state.user?.id,
      ideasSyncError: state.dataSyncErrors?.ideas ?? null,
    })),
  );
  const { createIdea, updateIdea, deleteIdea, restoreIdea } = useIdeas(userId);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newIdeaTitle, setNewIdeaTitle] = useState("");
  const [newIdeaDesc, setNewIdeaDesc] = useState("");
  const [ideaToDelete, setIdeaToDelete] = useState<Idea | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTitleFocused, setIsTitleFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("updated_desc");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDeletedRef = useRef<Idea | null>(null);

  // Performance: Pre-compute derived text fields for faster searching
  const searchableIdeas = useMemo(() => {
    return (ideas || []).map((idea) => ({
      idea,
      searchText: [idea.title || "", idea.description || ""]
        .join(" ")
        .toLowerCase(),
    }));
  }, [ideas]);

  const filteredIdeas = useMemo(() => {
    // Optimization: Skip filtering if query is empty and sort order matches default
    if (!searchQuery && sortOption === "updated_desc") {
      return ideas || [];
    }

    let result;
    if (searchQuery) {
      result = [];
      const normalizedQuery = searchQuery?.toLowerCase() || "";
      const safeSearchableIdeas = searchableIdeas || [];
      for (let i = 0; i < safeSearchableIdeas.length; i++) {
        const si = safeSearchableIdeas[i];
        if (si.searchText.includes(normalizedQuery)) {
          result.push(si.idea);
        }
      }
    } else {
      // Create a shallow copy if we need to sort but not filter
      result = [...(ideas || [])];
    }

    return result.sort((a, b) => {
      switch (sortOption) {
        case "updated_desc":
          return a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0;
        case "updated_asc":
          return a.updated_at > b.updated_at ? 1 : a.updated_at < b.updated_at ? -1 : 0;
        case "created_desc":
          return a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0;
        case "created_asc":
          return a.created_at > b.created_at ? 1 : a.created_at < b.created_at ? -1 : 0;
        case "title_asc":
          return (a.title || "") > (b.title || "") ? 1 : (a.title || "") < (b.title || "") ? -1 : 0;
        case "title_desc":
          return (a.title || "") < (b.title || "") ? 1 : (a.title || "") > (b.title || "") ? -1 : 0;
        default:
          return 0;
      }
    });
  }, [ideas, searchQuery, sortOption]);

  const stageBuckets = useMemo(() => {
    const buckets: Record<string, Idea[]> = {};
    for (let i = 0; i < STAGES.length; i++) {
      buckets[STAGES[i].id] = [];
    }
    for (let i = 0; i < filteredIdeas.length; i++) {
      const idea = filteredIdeas[i];
      if (!buckets[idea.stage]) {
        buckets[idea.stage] = [];
      }
      buckets[idea.stage].push(idea);
    }
    return buckets;
  }, [filteredIdeas]);

  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
    };
  }, []);

  const handleDeleteWithUndo = useCallback(
    async (ideaId: string) => {
      const idea = ideas.find((i) => i.id === ideaId);
      const success = await deleteIdea(ideaId);

      if (success && idea) {
        lastDeletedRef.current = idea;
        if (undoTimeoutRef.current) {
          clearTimeout(undoTimeoutRef.current);
        }

        const toastId = toast.success("Idea deleted", {
          description: "Undo within 6 seconds to restore it.",
          duration: UNDO_WINDOW_MS,
          action: {
            label: "Undo",
            onClick: async () => {
              if (lastDeletedRef.current) {
                await restoreIdea(lastDeletedRef.current);
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
        }, UNDO_WINDOW_MS);
      }
      return success;
    },
    [deleteIdea, restoreIdea, ideas],
  );

  const handleCreate = async () => {
    if (!newIdeaTitle.trim()) return;
    const idea = await createIdea({
      title: newIdeaTitle,
      description: newIdeaDesc,
      stage: "Seed",
    });
    if (idea) {
      setNewIdeaTitle("");
      setNewIdeaDesc("");
      setIsCreateDialogOpen(false);
    }
  };

  const handleMoveStage = async (
    e: React.MouseEvent,
    ideaId: string,
    currentStage: IdeaStage,
  ) => {
    e.stopPropagation();
    const currentIndex = STAGES.findIndex((s) => s.id === currentStage);
    const nextStage = STAGES[currentIndex + 1];
    if (nextStage) {
      const update = () => updateIdea(ideaId, { stage: nextStage.id });
      if (document.startViewTransition) {
        document.startViewTransition(update);
      } else {
        await update();
      }
    }
  };

  const confirmDelete = async () => {
    if (!ideaToDelete) return;
    setIsDeleting(true);
    try {
      await handleDeleteWithUndo(ideaToDelete.id);
    } finally {
      setIsDeleting(false);
      setIdeaToDelete(null);
    }
  };

  const handleExport = useCallback((format: "markdown" | "csv" | "json") => {
    if (filteredIdeas.length === 0) {
      toast.error("No ideas to export");
      return;
    }

    const timestamp = new Date().toISOString().split("T")[0];
    let content = "";
    let filename = "";
    let type = "";

    try {
      switch (format) {
        case "markdown":
          content = convertIdeasToMarkdown(filteredIdeas);
          filename = `research-ideas-${timestamp}.md`;
          type = "text/markdown";
          break;
        case "csv":
          content = convertIdeasToCSV(filteredIdeas);
          filename = `research-ideas-${timestamp}.csv`;
          type = "text/csv";
          break;
        case "json":
          content = convertIdeasToJSON(filteredIdeas);
          filename = `research-ideas-${timestamp}.json`;
          type = "application/json";
          break;
      }

      downloadFile(content, filename, type);
      toast.success(
        `Exported ${filteredIdeas.length} ideas as ${format.toUpperCase()}`
      );
    } catch (err) {
      logger.error("Export failed", err);
      toast.error("Failed to export ideas");
    }
  }, [filteredIdeas]);

  useEffect(() => {
    const handleExportShortcut = () => {
      handleExport("markdown");
    };

    document.addEventListener("export-current-view", handleExportShortcut);
    return () => {
      document.removeEventListener("export-current-view", handleExportShortcut);
    };
  }, [handleExport]);

  return (
    <div className="relative flex h-full bg-bg-base text-text-primary overflow-hidden">
      <div
        className={cn(
          "flex-1 flex flex-col min-w-0",
          selectedIdea && "max-lg:hidden",
        )}
      >
        <div className="p-4 sm:p-6 border-b border-border-subtle bg-bg-surface flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-serif font-bold text-text-primary">
              Idea Board
            </h1>
            <p className="text-text-secondary text-small mt-1">
              Track the evolution of your research concepts
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="inline-flex h-10 items-center gap-2 rounded-lg border border-border-moderate bg-bg-surface px-3.5 text-small font-medium text-text-secondary shadow-sm transition-all hover:-translate-y-0.5 hover:border-border-strong hover:bg-bg-elevated hover:text-text-primary hover:shadow-lift">
                  <Download className="w-5 h-5" />
                  Export
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="min-w-[180px] bg-bg-surface rounded-lg shadow-lg border border-border-moderate p-1 z-50 animate-in fade-in-0 zoom-in-95"
                  align="end"
                  sideOffset={5}
                >
                  <DropdownMenu.Item
                    onSelect={() => handleExport("markdown")}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-small text-text-secondary hover:bg-bg-elevated hover:text-text-primary cursor-pointer outline-none"
                  >
                    <FileText className="w-4 h-4" />
                    Markdown (.md)
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => handleExport("csv")}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-small text-text-secondary hover:bg-bg-elevated hover:text-text-primary cursor-pointer outline-none"
                  >
                    <Table className="w-4 h-4" />
                    CSV (.csv)
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => handleExport("json")}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-small text-text-secondary hover:bg-bg-elevated hover:text-text-primary cursor-pointer outline-none"
                  >
                    <FileJson className="w-4 h-4" />
                    JSON (.json)
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            <button
              onClick={() => setIsCreateDialogOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-text-primary px-4 text-small font-semibold text-bg-base shadow-lift transition-all hover:-translate-y-0.5 hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2"
            >
              <Plus className="w-5 h-5" />
              New Idea
            </button>
          </div>
        </div>

        <div className="p-4 bg-bg-surface border-b border-border-subtle flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 sm:max-w-md">
            <label htmlFor="ideas-search-input" className="sr-only">Search ideas</label>
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-text-tertiary" />
            <input
              id="ideas-search-input"
              ref={searchInputRef}
              type="text"
              placeholder="Search ideas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 rounded-lg border border-border-moderate bg-bg-elevated pl-9 pr-10 text-small text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent"
              aria-label="Search ideas"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  searchInputRef.current?.focus();
                }}
                className="icon-btn absolute right-1.5 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full"
                aria-label="Clear search"
              >
                <X className="w-3 h-3" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-text-tertiary flex-shrink-0" />
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="h-10 rounded-lg border border-border-moderate bg-bg-elevated px-3 text-small text-text-primary focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer min-w-[180px]"
              aria-label="Sort ideas"
            >
              <option value="updated_desc">Last Updated (Newest)</option>
              <option value="updated_asc">Last Updated (Oldest)</option>
              <option value="created_desc">Date Created (Newest)</option>
              <option value="created_asc">Date Created (Oldest)</option>
              <option value="title_asc">Title (A-Z)</option>
              <option value="title_desc">Title (Z-A)</option>
            </select>
          </div>
        </div>

        <div className="sr-only" role="status" aria-live="polite">
          {!ideasLoading && !ideasSyncError && filteredIdeas.length === 0 ? (searchQuery ? "No matches found. Try a different keyword or clear your search." : "No ideas yet") : ""}
        </div>

        <div className="flex-1 overflow-auto p-4 sm:p-6 flex flex-col">
          <div className="mb-4">
            <OnboardingGuide />
          </div>
          {ideasSyncError && (
            <InlineError message={ideasSyncError.message} className="mb-4" />
          )}
          <div className="grid grid-cols-1 gap-4 lg:flex lg:gap-6 lg:h-full lg:min-w-max">
            {STAGES.map((stage) => {
              const stageIdeas = stageBuckets[stage.id] || [];

              return (
                <div
                  key={stage.id}
                  className="w-full lg:w-80 flex flex-col min-h-[280px] lg:h-full rounded-xl bg-bg-elevated border border-border-subtle"
                >
                  <div className={`p-4 flex items-center justify-between border-b border-border-subtle bg-gradient-to-r ${stage.tint} via-bg-surface to-bg-surface rounded-t-xl sticky top-0 z-10`}>
                    <div className="flex items-center gap-2">
                      <div
                        className={cn("h-2.5 w-2.5 rounded-full shadow-sm ring-2 ring-white/60 dark:ring-white/10", stage.color)}
                      />
                      <h3 className="font-semibold text-text-primary">
                        {stage.label}
                      </h3>
                      <span className="rounded-full border border-border-subtle bg-bg-surface px-2 py-0.5 text-caption font-medium text-text-secondary shadow-sm">
                        {stageIdeas.length}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {ideasLoading ? (
                      <ListSkeleton count={3} itemType="idea" />
                    ) : (
                      <>
                          {stageIdeas.map((idea) => (
                            <div
                              key={idea.id}
                              className="surface-card group cursor-pointer rounded-lg p-4 transition-all hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-accent animate-fade-slide-in"
                              style={{ viewTransitionName: `idea-${idea.id}` }}
                              onClick={() => setSelectedIdea(idea)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  setSelectedIdea(idea);
                                }
                              }}
                              tabIndex={0}
                            >
                              <div className="flex items-start gap-3">
                                <span
                                  className={`icon-tile ${
                                    STAGE_ICON_STYLES[idea.stage] ?? STAGE_ICON_STYLES.Seed
                                  }`}
                                >
                                  <Lightbulb className="h-4 w-4" aria-hidden="true" />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-2">
                                    <h4 className="min-w-0 font-semibold text-small text-text-primary line-clamp-2 leading-snug">
                                      {idea.title ? highlightMatch(idea.title, searchQuery) : "Untitled"}
                                    </h4>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setIdeaToDelete(idea);
                                      }}
                                      aria-label={`Delete ${idea.title}`}
                                      className="icon-btn h-8 w-8 shrink-0 rounded-lg opacity-0 text-text-tertiary hover:text-warning hover:bg-warning-bg group-hover:opacity-100 group-focus-within:opacity-100"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>

                                  <p className="mt-1 text-caption text-text-secondary line-clamp-3">
                                    {idea.description
                                      ? highlightMatch(idea.description, searchQuery)
                                      : "No description provided..."}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border-subtle pt-2">
                                {(() => {
                                  const confidence = getIdeaConfidence(idea);
                                  const toneStyles = {
                                    success: "bg-success-bg text-success border border-success/20",
                                    gold: "bg-gold-soft text-gold-strong border border-gold/20",
                                    coral: "bg-coral-soft text-coral-strong border border-coral/20",
                                  }[confidence.tone];
                                  return (
                                    <span
                                      className={`status-chip ${toneStyles}`}
                                      title={`Confidence score: ${confidence.score}/100 (${confidence.label})`}
                                    >
                                      {confidence.score}
                                    </span>
                                  );
                                })()}
                                {stage.id !== "Mature" && (
                                  <button
                                    onClick={(e) =>
                                      handleMoveStage(e, idea.id, idea.stage)
                                    }
                                    aria-label="Advance idea to next stage"
                                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-caption font-medium text-text-secondary transition-colors hover:text-accent-strong opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                                  >
                                    Advance <ArrowRight className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}

                        <div className="sr-only" role="status" aria-live="polite">
                          {!ideasLoading && !ideasSyncError && stageIdeas.length === 0 ? (
                            searchQuery ? `No matches found in ${stage.label}. Try a different keyword or clear your search.` : `No ideas yet in ${stage.label}`
                          ) : (
                            ""
                          )}
                        </div>

                        {stageIdeas.length === 0 && (
                          <div className="p-8 text-center border-2 border-dashed border-border-moderate rounded-xl bg-bg-surface text-text-tertiary">
                            <span className="icon-tile mx-auto mb-2 bg-bg-elevated text-text-tertiary">
                              <Lightbulb className="h-5 w-5" aria-hidden="true" />
                            </span>
                            <p className="text-small font-medium mb-1 text-text-secondary">{searchQuery ? "No matches found" : "No ideas yet"}</p>
                            {searchQuery && (
                              <p className="text-caption text-text-secondary">
                                Try a different keyword or clear your search.
                              </p>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Idea Detail Drawer */}
      {selectedIdea && (
        <div className="absolute inset-0 w-full border-l-0 lg:border-l border-border-subtle bg-bg-surface flex flex-col h-full shadow-2xl z-20 lg:relative lg:inset-auto lg:w-[450px]">
          <div className="p-4 border-b border-border-subtle flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedIdea(null)}
                className="icon-btn lg:hidden -ml-2 rounded-full"
                aria-label="Back to board"
              >
                <ArrowLeft className="w-5 h-5 text-text-secondary" />
              </button>
              <h2 className="font-serif text-lg font-bold text-text-primary">
                Idea Details
              </h2>
            </div>
            <button
              onClick={() => setSelectedIdea(null)}
              aria-label="Close details"
              className="icon-btn hidden rounded-full lg:flex"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">
            <IdeaDetailView
              idea={selectedIdea}
              onUpdate={updateIdea}
              onDelete={handleDeleteWithUndo}
            />
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog.Root
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-md z-50 animate-fade-in" />
          <Dialog.Content
            className="surface-panel fixed left-[50%] top-[50%] max-h-[85vh] w-[90vw] max-w-[500px] translate-x-[-50%] translate-y-[-50%] rounded-xl p-6 shadow-lift focus:outline-none z-50 animate-slide-in"
            aria-describedby={undefined}
          >
            <Dialog.Title className="font-serif text-xl font-bold mb-4 text-text-primary">
              Capture New Idea
            </Dialog.Title>
            <form onSubmit={(e) => { e.preventDefault(); void handleCreate(); }} className="space-y-4">
              <div>
                <label
                  htmlFor="create-idea-title"
                  className="block text-sm font-medium text-text-secondary mb-1"
                >
                  Title
                </label>
                <input
                  id="create-idea-title"
                  autoFocus
                  className="w-full h-11 rounded-lg border border-border-moderate bg-bg-elevated px-4 text-body text-text-primary placeholder:text-text-tertiary focus:ring-2 focus:ring-accent outline-none"
                  placeholder="e.g. Quantum Entanglement in Biology"
                  value={newIdeaTitle}
                  onChange={(e) => setNewIdeaTitle(e.target.value)}
                  onFocus={() => setIsTitleFocused(true)}
                  onBlur={() => setIsTitleFocused(false)}
                  maxLength={255}
                />
                <div className="flex justify-end h-5 mt-1">
                  {isTitleFocused && (
                    <span className="text-xs text-text-tertiary animate-in fade-in duration-200">
                      {newIdeaTitle.length}/255
                    </span>
                  )}
                </div>
              </div>
              <div>
                <label
                  htmlFor="create-idea-description"
                  className="block text-sm font-medium text-text-secondary mb-1"
                >
                  Description
                </label>
                <textarea
                  id="create-idea-description"
                  className="w-full h-32 resize-none rounded-lg border border-border-moderate bg-bg-elevated px-4 py-2.5 text-body text-text-primary placeholder:text-text-tertiary focus:ring-2 focus:ring-accent outline-none"
                  placeholder="Briefly describe your hypothesis..."
                  value={newIdeaDesc}
                  onChange={(e) => setNewIdeaDesc(e.target.value)}
                  maxLength={5000}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateDialogOpen(false)}
                  className="h-10 rounded-lg px-4 text-small font-medium text-text-secondary transition-colors hover:bg-bg-elevated"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newIdeaTitle.trim()}
                  className="h-10 rounded-lg bg-text-primary px-6 text-small font-semibold text-bg-base shadow-lift transition-all hover:-translate-y-0.5 hover:opacity-95 disabled:translate-y-0 disabled:opacity-50"
                >
                  Create Idea
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <ConfirmDialog
        isOpen={Boolean(ideaToDelete)}
        onClose={() => {
          if (!isDeleting) {
            setIdeaToDelete(null);
          }
        }}
        onConfirm={() => {
          void confirmDelete();
        }}
        title="Delete idea"
        message={`Are you sure you want to delete "${ideaToDelete?.title || "Untitled Idea"}"? You can undo for a short time after deleting.`}
        confirmText="Delete"
        cancelText="Cancel"
        isLoading={isDeleting}
      />
    </div>
  );
}

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

const STAGES: { id: IdeaStage; label: string; color: string }[] = [
  { id: "Seed", label: "Seed", color: "bg-success" },
  { id: "Developing", label: "Developing", color: "bg-primary-500" },
  { id: "Supported", label: "Supported", color: "bg-purple" },
  { id: "Mature", label: "Mature", color: "bg-warning" },
];

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
            <p className="text-text-secondary text-sm">
              Track the evolution of your research concepts
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="px-4 py-2 bg-bg-surface border border-border-moderate text-text-secondary rounded-lg hover:bg-bg-elevated hover:text-text-primary transition-colors flex items-center gap-2 font-medium">
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
                    className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-bg-elevated hover:text-text-primary rounded-md cursor-pointer outline-none"
                  >
                    <FileText className="w-4 h-4" />
                    Markdown (.md)
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => handleExport("csv")}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-bg-elevated hover:text-text-primary rounded-md cursor-pointer outline-none"
                  >
                    <Table className="w-4 h-4" />
                    CSV (.csv)
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => handleExport("json")}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-bg-elevated hover:text-text-primary rounded-md cursor-pointer outline-none"
                  >
                    <FileJson className="w-4 h-4" />
                    JSON (.json)
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            <button
              onClick={() => setIsCreateDialogOpen(true)}
              className="px-4 py-2 bg-text-primary text-bg-base rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2"
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
              className="w-full pl-9 pr-10 py-2 bg-bg-elevated border border-border-moderate rounded-lg text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary-500"
              aria-label="Search ideas"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  searchInputRef.current?.focus();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-tertiary hover:text-text-primary hover:bg-bg-elevated rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
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
              className="px-3 py-2 bg-bg-elevated border border-border-moderate rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer min-w-[180px]"
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
                  <div className="p-4 flex items-center justify-between border-b border-border-subtle bg-bg-surface rounded-t-xl sticky top-0 z-10">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn("w-3 h-3 rounded-full", stage.color)}
                      />
                      <h3 className="font-semibold text-text-primary">
                        {stage.label}
                      </h3>
                      <span className="px-2 py-0.5 bg-bg-elevated text-text-secondary text-xs rounded-full font-medium">
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
                              className="group bg-bg-surface p-4 rounded-lg border border-border-moderate shadow-sm hover:shadow-md cursor-pointer transition-all hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-primary-500 animate-fade-slide-in"
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
                              <div className="flex items-start justify-between mb-2">
                                <h4 className="font-medium text-text-primary line-clamp-2 leading-snug">
                                  {idea.title ? highlightMatch(idea.title, searchQuery) : "Untitled"}
                                </h4>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIdeaToDelete(idea);
                                  }}
                                  aria-label={`Delete ${idea.title}`}
                                  className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 p-1 text-text-tertiary hover:text-warning hover:bg-warning-bg transition-all rounded"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>

                              <p className="text-sm text-text-secondary line-clamp-3 mb-3">
                                {idea.description
                                  ? highlightMatch(idea.description, searchQuery)
                                  : "No description provided..."}
                              </p>

                              {stage.id !== "Mature" && (
                                <div className="flex justify-end pt-2 border-t border-border-subtle">
                                  <button
                                    onClick={(e) =>
                                      handleMoveStage(e, idea.id, idea.stage)
                                    }
                                    aria-label="Advance idea to next stage"
                                    className="text-xs font-medium text-text-primary hover:underline flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
                                  >
                                    Advance <ArrowRight className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}

                        <div className="sr-only" role="status" aria-live="polite">
                          {stageIdeas.length === 0 ? (
                            searchQuery ? `No matches found in ${stage.label}. Try a different keyword or clear your search.` : `No ideas yet in ${stage.label}`
                          ) : (
                            ""
                          )}
                        </div>

                        {stageIdeas.length === 0 && (
                          <div className="p-8 text-center border-2 border-dashed border-border-moderate rounded-lg text-text-tertiary">
                            <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-50" aria-hidden="true" />
                            <p className="text-sm font-medium mb-1">{searchQuery ? "No matches found" : "No ideas yet"}</p>
                            {searchQuery && (
                              <p className="text-xs text-text-secondary">
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
                className="lg:hidden p-2 -ml-2 hover:bg-bg-elevated rounded-full transition-colors"
                aria-label="Back to board"
              >
                <ArrowLeft className="w-5 h-5 text-text-secondary" />
              </button>
              <h2 className="font-semibold text-text-primary">
                Idea Details
              </h2>
            </div>
            <button
              onClick={() => setSelectedIdea(null)}
              aria-label="Close details"
              className="hidden lg:flex p-2 hover:bg-bg-elevated rounded-full"
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
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-fade-in" />
          <Dialog.Content
            className="fixed left-[50%] top-[50%] max-h-[85vh] w-[90vw] max-w-[500px] translate-x-[-50%] translate-y-[-50%] rounded-xl bg-bg-surface p-6 shadow-2xl focus:outline-none z-50 animate-slide-in border border-border-moderate"
            aria-describedby={undefined}
          >
            <Dialog.Title className="text-xl font-serif font-bold mb-4 text-text-primary">
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
                  className="w-full px-4 py-2 bg-bg-elevated border border-border-moderate rounded-lg text-text-primary placeholder:text-text-tertiary focus:ring-2 focus:ring-primary-500 outline-none"
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
                  className="w-full px-4 py-2 bg-bg-elevated border border-border-moderate rounded-lg text-text-primary placeholder:text-text-tertiary focus:ring-2 focus:ring-primary-500 outline-none h-32 resize-none"
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
                  className="px-4 py-2 text-text-secondary hover:bg-bg-elevated rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newIdeaTitle.trim()}
                  className="px-6 py-2 bg-text-primary text-bg-base rounded-lg hover:opacity-90 transition-opacity font-medium disabled:opacity-50"
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

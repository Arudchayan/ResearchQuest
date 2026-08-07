import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { KeyboardEvent } from "react";
import {
  Plus,
  Trash2,
  Lightbulb,
  X,
  Search,
  Download,
  FileText,
  Table,
  FileJson,
  ArrowUpDown,
  ArrowLeft,
  ArrowRight,
  ListTodo,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useAppStore } from "../../store/appStore";
import { useShallow } from "zustand/react/shallow";
import { highlightMatch } from "../../utils/highlight";
import { useIdeas } from "../../hooks/useIdeas";
import { useTasks } from "../../hooks/useTasks";
import { IdeaDetailView } from "../entities/IdeaDetailView";
import type { IdeaStage, Idea } from "../../types/database";
import { cn } from "../../lib/utils";
import * as Dialog from "@radix-ui/react-dialog";
import { OnboardingGuide } from "../layout/OnboardingGuide";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { EmptyState } from "../ui/EmptyState";
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
import { IDEA_STAGES } from "./ideaStages";

type SortOption =
  | "updated_desc"
  | "updated_asc"
  | "created_desc"
  | "created_asc"
  | "title_asc"
  | "title_desc";

const MotionCard = motion.create(Card);

const STAGE_EDGE_CLASS: Record<IdeaStage, string> = {
  Seed: "border-t-2 border-t-stage-seed",
  Developing: "border-t-2 border-t-stage-developing",
  Supported: "border-t-2 border-t-stage-supported",
  Mature: "border-t-2 border-t-stage-mature",
};

const STAGE_FILL_CLASS: Record<IdeaStage, string> = {
  Seed: "bg-stage-seed",
  Developing: "bg-stage-developing",
  Supported: "bg-stage-supported",
  Mature: "bg-stage-mature",
};

export function IdeasBoard() {
  // ⚡ PERFORMANCE OPTIMIZATION:
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
  const { createTask } = useTasks(userId, { owner: false });
  const reduceMotion = useReducedMotion() === true;
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [updatingIdeaId, setUpdatingIdeaId] = useState<string | null>(null);
  const [promotingIdeaId, setPromotingIdeaId] = useState<string | null>(null);
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

  // ⚡ PERFORMANCE OPTIMIZATION: Pre-compute derived text fields for faster searching
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
      for (const si of safeSearchableIdeas) {
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
  }, [ideas, searchQuery, sortOption, searchableIdeas]);

  const stageBuckets = useMemo(() => {
    const buckets: Record<IdeaStage, Idea[]> = {
      Seed: [],
      Developing: [],
      Supported: [],
      Mature: [],
    };
    for (const stage of IDEA_STAGES) {
      buckets[stage.id] = [];
    }
    for (const idea of filteredIdeas) {
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
    if (!newIdeaTitle.trim() || isCreating) return;
    setIsCreating(true);
    try {
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
    } finally {
      setIsCreating(false);
    }
  };

  const updateIdeaStage = async (idea: Idea, nextStage: IdeaStage) => {
    if (nextStage === idea.stage || updatingIdeaId) return;

    setUpdatingIdeaId(idea.id);
    try {
      await updateIdea(idea.id, { stage: nextStage }, idea.stage);
    } finally {
      setUpdatingIdeaId(null);
    }
  };

  const handleStageChange = async (
    event: React.ChangeEvent<HTMLSelectElement>,
    idea: Idea,
  ) => {
    event.stopPropagation();
    const nextStage = IDEA_STAGES.find(({ id }) => id === event.target.value)?.id;
    if (nextStage) await updateIdeaStage(idea, nextStage);
  };

  const handleAdvanceStage = async (event: React.MouseEvent, idea: Idea) => {
    event.stopPropagation();
    const currentIndex = IDEA_STAGES.findIndex(({ id }) => id === idea.stage);
    const nextStage = IDEA_STAGES[currentIndex + 1]?.id;
    if (nextStage) await updateIdeaStage(idea, nextStage);
  };

  const handlePromoteToTask = async (event: React.MouseEvent, idea: Idea) => {
    event.stopPropagation();
    if (promotingIdeaId) return;

    setPromotingIdeaId(idea.id);
    try {
      const task = await createTask({
        title: idea.title,
        ...(idea.description ? { description: idea.description.slice(0, 1000) } : {}),
        priority: "medium",
        category: "Research",
        completed: false,
      });

      if (!task) {
        toast.error("Failed to create task");
        return;
      }

      if (idea.stage !== "Mature") {
        const currentIndex = IDEA_STAGES.findIndex(
          ({ id }) => id === idea.stage,
        );
        const nextStage = IDEA_STAGES[currentIndex + 1]?.id;
        if (nextStage) {
          await updateIdea(idea.id, { stage: nextStage }, idea.stage);
        }
      }
    } finally {
      setPromotingIdeaId(null);
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

  const handleExport = (format: "markdown" | "csv" | "json") => {
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
  };

  return (
    <div className="relative flex h-full overflow-hidden bg-bg-base">
      <div
        className={cn(
          "flex-1 flex flex-col min-w-0",
          selectedIdea && "max-lg:hidden",
        )}
      >
        <div className="flex flex-col gap-4 border-b border-border-subtle bg-bg-surface p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="min-w-0">
            <h1 className="font-serif text-subtitle font-bold text-text-primary">
              Idea Board
            </h1>
            <p className="text-small text-text-secondary">
              Track the evolution of your research concepts
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button type="button" variant="outline">
                  <Download aria-hidden="true" />
                  Export
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="z-dropdown min-w-44 rounded-surface border border-border-subtle bg-bg-surface p-1 shadow-md animate-in fade-in-0 zoom-in-95"
                  align="end"
                  sideOffset={5}
                >
                  <DropdownMenu.Item
                    onSelect={() => handleExport("markdown")}
                    className="flex cursor-pointer items-center gap-2 rounded-control px-3 py-2 text-small text-text-secondary outline-none transition-colors hover:bg-bg-elevated hover:text-text-primary focus:bg-bg-elevated"
                  >
                    <FileText aria-hidden="true" className="h-4 w-4" />
                    Markdown (.md)
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => handleExport("csv")}
                    className="flex cursor-pointer items-center gap-2 rounded-control px-3 py-2 text-small text-text-secondary outline-none transition-colors hover:bg-bg-elevated hover:text-text-primary focus:bg-bg-elevated"
                  >
                    <Table aria-hidden="true" className="h-4 w-4" />
                    CSV (.csv)
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => handleExport("json")}
                    className="flex cursor-pointer items-center gap-2 rounded-control px-3 py-2 text-small text-text-secondary outline-none transition-colors hover:bg-bg-elevated hover:text-text-primary focus:bg-bg-elevated"
                  >
                    <FileJson aria-hidden="true" className="h-4 w-4" />
                    JSON (.json)
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            <Button
              type="button"
              onClick={() => setIsCreateDialogOpen(true)}
              aria-label="Create a new idea"
            >
              <Plus aria-hidden="true" />
              New Idea
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-b border-border-subtle bg-bg-surface p-4 sm:flex-row">
          <div className="relative flex-1 sm:max-w-md">
            <label htmlFor="ideas-search-input" className="sr-only">Search ideas</label>
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <input
              id="ideas-search-input"
              ref={searchInputRef}
              type="text"
              placeholder="Search ideas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-control border border-border-subtle bg-bg-base py-2 pl-10 pr-12 text-small text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-focus"
              aria-label="Search ideas"
            />
            {searchQuery && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  setSearchQuery("");
                  searchInputRef.current?.focus();
                }}
                className="absolute right-1 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
                aria-label="Clear search"
              >
                <X aria-hidden="true" />
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 flex-shrink-0 text-text-tertiary" />
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="min-w-44 cursor-pointer rounded-control border border-border-subtle bg-bg-base px-3 py-2 text-small text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
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

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-6">
          <div className="mb-4">
            <OnboardingGuide />
          </div>
          {ideasSyncError && (
            <InlineError message={ideasSyncError.message} className="mb-4" />
          )}
          <div className="flex min-h-0 min-w-0 flex-1 gap-4 overflow-x-auto pb-2 sm:gap-6">
            {IDEA_STAGES.map((stage) => {
              const stageIdeas = stageBuckets[stage.id];
              const share =
                filteredIdeas.length > 0
                  ? stageIdeas.length / filteredIdeas.length
                  : 0;

              return (
                <div
                  key={stage.id}
                  className={cn(
                    "flex min-h-64 w-80 shrink-0 flex-col overflow-hidden rounded-surface border border-border-subtle bg-bg-elevated lg:h-full",
                    STAGE_EDGE_CLASS[stage.id],
                  )}
                >
                  <div className="sticky top-0 z-10 flex flex-col gap-3 rounded-t-surface border-b border-border-subtle bg-bg-surface p-4">
                    <h2 className="flex items-center gap-2">
                      <Badge variant={stage.badgeVariant}>{stage.label}</Badge>
                      <Badge variant="neutral" aria-label={`${stageIdeas.length} ideas`}>
                        <span className="font-mono">{stageIdeas.length}</span>
                      </Badge>
                    </h2>
                    <div
                      aria-hidden="true"
                      className="h-0.5 w-full overflow-hidden rounded-full bg-border-subtle"
                    >
                      <div
                        className={cn(
                          "h-full w-full origin-left transition-transform duration-fast",
                          STAGE_FILL_CLASS[stage.id],
                        )}
                        style={
                          reduceMotion
                            ? { width: `${share * 100}%` }
                            : { transform: `scaleX(${share})` }
                        }
                      />
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
                    {ideasLoading ? (
                      <ListSkeleton count={3} itemType="idea" />
                    ) : (
                      <>
                        <AnimatePresence mode={reduceMotion ? "sync" : "popLayout"}>
                          {stageIdeas.map((idea) => (
                            <MotionCard
                              {...(reduceMotion ? {} : { layoutId: idea.id })}
                              key={idea.id}
                              initial={reduceMotion ? false : { opacity: 0, y: 20 }}
                              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                              {...(reduceMotion ? {} : { exit: { opacity: 0, scale: 0.9 } })}
                              onClick={() => setSelectedIdea(idea)}
                              onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
                                if (event.target !== event.currentTarget) return;
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  setSelectedIdea(idea);
                                }
                              }}
                              tabIndex={0}
                              className="group cursor-pointer p-4 transition duration-fast hover:border-border-strong hover:shadow-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
                            >
                              <div className="mb-2 flex items-start justify-between gap-2">
                                <h3 className="min-w-0 line-clamp-2 font-medium leading-snug text-text-primary">
                                  {idea.title ? highlightMatch(idea.title, searchQuery) : "Untitled"}
                                </h3>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIdeaToDelete(idea);
                                  }}
                                  onKeyDown={(event) => event.stopPropagation()}
                                  aria-label={`Delete ${idea.title}`}
                                  className="shrink-0 text-text-tertiary hover:bg-destructive-bg hover:text-destructive md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                                >
                                  <Trash2 aria-hidden="true" />
                                </Button>
                              </div>

                              <p className="mb-3 line-clamp-3 text-small text-text-secondary">
                                {idea.description
                                  ? highlightMatch(idea.description, searchQuery)
                                  : "No description provided..."}
                              </p>

                              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-2">
                                <label htmlFor={`idea-stage-${idea.id}`} className="text-caption text-text-tertiary">
                                  Stage
                                </label>
                                <select
                                  id={`idea-stage-${idea.id}`}
                                  value={idea.stage}
                                  onChange={(event) => void handleStageChange(event, idea)}
                                  onClick={(event) => event.stopPropagation()}
                                  onKeyDown={(event) => event.stopPropagation()}
                                  disabled={updatingIdeaId === idea.id}
                                  aria-label={`Change stage for ${idea.title || "untitled idea"}`}
                                  className={cn("min-h-11 min-w-0 flex-1 cursor-pointer rounded-control border px-2 py-1 text-small font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-focus disabled:cursor-not-allowed disabled:opacity-60 md:min-h-0 md:flex-none", stage.selectClassName)}
                                >
                                  {IDEA_STAGES.map((stageOption) => (
                                    <option key={stageOption.id} value={stageOption.id}>
                                      {stageOption.label}
                                    </option>
                                  ))}
                                </select>
                                {stage.id !== "Mature" && (
                                  <Button
                                    type="button"
                                    variant="link"
                                    size="sm"
                                    onClick={(event) => void handleAdvanceStage(event, idea)}
                                    disabled={updatingIdeaId === idea.id}
                                    aria-label="Advance idea to next stage"
                                    className="shrink-0 px-2 text-caption font-semibold"
                                  >
                                    Advance <ArrowRight aria-hidden="true" className="h-3 w-3" />
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={(event) => void handlePromoteToTask(event, idea)}
                                  disabled={promotingIdeaId === idea.id}
                                  className="shrink-0"
                                >
                                  <ListTodo aria-hidden="true" className="h-3 w-3" />
                                  Promote to task
                                </Button>
                              </div>
                            </MotionCard>
                          ))}
                        </AnimatePresence>

                        {stageIdeas.length === 0 && (
                          <EmptyState
                            icon={<Lightbulb aria-hidden="true" className="h-6 w-6" />}
                            title={searchQuery ? "No matches found" : "No ideas yet"}
                            description={searchQuery ? "Try a broader search." : stage.description}
                            className="min-h-64 rounded-surface border-2 border-dashed border-border-subtle p-8"
                          />
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
          <aside
            aria-label="Idea details"
            className="absolute inset-0 z-20 flex h-full w-full flex-col border-l-0 border-border-subtle bg-bg-surface shadow-lg lg:relative lg:inset-auto lg:w-[450px] lg:border-l"
          >
           <div className="flex items-center justify-between border-b border-border-subtle p-4">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setSelectedIdea(null)}
                className="-ml-2 lg:hidden"
                aria-label="Back to board"
              >
                <ArrowLeft aria-hidden="true" />
              </Button>
               <h2 className="font-semibold text-text-primary">
                Idea Details
               </h2>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setSelectedIdea(null)}
              aria-label="Close details"
              className="hidden lg:inline-flex"
            >
              <X aria-hidden="true" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">
            <IdeaDetailView
              idea={selectedIdea}
              onUpdate={updateIdea}
              onDelete={handleDeleteWithUndo}
            />
          </div>
          </aside>
      )}

      {/* Create Dialog */}
      <Dialog.Root
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-overlay bg-overlay backdrop-blur-sm animate-fade-in" />
          <Dialog.Content
            className="fixed left-1/2 top-1/2 z-modal max-h-[85vh] w-11/12 max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-surface border border-border-subtle bg-bg-surface p-6 shadow-lg focus:outline-none animate-slide-in"
            aria-describedby={undefined}
          >
            <Dialog.Title className="mb-4 font-serif text-subtitle font-bold text-text-primary">
              Capture New Idea
            </Dialog.Title>
             <form onSubmit={(e) => { e.preventDefault(); void handleCreate(); }} className="space-y-4" aria-busy={isCreating}>
              <div>
                <label
                  htmlFor="create-idea-title"
                   className="mb-1 block text-small font-medium text-text-primary"
                >
                  Title
                </label>
                <input
                  id="create-idea-title"
                  autoFocus
                   className="w-full rounded-control border border-border-subtle bg-bg-base px-4 py-2 text-body text-text-primary placeholder:text-text-tertiary outline-none focus:ring-2 focus:ring-focus disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder="e.g. Quantum Entanglement in Biology"
                  value={newIdeaTitle}
                  onChange={(e) => setNewIdeaTitle(e.target.value)}
                  onFocus={() => setIsTitleFocused(true)}
                  onBlur={() => setIsTitleFocused(false)}
                   maxLength={255}
                   disabled={isCreating}
                />
                <div className="flex justify-end h-5 mt-1">
                  {isTitleFocused && (
                     <span className="text-caption text-text-tertiary animate-in fade-in duration-fast">
                      {newIdeaTitle.length}/255
                    </span>
                  )}
                </div>
              </div>
              <div>
                <label
                  htmlFor="create-idea-description"
                   className="mb-1 block text-small font-medium text-text-primary"
                >
                  Description
                </label>
                <textarea
                  id="create-idea-description"
                   className="h-32 w-full resize-none rounded-control border border-border-subtle bg-bg-base px-4 py-2 text-body text-text-primary placeholder:text-text-tertiary outline-none focus:ring-2 focus:ring-focus disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder="Briefly describe your hypothesis..."
                  value={newIdeaDesc}
                  onChange={(e) => setNewIdeaDesc(e.target.value)}
                   maxLength={5000}
                   disabled={isCreating}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                   disabled={isCreating}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                   disabled={!newIdeaTitle.trim() || isCreating}
                 >
                   {isCreating ? "Creating…" : "Create Idea"}
                 </Button>
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

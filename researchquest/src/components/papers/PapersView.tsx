import { logger } from "../../utils/logger";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  Plus,
  Search,
  BookOpen,
  X,
  ArrowUpDown,
  ArrowLeft,
  Users,
  Download,
  FileText,
  FileJson,
  Table,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useAppStore } from "../../store/appStore";
import { useShallow } from "zustand/react/shallow";
import { usePapers } from "../../hooks/usePapers";
import { AddPaperView } from "../entities/AddPaperView";
import { PaperDetailView } from "../entities/PaperDetailView";
import { PaperCard } from "./PaperCard";
import { useVirtualizer } from "@tanstack/react-virtual";
import { InlineError } from "../ui/ErrorFallback";
import { PaperCardSkeleton } from "../ui/Skeleton";
import { cn } from "../../lib/utils";
import * as Dialog from "@radix-ui/react-dialog";
import { OnboardingGuide } from "../layout/OnboardingGuide";
import type { Paper } from "../../types/database";
import { toast } from "sonner";
import {
  convertPapersToMarkdown,
  convertPapersToBibTeX,
  convertPapersToCSV,
  convertPapersToJSON,
  downloadFile,
} from "../../utils/export";
import { UNDO_WINDOW_MS } from "../../lib/constants";

type SortOption =
  | "updated_desc"
  | "updated_asc"
  | "created_desc"
  | "created_asc"
  | "title_asc"
  | "title_desc"
  | "year_desc"
  | "year_asc";

export function PapersView() {
  // Using useShallow to prevent unnecessary re-renders of the entire PapersView
  // when unrelated properties in the global appStore change.
  const {
    papers,
    papersLoading,
    selectedPaper,
    setSelectedPaper,
    userId,
    papersSyncError,
  } = useAppStore(
    useShallow((state) => ({
      papers: state.papers,
      papersLoading: state.papersLoading,
      selectedPaper: state.selectedPaper,
      setSelectedPaper: state.setSelectedPaper,
      userId: state.user?.id,
      papersSyncError: state.dataSyncErrors?.papers ?? null,
    })),
  );
  const {
    createPaper,
    createPapers,
    updatePaper,
    deletePaper,
    restorePaper,
    searchPaperByDOI,
    searchPapersByQuery,
  } = usePapers(userId);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("updated_desc");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDeletedRef = useRef<Paper | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const [columnCount, setColumnCount] = useState(1);

  useEffect(() => {
    const updateColumns = () => {
      if (window.innerWidth >= 1280) setColumnCount(3);
      else if (window.innerWidth >= 768) setColumnCount(2);
      else setColumnCount(1);
    };

    updateColumns();
    window.addEventListener("resize", updateColumns);
    return () => window.removeEventListener("resize", updateColumns);
  }, []);

  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
    };
  }, []);

  const handleDeleteWithUndo = useCallback(
    async (paperId: string) => {
      const paper = papers.find((p) => p.id === paperId);
      const success = await deletePaper(paperId);

      if (success && paper) {
        lastDeletedRef.current = paper;
        if (undoTimeoutRef.current) {
          clearTimeout(undoTimeoutRef.current);
        }

        const toastId = toast.success("Paper deleted", {
          description: "Undo within 6 seconds to restore it.",
          duration: UNDO_WINDOW_MS,
          action: {
            label: "Undo",
            onClick: async () => {
              if (lastDeletedRef.current) {
                await restorePaper(lastDeletedRef.current);
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
    [deletePaper, restorePaper, papers],
  );

  const handleSelectPaper = useCallback(
    (paper: Paper) => {
      setSelectedPaper(paper);
    },
    [setSelectedPaper],
  );

  // Performance: Pre-compute derived text fields for faster searching
  const searchablePapers = useMemo(() => {
    return (papers || []).map((paper) => ({
      paper,
      searchText: [paper.title || "", ...(paper.authors || [])]
        .join(" ")
        .toLowerCase(),
    }));
  }, [papers]);

  // Memoize filtered papers to avoid expensive recalculation on every render
  const filteredPapers = useMemo(() => {
    // Optimization: Skip filtering if query is empty and sort order matches default
    if (!searchQuery && sortOption === "updated_desc" && statusFilter === "all") {
      return papers || [];
    }

    let filtered;

    if (searchQuery) {
      filtered = [];
      const query = searchQuery?.toLowerCase() || "";
      const safeSearchablePapers = searchablePapers || [];
      for (let i = 0; i < safeSearchablePapers.length; i++) {
        const sp = safeSearchablePapers[i];
        if (statusFilter !== "all" && sp.paper.status !== statusFilter) continue;
        if (sp.searchText.includes(query)) {
          filtered.push(sp.paper);
        }
      }
    } else {
      filtered = statusFilter === "all" ? [...(papers || [])] : (papers || []).filter(p => p.status === statusFilter);
    }

    return filtered.sort((a, b) => {
      // Optimization: Use string comparison for ISO dates to avoid expensive Date object creation
      switch (sortOption) {
        case "updated_desc":
          return b.updated_at > a.updated_at ? 1 : -1;
        case "updated_asc":
          return a.updated_at > b.updated_at ? 1 : -1;
        case "created_desc":
          return b.created_at > a.created_at ? 1 : -1;
        case "created_asc":
          return a.created_at > b.created_at ? 1 : -1;
        case "title_asc":
          // Optimization: Use direct string comparison instead of localeCompare for better performance
          return (a.title || "") > (b.title || "")
            ? 1
            : (a.title || "") < (b.title || "")
              ? -1
              : 0;
        case "title_desc":
          // Optimization: Use direct string comparison instead of localeCompare for better performance
          return (b.title || "") > (a.title || "")
            ? 1
            : (b.title || "") < (a.title || "")
              ? -1
              : 0;
        case "year_desc": {
          // Optimization: Parse year from string instead of full Date parsing
          const yearA = a.publication_date
            ? parseInt(a.publication_date.substring(0, 4)) || 0
            : 0;
          const yearB = b.publication_date
            ? parseInt(b.publication_date.substring(0, 4)) || 0
            : 0;
          return yearB - yearA;
        }
        case "year_asc": {
          const yearA = a.publication_date
            ? parseInt(a.publication_date.substring(0, 4)) || 0
            : 0;
          const yearB = b.publication_date
            ? parseInt(b.publication_date.substring(0, 4)) || 0
            : 0;
          return yearA - yearB;
        }
        default:
          return 0;
      }
    });
  }, [papers, searchQuery, sortOption, statusFilter, searchablePapers]);

  const rowCount = Math.ceil(filteredPapers.length / columnCount);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 220, // Estimated height of a PaperCard row
    overscan: 2,
  });

  const handleExport = useCallback((format: "markdown" | "bibtex" | "csv" | "json") => {
    if (filteredPapers.length === 0) {
      toast.error("No papers to export");
      return;
    }

    const timestamp = new Date().toISOString().split("T")[0];
    let content = "";
    let filename = "";
    let type = "";

    try {
      switch (format) {
        case "markdown":
          content = convertPapersToMarkdown(filteredPapers);
          filename = `research-library-${timestamp}.md`;
          type = "text/markdown";
          break;
        case "bibtex":
          content = convertPapersToBibTeX(filteredPapers);
          filename = `research-library-${timestamp}.bib`;
          type = "text/plain";
          break;
        case "csv":
          content = convertPapersToCSV(filteredPapers);
          filename = `research-library-${timestamp}.csv`;
          type = "text/csv";
          break;
        case "json":
          content = convertPapersToJSON(filteredPapers);
          filename = `research-library-${timestamp}.json`;
          type = "application/json";
          break;
      }

      downloadFile(content, filename, type);
      toast.success(
        `Exported ${filteredPapers.length} papers as ${format.toUpperCase()}`,
      );
    } catch (err) {
      logger.error("Export failed", err);
      toast.error("Failed to export papers");
    }
  }, [filteredPapers]);

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
      {/* Main Content */}
      <div
        className={cn(
          "flex-1 flex flex-col min-w-0",
          selectedPaper && "max-lg:hidden",
        )}
      >
        <div className="p-4 sm:p-6 border-b border-border-subtle bg-bg-surface flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <p className="section-kicker">Library</p>
            <h1 className="mt-1 text-2xl font-serif font-bold text-text-primary">
              Research Library
            </h1>
            <p className="mt-1 text-small text-text-secondary">
              Manage and organize your research papers
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border-moderate bg-bg-surface px-4 text-sm font-semibold text-text-secondary shadow-sm transition-all hover:-translate-y-0.5 hover:border-border-strong hover:bg-bg-elevated hover:text-text-primary hover:shadow-lift focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2">
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Export
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="min-w-[180px] bg-bg-surface rounded-lg shadow-lift border border-border-moderate p-1 z-50 animate-in fade-in-0 zoom-in-95"
                  align="end"
                  sideOffset={5}
                >
                  <DropdownMenu.Item
                    onSelect={() => handleExport("markdown")}
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-bg-elevated hover:text-text-primary cursor-pointer outline-none"
                  >
                    <FileText className="h-4 w-4" />
                    Markdown (.md)
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => handleExport("bibtex")}
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-bg-elevated hover:text-text-primary cursor-pointer outline-none"
                  >
                    <FileText className="h-4 w-4" />
                    BibTeX (.bib)
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => handleExport("csv")}
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-bg-elevated hover:text-text-primary cursor-pointer outline-none"
                  >
                    <Table className="h-4 w-4" />
                    CSV (.csv)
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => handleExport("json")}
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-bg-elevated hover:text-text-primary cursor-pointer outline-none"
                  >
                    <FileJson className="h-4 w-4" />
                    JSON (.json)
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            <button
              onClick={() => setIsAddDialogOpen(true)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-text-primary px-4 text-sm font-semibold text-bg-base shadow-lift transition-transform hover:-translate-y-0.5 hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Paper
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-b border-border-subtle bg-bg-surface p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-md">
            <label htmlFor="papers-search-input" className="sr-only">Search library</label>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <input
              id="papers-search-input"
              ref={searchInputRef}
              type="text"
              placeholder="Search library..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-border-moderate bg-bg-surface py-2.5 pl-9 pr-10 text-small text-text-primary shadow-sm placeholder:text-text-tertiary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              aria-label="Search papers"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  searchInputRef.current?.focus();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-text-tertiary transition-colors hover:bg-bg-elevated hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
                aria-label="Clear search"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            )}
          </div>


          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="cursor-pointer rounded-lg border border-border-moderate bg-bg-surface px-3 py-2.5 text-small text-text-primary shadow-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              aria-label="Filter by status"
            >
              <option value="all">All Statuses</option>
              <option value="To Read">To Read</option>
              <option value="Reading">Reading</option>
              <option value="Read">Read</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-text-tertiary" />
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="min-w-[180px] cursor-pointer rounded-lg border border-border-moderate bg-bg-surface px-3 py-2.5 text-small text-text-primary shadow-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              aria-label="Sort papers"
            >
              <option value="updated_desc">Last Updated (Newest)</option>
              <option value="updated_asc">Last Updated (Oldest)</option>
              <option value="created_desc">Date Added (Newest)</option>
              <option value="created_asc">Date Added (Oldest)</option>
              <option value="title_asc">Title (A-Z)</option>
              <option value="title_desc">Title (Z-A)</option>
              <option value="year_desc">Publication Year (Newest)</option>
              <option value="year_asc">Publication Year (Oldest)</option>
            </select>
          </div>
        </div>

        <div className="sr-only" role="status" aria-live="polite">
          {!papersLoading && !papersSyncError && filteredPapers.length === 0 ? (searchQuery ? "No matches found. Try a different keyword or clear your search." : "No papers found. Start building your library by adding your first research paper.") : ""}
        </div>

        <div ref={parentRef} className="flex-1 overflow-auto p-4 sm:p-6">
          <OnboardingGuide />
          {papersSyncError ? (
            <InlineError
              message={papersSyncError.message}
              className="mb-4"
            />
          ) : papersLoading ? (
            <div
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
              role="status"
              aria-label="Loading papers..."
            >
              {[...new Array(6)].map((_, i) => (
                <PaperCardSkeleton key={i} />
              ))}
            </div>
          ) : filteredPapers.length === 0 ? (
            <div className="surface-card animate-rise mx-auto flex max-w-md flex-col items-center justify-center px-6 py-16 text-center">
              <span className="icon-tile h-16 w-16 rounded-2xl bg-violet-soft text-violet-strong">
                <BookOpen className="h-8 w-8" aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-serif text-lg font-semibold text-text-primary">
                {searchQuery ? "No matches found" : "No papers found"}
              </h3>
              <p className="mt-2 max-w-sm text-small text-text-secondary">
                {searchQuery
                  ? "Try a different keyword or clear your search."
                  : "Start building your library by adding your first research paper."}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setIsAddDialogOpen(true)}
                  className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-text-primary px-5 text-sm font-semibold text-bg-base shadow-lift transition-transform hover:-translate-y-0.5 hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
                >
                  Add a paper now &rarr;
                </button>
              )}
            </div>
          ) : (
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const startIndex = virtualRow.index * columnCount;
                const rowPapers = filteredPapers.slice(
                  startIndex,
                  startIndex + columnCount,
                );

                return (
                  <div
                    key={virtualRow.index}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                      display: "grid",
                      gridTemplateColumns:
                        columnCount === 3
                          ? "repeat(3, minmax(0, 1fr))"
                          : columnCount === 2
                            ? "repeat(2, minmax(0, 1fr))"
                            : "repeat(1, minmax(0, 1fr))",
                      gap: "1.5rem", // matches gap-6
                    }}
                  >
                    {rowPapers.map((paper) => (
                      <div key={paper.id}>
                        <PaperCard
                          paper={paper}
                          highlightQuery={searchQuery}
                          onSelect={handleSelectPaper}
                        />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Detail Drawer (Sheet) */}
      {selectedPaper && (
        <div className="absolute inset-0 w-full border-l-0 lg:border-l border-border-subtle bg-bg-surface flex flex-col h-full shadow-2xl z-20 lg:relative lg:inset-auto lg:w-[500px]">
          <div className="p-4 border-b border-border-subtle flex items-center justify-between bg-bg-elevated/80 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedPaper(null)}
                className="icon-btn lg:hidden"
                aria-label="Back to papers"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <h2 className="font-serif text-base font-semibold text-text-primary">
                Paper Details
              </h2>
            </div>
            <button
              onClick={() => setSelectedPaper(null)}
              aria-label="Close details"
              className="icon-btn hidden lg:flex"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <PaperDetailView
              paper={selectedPaper}
              onUpdate={updatePaper}
              onDelete={handleDeleteWithUndo}
            />
          </div>
        </div>
      )}

      {/* Add Paper Dialog */}
      <Dialog.Root open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-fade-in" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed left-[50%] top-[50%] max-h-[85vh] w-[90vw] max-w-[1000px] translate-x-[-50%] translate-y-[-50%] rounded-xl bg-bg-surface p-0 shadow-2xl focus:outline-none z-50 overflow-hidden animate-slide-in border border-border-moderate"
          >
            <div className="flex items-center justify-between p-4 border-b border-border-subtle">
              <Dialog.Title className="px-2 font-serif text-lg font-semibold text-text-primary">
                Add New Paper
              </Dialog.Title>
              <Dialog.Close
                aria-label="Close"
                className="icon-btn"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Dialog.Close>
            </div>
            <div className="overflow-y-auto max-h-[calc(85vh-60px)]">
              <AddPaperView
                onAdd={async (data) => {
                  const paper = await createPaper(data);
                  if (paper) setIsAddDialogOpen(false);
                  return paper;
                }}
                onAddBatch={async (data) => {
                  const newPapers = await createPapers(data);
                  if (newPapers.length > 0) setIsAddDialogOpen(false);
                  return newPapers;
                }}
                searchByDOI={searchPaperByDOI}
                searchByQuery={searchPapersByQuery}
              />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

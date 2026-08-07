import { logger } from "../../utils/logger";
import { useState, useCallback, useRef, useEffect } from "react";
import { useFilteredList } from "../../hooks/useFilteredList";
import {
  Plus,
  Search,
  BookOpen,
  X,
  ArrowUpDown,
  ArrowLeft,
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
import { EmptyState } from "../ui/EmptyState";
import { PageHeader } from "../ui/PageHeader";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
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
import { useUndoDelete } from "../../hooks/useUndoDelete";

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
  // ⚡ PERFORMANCE OPTIMIZATION:
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
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
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

  const { handleDeleteWithUndo } = useUndoDelete(
    (paper: Paper) => deletePaper(paper.id),
    (paper: Paper) => restorePaper(paper),
    { entityLabel: "Paper" },
  );

  const handlePaperDelete = useCallback(
    async (paperId: string): Promise<boolean> => {
      const paper = papers.find((p) => p.id === paperId);
      if (!paper) return false;
      await handleDeleteWithUndo(paper);
      return true;
    },
    [papers, handleDeleteWithUndo],
  );

  const handleSelectPaper = useCallback(
    (paper: Paper) => {
      setSelectedPaper(paper);
    },
    [setSelectedPaper],
  );

  const filteredPapers = useFilteredList(
    papers,
    searchQuery,
    useCallback((paper: Paper) => [paper.title || "", ...(paper.authors || [])].join(" "), []),
    useCallback((a: Paper, b: Paper) => {
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
    }, [sortOption]),
  );

  const rowCount = Math.ceil(filteredPapers.length / columnCount);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 240,
    overscan: 2,
  });

  const handleExport = (format: "markdown" | "bibtex" | "csv" | "json") => {
    if (filteredPapers.length === 0) {
      toast.error("No papers to export");
      return;
    }

    const timestamp = new Date().toISOString().split("T")[0];
    const exportScope = searchQuery.trim() ? "filtered" : "all";
    let content = "";
    let filename = "";
    let type = "";

    try {
      switch (format) {
        case "markdown":
          content = convertPapersToMarkdown(filteredPapers);
          filename = `research-library-${exportScope}-${timestamp}.md`;
          type = "text/markdown";
          break;
        case "bibtex":
          content = convertPapersToBibTeX(filteredPapers);
          filename = `research-library-${exportScope}-${timestamp}.bib`;
          type = "text/plain";
          break;
        case "csv":
          content = convertPapersToCSV(filteredPapers);
          filename = `research-library-${exportScope}-${timestamp}.csv`;
          type = "text/csv";
          break;
        case "json":
          content = convertPapersToJSON(filteredPapers);
          filename = `research-library-${exportScope}-${timestamp}.json`;
          type = "application/json";
          break;
      }

      downloadFile(content, filename, type);
      toast.success(
        `Exported ${filteredPapers.length} ${exportScope} papers as ${format.toUpperCase()}`,
      );
    } catch (err) {
      logger.error("Export failed", err);
      toast.error("Failed to export papers");
    }
  };

  return (
    <div className="relative flex h-full min-h-0 overflow-hidden bg-bg-base text-text-primary">
      {/* Main Content */}
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col",
          selectedPaper && "max-lg:hidden",
        )}
      >
        <PageHeader
          className="bg-bg-surface"
          title="Research Library"
          description="Manage and organize your research papers"
          actions={
            <>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <Button type="button" variant="outline">
                    <Download aria-hidden="true" />
                    Export
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    className="z-dropdown min-w-[220px] rounded-surface border border-border-subtle bg-bg-surface p-1 shadow-md animate-in fade-in-0 zoom-in-95"
                    align="end"
                    sideOffset={5}
                  >
                    <DropdownMenu.Item
                      onSelect={() => handleExport("markdown")}
                      className="flex cursor-pointer items-center gap-2 rounded-control px-3 py-2 text-small text-text-primary outline-none hover:bg-bg-elevated focus:bg-bg-elevated"
                    >
                      <FileText className="w-4 h-4" />
                      Markdown (.md) — {searchQuery.trim() ? "filtered" : "all"} papers
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onSelect={() => handleExport("bibtex")}
                      className="flex cursor-pointer items-center gap-2 rounded-control px-3 py-2 text-small text-text-primary outline-none hover:bg-bg-elevated focus:bg-bg-elevated"
                    >
                      <FileText className="w-4 h-4" />
                      BibTeX (.bib) — {searchQuery.trim() ? "filtered" : "all"} papers
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onSelect={() => handleExport("csv")}
                      className="flex cursor-pointer items-center gap-2 rounded-control px-3 py-2 text-small text-text-primary outline-none hover:bg-bg-elevated focus:bg-bg-elevated"
                    >
                      <Table className="w-4 h-4" />
                      CSV (.csv) — {searchQuery.trim() ? "filtered" : "all"} papers
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onSelect={() => handleExport("json")}
                      className="flex cursor-pointer items-center gap-2 rounded-control px-3 py-2 text-small text-text-primary outline-none hover:bg-bg-elevated focus:bg-bg-elevated"
                    >
                      <FileJson className="w-4 h-4" />
                      JSON (.json) — {searchQuery.trim() ? "filtered" : "all"} papers
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>

              <Button
                type="button"
                onClick={() => setIsAddDialogOpen(true)}
                variant="default"
              >
                <Plus aria-hidden="true" />
                Add Paper
              </Button>
            </>
          }
        />

        <div className="flex flex-col gap-4 border-b border-border-subtle bg-bg-surface p-4 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <label htmlFor="papers-search-input" className="sr-only">Search library</label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" aria-hidden="true" />
            <Input
              id="papers-search-input"
              ref={searchInputRef}
              type="text"
              placeholder="Search library..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-bg-base pl-10 pr-12 text-small"
              aria-label="Search papers"
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
                className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full text-text-tertiary hover:text-text-primary"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-text-tertiary" />
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="min-h-11 min-w-[180px] cursor-pointer rounded-control border border-border-moderate bg-bg-base px-3 py-2 text-small text-text-primary focus:outline-none focus:ring-2 focus:ring-focus md:min-h-0"
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

        <div ref={parentRef} className="flex-1 overflow-auto p-4 sm:p-6">
          <OnboardingGuide />
          {papersSyncError ? (
            <InlineError
              message={papersSyncError.message}
              className="mb-4"
            />
          ) : papersLoading ? (
            <div
              className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3"
              role="status"
              aria-label="Loading papers..."
            >
              {[...new Array(6)].map((_, i) => (
                <PaperCardSkeleton key={i} />
              ))}
            </div>
          ) : filteredPapers.length === 0 ? (
            <EmptyState
              className="py-20"
              icon={<BookOpen className="h-6 w-6" />}
              title={searchQuery.trim() ? "No matches found" : "No papers found"}
              description={
                searchQuery.trim()
                  ? "Try a different keyword or clear your search."
                  : "Start building your library by adding your first research paper."
              }
              action={
                searchQuery.trim() ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSearchQuery("");
                      searchInputRef.current?.focus();
                    }}
                  >
                    Clear search
                  </Button>
                ) : (
                  <Button type="button" onClick={() => setIsAddDialogOpen(true)}>
                    <Plus aria-hidden="true" />
                    Add Paper
                  </Button>
                )
              }
            />
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
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                      display: "grid",
                      gridTemplateColumns:
                        columnCount === 3
                          ? "repeat(3, minmax(0, 1fr))"
                          : columnCount === 2
                            ? "repeat(2, minmax(0, 1fr))"
                            : "repeat(1, minmax(0, 1fr))",
                    }}
                    className="gap-6 pb-6"
                  >
                    {rowPapers.map((paper) => (
                      <div key={paper.id} className="min-w-0">
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
        <div className="absolute inset-0 z-20 flex h-full min-h-0 w-full flex-col border-l-0 bg-bg-surface shadow-lg lg:relative lg:inset-auto lg:w-[500px] lg:border-l lg:border-border-subtle">
          <div className="flex items-center justify-between border-b border-border-subtle bg-bg-elevated/70 p-4">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setSelectedPaper(null)}
                className="-ml-2 rounded-full lg:hidden"
                aria-label="Back to papers"
              >
                <ArrowLeft aria-hidden="true" />
              </Button>
              <h2 className="font-semibold text-text-primary">
                Paper Details
              </h2>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setSelectedPaper(null)}
              aria-label="Close details"
              className="hidden rounded-full lg:inline-flex"
            >
              <X aria-hidden="true" />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            <PaperDetailView
              paper={selectedPaper}
              onUpdate={updatePaper}
              onDelete={handlePaperDelete}
            />
          </div>
        </div>
      )}

      {/* Add Paper Dialog */}
      <Dialog.Root open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-sm animate-fade-in" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed left-[50%] top-[50%] z-50 max-h-[85vh] w-[90vw] max-w-[1000px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-surface border border-border-subtle bg-bg-surface p-0 shadow-lg focus:outline-none animate-slide-in"
          >
            <div className="flex items-center justify-between border-b border-border-subtle p-4">
              <Dialog.Title className="px-2 text-body-lg font-semibold text-text-primary">
                Add New Paper
              </Dialog.Title>
              <Dialog.Close asChild>
                <Button type="button" variant="ghost" size="icon" aria-label="Close">
                  <X aria-hidden="true" />
                </Button>
              </Dialog.Close>
            </div>
            <div className="max-h-[calc(85vh-60px)] overflow-auto">
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

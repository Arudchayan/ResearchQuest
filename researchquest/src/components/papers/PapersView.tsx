import { logger } from "../../utils/logger";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  Plus,
  Search,
  BookOpen,
  X,
  ArrowUpDown,
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
import { PaperCardSkeleton } from "../ui/Skeleton";
import { cn } from "../../lib/utils";
import * as Dialog from "@radix-ui/react-dialog";
import { OnboardingGuide } from "../layout/OnboardingGuide";
import type { Paper } from "../../types/database";
import { toast } from "sonner";
import {
  convertPapersToBibTeX,
  convertPapersToCSV,
  convertPapersToJSON,
  downloadFile,
} from "../../utils/export";

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
  const { papers, papersLoading, selectedPaper, setSelectedPaper, userId } =
    useAppStore(
      useShallow((state) => ({
        papers: state.papers,
        papersLoading: state.papersLoading,
        selectedPaper: state.selectedPaper,
        setSelectedPaper: state.setSelectedPaper,
        userId: state.user?.id,
      }))
    );
  const {
    createPaper,
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

  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDeletedRef = useRef<Paper | null>(null);

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
          duration: 6000,
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
        }, 6000);
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

  // Memoize filtered papers to avoid expensive recalculation on every render
  const filteredPapers = useMemo(() => {
    // Optimization: Skip filtering if query is empty and sort order matches default
    if (!searchQuery && sortOption === "updated_desc") {
      return papers;
    }

    let filtered = papers;

    if (searchQuery) {
      // Optimization: Calculate query lowercasing once outside the loop
      const query = searchQuery.toLowerCase();
      filtered = papers.filter((paper) => {
        return (
          (paper.title && paper.title.toLowerCase().includes(query)) ||
          (paper.authors &&
            paper.authors.some((a) => a.toLowerCase().includes(query)))
        );
      });
    } else {
      // Create a shallow copy if we need to sort but not filter
      // (to avoid mutating the store)
      filtered = [...papers];
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
  }, [papers, searchQuery, sortOption]);

  const handleExport = (format: "bibtex" | "csv" | "json") => {
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
  };

  return (
    <div className="flex h-full bg-slate-50 dark:bg-slate-900 overflow-hidden">
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Research Library
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Manage and organize your research papers
            </p>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2 font-medium">
                  <Download className="w-5 h-5" />
                  Export
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="min-w-[180px] bg-white dark:bg-slate-950 rounded-lg shadow-lg border border-slate-200 dark:border-slate-800 p-1 z-50 animate-in fade-in-0 zoom-in-95"
                  align="end"
                  sideOffset={5}
                >
                  <DropdownMenu.Item
                    onSelect={() => handleExport("bibtex")}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer outline-none"
                  >
                    <FileText className="w-4 h-4" />
                    BibTeX (.bib)
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => handleExport("csv")}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer outline-none"
                  >
                    <Table className="w-4 h-4" />
                    CSV (.csv)
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => handleExport("json")}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer outline-none"
                  >
                    <FileJson className="w-4 h-4" />
                    JSON (.json)
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            <button
              onClick={() => setIsAddDialogOpen(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium"
            >
              <Plus className="w-5 h-5" />
              Add Paper
            </button>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search library..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-10 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Search papers"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  searchInputRef.current?.focus();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Clear search"
              >
                <X className="w-3 h-3" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-slate-400" />
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer min-w-[180px]"
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

        <div className="flex-1 overflow-auto p-6">
          <OnboardingGuide />
          {papersLoading ? (
            <div
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
              role="status"
              aria-label="Loading papers..."
            >
              {[...Array(6)].map((_, i) => (
                <PaperCardSkeleton key={i} />
              ))}
            </div>
          ) : filteredPapers.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 dark:text-white">
                No papers found
              </h3>
              <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-2">
                {searchQuery
                  ? "Try adjusting your search terms."
                  : "Start building your library by adding your first research paper."}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setIsAddDialogOpen(true)}
                  className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
                >
                  Add a paper now &rarr;
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredPapers.map((paper) => (
                <PaperCard
                  key={paper.id}
                  paper={paper}
                  onSelect={handleSelectPaper}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail Drawer (Sheet) */}
      {selectedPaper && (
        <div className="w-[500px] border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col h-full shadow-2xl relative z-20">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm">
            <h2 className="font-semibold text-slate-900 dark:text-white">
              Paper Details
            </h2>
            <button
              onClick={() => setSelectedPaper(null)}
              aria-label="Close details"
              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
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
            className="fixed left-[50%] top-[50%] max-h-[85vh] w-[90vw] max-w-[1000px] translate-x-[-50%] translate-y-[-50%] rounded-xl bg-white dark:bg-slate-950 p-0 shadow-2xl focus:outline-none z-50 overflow-hidden animate-slide-in border border-slate-200 dark:border-slate-800"
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
              <Dialog.Title className="text-lg font-semibold px-2">
                Add New Paper
              </Dialog.Title>
              <Dialog.Close
                aria-label="Close"
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
              >
                <X className="w-5 h-5" />
              </Dialog.Close>
            </div>
            <div className="overflow-y-auto max-h-[calc(85vh-60px)]">
              <AddPaperView
                onAdd={async (data) => {
                  const paper = await createPaper(data);
                  if (paper) setIsAddDialogOpen(false);
                  return paper;
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

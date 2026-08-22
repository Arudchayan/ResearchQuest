import { useState, useCallback, useEffect } from "react";
import { BookOpen, CheckCircle2, Info, LoaderCircle } from "lucide-react";
import { useAppStore } from "../../store/appStore";
import type { CrossrefPaper, Paper, PaperDraft } from "../../types/database";
import type { PaperSearchOptions } from "../../hooks/usePapers";
import { isValidUrl } from "../../utils/security";
import { usePaperSearch } from "../../hooks/usePaperSearchInternal";
import { useBibTeXImport } from "../../hooks/useBibTeXImport";
import { buildPaperPayload } from "../../utils/paperUtils";
import { DOISearchTab } from "./AddPaperTabs/DOISearchTab";
import { KeywordSearchTab } from "./AddPaperTabs/KeywordSearchTab";
import { ManualEntryTab } from "./AddPaperTabs/ManualEntryTab";
import { BibTeXImportTab } from "./AddPaperTabs/BibTeXImportTab";

interface AddPaperViewProps {
  onAdd: (paperData: PaperDraft) => Promise<Paper | null>;
  onAddBatch?: (papersData: PaperDraft[]) => Promise<Paper[]>;
  searchByDOI: (doi: string) => Promise<CrossrefPaper | null>;
  searchByQuery: (query: string, options?: PaperSearchOptions) => Promise<CrossrefPaper[]>;
}

const TAB_LABELS: Record<"doi" | "search" | "import" | "manual", string> = {
  doi: "DOI Search",
  search: "Keyword Search",
  import: "Import BibTeX",
  manual: "Manual Entry",
};

const TAB_DESCRIPTIONS: Record<keyof typeof TAB_LABELS, string> = {
  doi: "Look up a known DOI and review the Crossref record before adding it.",
  search: "Search Crossref by title or keywords, then select the result you want to save.",
  import: "Preview BibTeX entries before importing the selected records into your library.",
  manual: "Create a record yourself when a DOI or Crossref result is unavailable.",
};

export function AddPaperView({ onAdd, onAddBatch, searchByDOI, searchByQuery }: AddPaperViewProps) {
  const [activeTab, setActiveTab] = useState<"doi" | "search" | "manual" | "import">("doi");
  const [successMessage, setSuccessMessage] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const setSelectedPaper = useAppStore((state) => state.setSelectedPaper);

  const {
    loading: searchLoading,
    error: searchError,
    setError: setSearchError,
    doiResult,
    setDoiResult,
    searchResults,
    setSearchResults,
    selectedResult,
    setSelectedResult,
    performDOISearch,
    performQuerySearch,
  } = usePaperSearch({ searchByDOI, searchByQuery });

  const {
    loading: importLoading,
    error: importError,
    setError: setImportError,
    parsedEntries,
    selectedEntryIds,
    setSelectedEntryIds,
    importProgress,
    handleFileChange,
    handleImport,
  } = useBibTeXImport(onAdd, onAddBatch);

  // DOI State
  const [doiInput, setDoiInput] = useState("");

  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [resultLimit, setResultLimit] = useState("10");
  const [sortField, setSortField] = useState<"score" | "published" | "created" | "updated">("score");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  // Manual State
  const [manualTitle, setManualTitle] = useState("");
  const [manualAuthors, setManualAuthors] = useState("");
  const [manualDoi, setManualDoi] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState("");
  const [hasSearchedDOI, setHasSearchedDOI] = useState(false);
  const [hasSearchedQuery, setHasSearchedQuery] = useState(false);

  useEffect(() => {
    if (manualTitle.trim() && manualError === "Title is required") {
      setManualError("");
    }
  }, [manualTitle, manualError]);

  const showSuccess = useCallback((msg: string, paper?: Paper | null) => {
    setSuccessMessage(msg);
    if (paper) {
      setSelectedPaper(paper);
      window.history.pushState(null, "", `/papers/${paper.id}`);
    }
    setTimeout(() => setSuccessMessage(""), 4000);
  }, [setSelectedPaper]);

  const handleDOISearchAction = async (doi: string) => {
    setHasSearchedDOI(true);
    await performDOISearch(doi);
  };

  const handleAddDoiResult = async () => {
    if (!doiResult) return;
    setIsAdding(true);
    try {
      const created = await onAdd(buildPaperPayload(doiResult));
      if (created) {
        showSuccess("Paper added successfully", created);
        setDoiInput("");
        setDoiResult(null);
      }
    } catch (err) {
      setSearchError("Failed to add paper.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleQuerySearchAction = async (query: string) => {
    setHasSearchedQuery(true);
    await performQuerySearch(query, {
      rows: parseInt(resultLimit),
      sort: sortField,
      order: sortOrder,
    });
  };

  const handleAddSelectedResult = async () => {
    if (!selectedResult) return;
    setIsAdding(true);
    try {
      const created = await onAdd(buildPaperPayload(selectedResult));
      if (created) {
        showSuccess("Paper added successfully", created);
        setSearchQuery("");
        setSearchResults([]);
        setSelectedResult(null);
      }
    } catch (err) {
      setSearchError("Failed to add paper.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleManualAdd = async () => {
    if (!manualTitle.trim()) {
      setManualError("Title is required");
      return;
    }
    const trimmedUrl = manualUrl.trim();
    if (trimmedUrl && !isValidUrl(trimmedUrl)) {
      setManualError(
        "Invalid URL protocol. Only http:, https:, and mailto: URLs are allowed.",
      );
      return;
    }
    setManualError("");
    setManualLoading(true);
    try {
      const paperData: PaperDraft = {
        title: manualTitle.trim(),
        authors: manualAuthors.split(",").map(a => a.trim()).filter(Boolean),
        ...(manualDoi.trim() ? { doi: manualDoi.trim() } : {}),
        ...(trimmedUrl ? { source_url: trimmedUrl } : {}),
      };
      const created = await onAdd(paperData);
      if (created) {
        showSuccess("Paper added successfully", created);
        setManualTitle(""); setManualAuthors(""); setManualDoi(""); setManualUrl("");
      }
    } catch (err) {
      setManualError("Failed to add paper.");
    } finally {
      setManualLoading(false);
    }
  };

  const handleImportAction = async () => {
    const count = await handleImport();
    if (count > 0) showSuccess(`Successfully imported ${count} papers`);
  };

  const isSearchTab = activeTab === "doi" || activeTab === "search";
  const isBusy =
    (isSearchTab && searchLoading) ||
    (activeTab === "manual" && manualLoading) ||
    (activeTab === "import" && importLoading);
  const emptyState =
    activeTab === "doi" &&
    hasSearchedDOI &&
    !searchLoading &&
    !doiResult &&
    !searchError
      ? "No paper matched that DOI. Try a keyword search or create the record manually."
      : activeTab === "search" &&
          hasSearchedQuery &&
          !searchLoading &&
          searchResults.length === 0 &&
          !searchError
        ? "No Crossref results matched those keywords. Try broader terms or add the paper manually."
        : activeTab === "import" &&
            !importLoading &&
            !importError &&
            parsedEntries.length === 0
          ? "Upload a .bib file to preview its entries before importing."
          : activeTab === "manual" &&
              !manualLoading &&
              !manualError &&
              !manualTitle.trim()
            ? "Add a title first; authors, DOI, and source URL are optional but help keep the record traceable."
            : null;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8 flex items-center gap-3">
        <div className="p-3 bg-primary-100 dark:bg-primary-900/20 rounded-lg">
          <BookOpen className="w-6 h-6 text-primary-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Add Paper to Library</h1>
          <p className="text-text-secondary">Search by DOI, keywords, import BibTeX, or add manually</p>
        </div>
      </div>

      {successMessage && (
        <div
          role="status"
          className="mb-6 flex items-center gap-3 rounded-surface border border-success bg-success-bg p-4"
        >
          <CheckCircle2 className="h-5 w-5 text-success" />
          <p className="font-medium text-success">{successMessage}</p>
        </div>
      )}

      <div
        className="flex gap-2 mb-6 border-b border-border-subtle overflow-x-auto"
        role="tablist"
        aria-label="Add paper methods"
      >
        {(["doi", "search", "import", "manual"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`tabpanel-${tab}`}
            id={`tab-${tab}`}
            onClick={() => {
              setSearchError("");
              setImportError("");
              setActiveTab(tab);
            }}
            className={`relative px-6 py-3 text-small font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2 ${activeTab === tab ? "text-primary-500" : "text-text-secondary hover:text-text-primary"}`}
          >
            {TAB_LABELS[tab]}
            {activeTab === tab && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />
            )}
          </button>
        ))}
      </div>

      <div className="bg-bg-surface rounded-lg border border-border-subtle shadow-sm p-6">
        {searchError && (activeTab === "doi" || activeTab === "search") && (
          <div role="alert" className="mb-4 rounded-control border border-destructive bg-destructive-bg p-3 text-small text-destructive">
            {searchError}
          </div>
        )}
        <div className="mb-6 flex items-start gap-3 rounded-control border border-border-subtle bg-bg-elevated p-3 text-small text-text-secondary">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" aria-hidden="true" />
          <p>{TAB_DESCRIPTIONS[activeTab]}</p>
        </div>
        {isBusy && (
          <div className="mb-4 flex items-center gap-2 text-small text-text-secondary" role="status" aria-live="polite">
            <LoaderCircle className="h-4 w-4 animate-spin text-primary-500" aria-hidden="true" />
            {activeTab === "doi" && "Looking up this DOI in Crossref…"}
            {activeTab === "search" && "Searching Crossref…"}
            {activeTab === "import" && (importProgress ? `Importing ${importProgress.current} of ${importProgress.total} papers…` : "Reading your BibTeX file…")}
            {activeTab === "manual" && "Adding your paper to the library…"}
          </div>
        )}
        {emptyState && (
          <p className="mb-4 rounded-control bg-primary-50 p-3 text-small text-text-secondary dark:bg-primary-900/20" aria-live="polite">
            {emptyState}
          </p>
        )}
        {activeTab === "doi" && (
          <div role="tabpanel" id="tabpanel-doi" aria-labelledby="tab-doi">
            <DOISearchTab
              doiInput={doiInput}
              setDoiInput={setDoiInput}
              onSearch={handleDOISearchAction}
              onAdd={handleAddDoiResult}
              loading={searchLoading}
              isAdding={isAdding}
              doiResult={doiResult}
              isValidUrl={isValidUrl}
            />
          </div>
        )}
        {activeTab === "search" && (
          <div role="tabpanel" id="tabpanel-search" aria-labelledby="tab-search">
            <KeywordSearchTab
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onSearch={handleQuerySearchAction}
              onAdd={handleAddSelectedResult}
              loading={searchLoading}
              isAdding={isAdding}
              searchResults={searchResults}
              selectedResult={selectedResult}
              setSelectedResult={setSelectedResult}
              resultLimit={resultLimit}
              setResultLimit={setResultLimit}
              sortField={sortField}
              setSortField={setSortField}
              sortOrder={sortOrder}
              setSortOrder={setSortOrder}
              isValidUrl={isValidUrl}
            />
          </div>
        )}
        {activeTab === "import" && (
          <div role="tabpanel" id="tabpanel-import" aria-labelledby="tab-import">
            <BibTeXImportTab
              onFileSelect={handleFileChange}
              onImport={handleImportAction}
              loading={importLoading}
              error={importError}
              parsedEntries={parsedEntries}
              selectedEntryIds={selectedEntryIds}
              toggleEntrySelection={(id: string) => {
                const next = new Set(selectedEntryIds);
                if (next.has(id)) {
                  next.delete(id);
                } else {
                  next.add(id);
                }
                setSelectedEntryIds(next);
              }}
              importProgress={importProgress}
            />
          </div>
        )}
        {activeTab === "manual" && (
          <div role="tabpanel" id="tabpanel-manual" aria-labelledby="tab-manual">
            <ManualEntryTab
              manualTitle={manualTitle} setManualTitle={setManualTitle}
              manualAuthors={manualAuthors} setManualAuthors={setManualAuthors}
              manualDoi={manualDoi} setManualDoi={setManualDoi}
              manualUrl={manualUrl} setManualUrl={setManualUrl}
              onAdd={handleManualAdd}
              loading={manualLoading}
              error={manualError}
            />
          </div>
        )}
      </div>
    </div>
  );
}

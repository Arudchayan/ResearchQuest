import { useState, useCallback, useEffect } from "react";
import { BookOpen, CheckCircle2 } from "lucide-react";
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
  searchByDOI: (doi: string) => Promise<CrossrefPaper | null>;
  searchByQuery: (query: string, options?: PaperSearchOptions) => Promise<CrossrefPaper[]>;
}

const TAB_LABELS: Record<"doi" | "search" | "import" | "manual", string> = {
  doi: "DOI Search",
  search: "Keyword Search",
  import: "Import BibTeX",
  manual: "Manual Entry",
};

export function AddPaperView({ onAdd, searchByDOI, searchByQuery }: AddPaperViewProps) {
  const [activeTab, setActiveTab] = useState<"doi" | "search" | "manual" | "import">("doi");
  const [successMessage, setSuccessMessage] = useState("");
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
  } = useBibTeXImport(onAdd);

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
    await performDOISearch(doi);
  };

  const handleAddDoiResult = async () => {
    if (!doiResult) return;
    try {
      const created = await onAdd(buildPaperPayload(doiResult));
      if (created) {
        showSuccess("Paper added successfully! ✨", created);
        setDoiInput("");
        setDoiResult(null);
      }
    } catch (err) {
      setSearchError("Failed to add paper.");
    }
  };

  const handleQuerySearchAction = async (query: string) => {
    await performQuerySearch(query, {
      rows: parseInt(resultLimit),
      sort: sortField,
      order: sortOrder,
    });
  };

  const handleAddSelectedResult = async () => {
    if (!selectedResult) return;
    try {
      const created = await onAdd(buildPaperPayload(selectedResult));
      if (created) {
        showSuccess("Paper added successfully! ✨", created);
        setSearchQuery("");
        setSearchResults([]);
        setSelectedResult(null);
      }
    } catch (err) {
      setSearchError("Failed to add paper.");
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
        doi: manualDoi.trim() || undefined,
        source_url: trimmedUrl || undefined,
      };
      const created = await onAdd(paperData);
      if (created) {
        showSuccess("Paper added successfully! ✨", created);
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
    if (count > 0) showSuccess(`Successfully imported ${count} papers!`);
  };

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
          className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3"
        >
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <p className="text-green-800 font-medium">{successMessage}</p>
        </div>
      )}

      <div className="flex gap-2 mb-6 border-b border-border-subtle overflow-x-auto">
        {(["doi", "search", "import", "manual"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              setSearchError("");
              setImportError("");
              setActiveTab(tab);
            }}
            className={`px-6 py-3 text-sm font-medium transition-all relative ${activeTab === tab ? "text-primary-600" : "text-text-secondary"}`}
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
          <div
            role="alert"
            className="mb-4 p-3 rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm"
          >
            {searchError}
          </div>
        )}
        {activeTab === "doi" && (
          <DOISearchTab
            doiInput={doiInput}
            setDoiInput={setDoiInput}
            onSearch={handleDOISearchAction}
            onAdd={handleAddDoiResult}
            loading={searchLoading}
            doiResult={doiResult}
            isValidUrl={isValidUrl}
          />
        )}
        {activeTab === "search" && (
          <KeywordSearchTab
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onSearch={handleQuerySearchAction}
            onAdd={handleAddSelectedResult}
            loading={searchLoading}
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
        )}
        {activeTab === "import" && (
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
        )}
        {activeTab === "manual" && (
          <ManualEntryTab
            manualTitle={manualTitle} setManualTitle={setManualTitle}
            manualAuthors={manualAuthors} setManualAuthors={setManualAuthors}
            manualDoi={manualDoi} setManualDoi={setManualDoi}
            manualUrl={manualUrl} setManualUrl={setManualUrl}
            onAdd={handleManualAdd}
            loading={manualLoading}
            error={manualError}
          />
        )}
      </div>
    </div>
  );
}

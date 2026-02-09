import { useState, useRef } from "react";
import {
  Search,
  Plus,
  Loader,
  BookOpen,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import type { CrossrefPaper } from "../../types/database";
import { useAppStore } from "../../store/appStore";
import type { PaperSearchOptions } from "../../hooks/usePapers";
import { isValidUrl } from "../../utils/security";

interface AddPaperViewProps {
  onAdd: (paperData: any) => Promise<any>;
  searchByDOI: (doi: string) => Promise<CrossrefPaper | null>;
  searchByQuery: (
    query: string,
    options?: PaperSearchOptions,
  ) => Promise<CrossrefPaper[]>;
}

export function AddPaperView({
  onAdd,
  searchByDOI,
  searchByQuery,
}: AddPaperViewProps) {
  const [activeTab, setActiveTab] = useState<"doi" | "search" | "manual">(
    "doi",
  );
  const [doiInput, setDoiInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [resultLimit, setResultLimit] = useState("10");
  const [sortField, setSortField] = useState<
    "score" | "published" | "created" | "updated"
  >("score");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [searchResults, setSearchResults] = useState<CrossrefPaper[]>([]);
  const [doiResult, setDoiResult] = useState<CrossrefPaper | null>(null);
  const [selectedResult, setSelectedResult] = useState<CrossrefPaper | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Manual entry fields
  const [manualTitle, setManualTitle] = useState("");
  const [manualAuthors, setManualAuthors] = useState("");
  const [manualDoi, setManualDoi] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const setSelectedPaper = useAppStore((state) => state.setSelectedPaper);
  const manualTitleInputRef = useRef<HTMLInputElement>(null);

  const buildPaperPayload = (paper: CrossrefPaper) => {
    const paperData: any = {
      title: paper.title,
      authors: Array.isArray(paper.authors) ? paper.authors : [],
    };

    if (paper.doi && paper.doi.trim()) paperData.doi = paper.doi.trim();
    if (paper.sourceUrl && paper.sourceUrl.trim())
      paperData.source_url = paper.sourceUrl.trim();
    if (paper.abstract && paper.abstract.trim())
      paperData.abstract = paper.abstract.trim();
    if (paper.publicationDate) {
      const year = paper.publicationDate.toString();
      paperData.publication_date = /^\d{4}$/.test(year)
        ? `${year}-01-01`
        : year;
    }

    return paperData;
  };

  const handleDOISearch = async () => {
    if (!doiInput.trim()) return;

    setLoading(true);
    setError("");
    setDoiResult(null);
    setSelectedResult(null);
    setSuccessMessage("");

    const result = await searchByDOI(doiInput.trim());

    if (result) {
      setDoiResult(result);
    } else {
      setError("Paper not found. Try manual entry or search by keywords.");
    }

    setLoading(false);
  };

  const handleAddDoiResult = async () => {
    if (!doiResult) return;

    setLoading(true);
    try {
      const created = await onAdd(buildPaperPayload(doiResult));
      if (created) {
        setSuccessMessage(
          "Paper added successfully! ✨ Check the sidebar to view it.",
        );
        setDoiInput("");
        setDoiResult(null);
        setSelectedPaper(created);
        window.history.pushState(null, "", `/papers/${created.id}`);
        setTimeout(() => setSuccessMessage(""), 4000);
      }
    } catch (error) {
      console.error("Failed to add paper:", error);
      setError(
        `Failed to add paper: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleQuerySearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError("");
    setSuccessMessage("");

    const rows = Number.parseInt(resultLimit, 10);
    const results = await searchByQuery(searchQuery.trim(), {
      rows: Number.isNaN(rows) ? undefined : rows,
      sort: sortField,
      order: sortOrder,
    });
    setSearchResults(results);
    setSelectedResult(results[0] ?? null);

    if (results.length === 0) {
      setError("No papers found. Try different keywords or use manual entry.");
    }

    setLoading(false);
  };

  const handlePreviewResult = (result: CrossrefPaper) => {
    setSelectedResult(result);
    setError("");
  };

  const handleAddSelectedResult = async () => {
    if (!selectedResult) return;

    setLoading(true);
    try {
      const created = await onAdd(buildPaperPayload(selectedResult));
      if (created) {
        setSuccessMessage(
          "Paper added successfully! ✨ Check the sidebar to view it.",
        );
        setSelectedPaper(created);
        window.history.pushState(null, "", `/papers/${created.id}`);
        setSearchQuery("");
        setSearchResults([]);
        setSelectedResult(null);
        setTimeout(() => setSuccessMessage(""), 4000);
      }
    } catch (error) {
      console.error("Failed to add paper:", error);
      setError(
        `Failed to add paper: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleManualAdd = async () => {
    if (!manualTitle.trim()) {
      setError("Title is required");
      manualTitleInputRef.current?.focus();
      return;
    }

    if (manualUrl && !isValidUrl(manualUrl)) {
      setError(
        "Invalid URL protocol. Only http, https, and mailto are allowed.",
      );
      return;
    }

    const paperData: any = {
      title: manualTitle.trim(),
      authors: manualAuthors
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean),
    };

    // Only add optional fields if they have valid values
    if (manualDoi && manualDoi.trim()) paperData.doi = manualDoi.trim();
    if (manualUrl && manualUrl.trim()) paperData.source_url = manualUrl.trim();

    setLoading(true);
    try {
      const result = await onAdd(paperData);
      if (result) {
        setSuccessMessage(
          "Paper added successfully! ✨ Check the sidebar to view it.",
        );
        setManualTitle("");
        setManualAuthors("");
        setManualDoi("");
        setManualUrl("");
        setError("");
        setSelectedPaper(result);
        window.history.pushState(null, "", `/papers/${result.id}`);
        setTimeout(() => setSuccessMessage(""), 4000);
      }
    } catch (error) {
      console.error("Failed to add paper:", error);
      setError(
        `Failed to add paper: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-3 bg-primary-100 dark:bg-primary-900/20 rounded-lg">
            <BookOpen className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-text-primary">
              Add Paper to Library
            </h1>
            <p className="text-text-secondary mt-1">
              Search by DOI, keywords, or add manually
            </p>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
          <p className="text-green-800 dark:text-green-300 font-medium">
            {successMessage}
          </p>
        </div>
      )}

      {/* Tabs */}
      <div
        className="flex gap-2 mb-6 border-b border-border-subtle"
        role="tablist"
      >
        <button
          role="tab"
          aria-selected={activeTab === "doi"}
          aria-controls="view-panel-doi"
          id="view-tab-doi"
          onClick={() => {
            setActiveTab("doi");
            setError("");
          }}
          className={`px-6 py-3 text-sm font-medium transition-all relative ${
            activeTab === "doi"
              ? "text-primary-600 dark:text-primary-400"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          DOI Search
          {activeTab === "doi" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />
          )}
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "search"}
          aria-controls="view-panel-search"
          id="view-tab-search"
          onClick={() => {
            setActiveTab("search");
            setError("");
          }}
          className={`px-6 py-3 text-sm font-medium transition-all relative ${
            activeTab === "search"
              ? "text-primary-600 dark:text-primary-400"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          Keyword Search
          {activeTab === "search" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />
          )}
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "manual"}
          aria-controls="view-panel-manual"
          id="view-tab-manual"
          onClick={() => {
            setActiveTab("manual");
            setError("");
          }}
          className={`px-6 py-3 text-sm font-medium transition-all relative ${
            activeTab === "manual"
              ? "text-primary-600 dark:text-primary-400"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          Manual Entry
          {activeTab === "manual" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />
          )}
        </button>
      </div>

      {/* Content */}
      <div className="bg-bg-surface rounded-lg border border-border-subtle shadow-sm p-6">
        {activeTab === "doi" && (
          <div
            className="space-y-6"
            role="tabpanel"
            id="view-panel-doi"
            aria-labelledby="view-tab-doi"
          >
            <div>
              <label
                htmlFor="view-doi-input"
                className="block text-sm font-medium text-text-primary mb-3"
              >
                Enter DOI (Digital Object Identifier)
              </label>
              <div className="flex gap-3">
                <input
                  id="view-doi-input"
                  type="text"
                  value={doiInput}
                  onChange={(e) => setDoiInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleDOISearch()}
                  placeholder="e.g., 10.1038/nature12373"
                  maxLength={255}
                  className="flex-1 px-4 py-3 bg-bg-base border border-border-subtle rounded-lg text-body focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <button
                  onClick={handleDOISearch}
                  disabled={loading || !doiInput.trim()}
                  className="px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
                >
                  {loading ? (
                    <Loader className="w-5 h-5 animate-spin" />
                  ) : (
                    <Search className="w-5 h-5" />
                  )}
                  Search
                </button>
              </div>
              <p className="text-sm text-text-tertiary mt-2">
                Find papers using their unique DOI identifier
              </p>
            </div>

            {error && (
              <div
                data-testid="error-message"
                className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg"
              >
                {error}
              </div>
            )}

            {doiResult && (
              <div className="space-y-4" data-testid="doi-result">
                <div className="p-6 border-2 border-primary-500 rounded-lg bg-bg-elevated">
                  <div className="flex items-start gap-3 mb-3">
                    <BookOpen className="w-6 h-6 text-primary-500 flex-shrink-0 mt-1" />
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-text-primary mb-2">
                        {doiResult.title}
                      </h3>
                      <p className="text-sm text-text-secondary mb-3">
                        {doiResult.authors.slice(0, 5).join(", ")}
                        {doiResult.authors.length > 5 ? ", et al." : ""}
                      </p>
                      <div className="flex flex-wrap gap-3 text-sm">
                        {doiResult.doi && (
                          <div className="flex items-center gap-2 text-text-tertiary">
                            <span className="font-medium">DOI:</span>
                            <span>{doiResult.doi}</span>
                          </div>
                        )}
                        {doiResult.publicationDate && (
                          <div className="flex items-center gap-2 text-text-tertiary">
                            <span className="font-medium">Year:</span>
                            <span>{doiResult.publicationDate}</span>
                          </div>
                        )}
                        {doiResult.sourceUrl && (
                          <a
                            href={doiResult.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-primary-500 hover:text-primary-600"
                          >
                            <ExternalLink className="w-4 h-4" />
                            <span>View Source</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                  {doiResult.abstract && (
                    <div className="mt-4 pt-4 border-t border-border-subtle">
                      <p className="text-sm text-text-secondary line-clamp-4">
                        {doiResult.abstract}
                      </p>
                    </div>
                  )}
                </div>
                <button
                  onClick={handleAddDoiResult}
                  disabled={loading}
                  className="w-full px-6 py-4 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-semibold flex items-center justify-center gap-2 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader className="w-6 h-6 animate-spin" />
                  ) : (
                    <Plus className="w-6 h-6" />
                  )}
                  {loading ? "Adding..." : "Add Paper to Library"}
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "search" && (
          <div
            className="space-y-6"
            role="tabpanel"
            id="view-panel-search"
            aria-labelledby="view-tab-search"
          >
            <div>
              <label
                htmlFor="view-search-input"
                className="block text-sm font-medium text-text-primary mb-3"
              >
                Search by Keywords or Title
              </label>
              <div className="flex flex-col gap-3 lg:flex-row">
                <input
                  id="view-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleQuerySearch()}
                  placeholder="e.g., CRISPR gene editing, quantum computing"
                  maxLength={255}
                  className="flex-1 px-4 py-3 bg-bg-base border border-border-subtle rounded-lg text-body focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <div className="flex gap-3">
                  <button
                    onClick={handleQuerySearch}
                    disabled={loading || !searchQuery.trim()}
                    className="px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
                  >
                    {loading ? (
                      <Loader className="w-5 h-5 animate-spin" />
                    ) : (
                      <Search className="w-5 h-5" />
                    )}
                    Search
                  </button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="view-limit-select"
                    className="text-xs font-medium text-text-secondary"
                  >
                    Results per search
                  </label>
                  <select
                    id="view-limit-select"
                    value={resultLimit}
                    onChange={(event) => setResultLimit(event.target.value)}
                    className="px-3 py-2 bg-bg-base border border-border-subtle rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="view-sort-select"
                    className="text-xs font-medium text-text-secondary"
                  >
                    Sort by
                  </label>
                  <select
                    id="view-sort-select"
                    value={sortField}
                    onChange={(event) =>
                      setSortField(event.target.value as typeof sortField)
                    }
                    className="px-3 py-2 bg-bg-base border border-border-subtle rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="score">Relevance</option>
                    <option value="published">Publication Date</option>
                    <option value="created">Created Date</option>
                    <option value="updated">Last Updated</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="view-order-select"
                    className="text-xs font-medium text-text-secondary"
                  >
                    Order
                  </label>
                  <select
                    id="view-order-select"
                    value={sortOrder}
                    onChange={(event) =>
                      setSortOrder(event.target.value as typeof sortOrder)
                    }
                    className="px-3 py-2 bg-bg-base border border-border-subtle rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="desc">Descending</option>
                    <option value="asc">Ascending</option>
                  </select>
                </div>
              </div>
              <p className="text-sm text-text-tertiary mt-2">
                Search research papers by topic, author, or keywords. Customize
                your result count and ordering to explore more than the default
                top entries.
              </p>
            </div>

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg">
                {error}
              </div>
            )}

            {searchResults.length > 0 && (
              <div className="space-y-4">
                <p className="text-sm font-medium text-text-secondary">
                  Found {searchResults.length} papers — preview the details
                  before adding them to your library
                </p>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr]">
                  <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                    {searchResults.map((result, index) => {
                      const key = result.doi || `${result.title}-${index}`;
                      const isActive = selectedResult
                        ? (selectedResult.doi &&
                            result.doi &&
                            selectedResult.doi === result.doi) ||
                          selectedResult.title === result.title
                        : false;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => handlePreviewResult(result)}
                          className={`w-full text-left p-4 border rounded-xl transition-all bg-bg-base/90 backdrop-blur-sm shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                            isActive
                              ? "border-primary-500 ring-1 ring-primary-200/70 dark:ring-primary-500/40 shadow-primary-500/10"
                              : "border-border-subtle hover:border-primary-400/80"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <span className="inline-flex items-center gap-2 text-caption font-semibold uppercase tracking-wide text-primary-500">
                              {result.publicationDate || "—"}
                            </span>
                            <span className="text-caption text-text-tertiary">
                              {index + 1} of {searchResults.length}
                            </span>
                          </div>
                          <h4 className="font-semibold text-text-primary mt-2 mb-2 leading-snug line-clamp-2">
                            {result.title}
                          </h4>
                          <p className="text-sm text-text-secondary leading-relaxed line-clamp-2">
                            {result.authors.slice(0, 3).join(", ")}
                            {result.authors.length > 3 ? ", et al." : ""}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-3 text-xs text-text-tertiary">
                            {result.doi && (
                              <a
                                href={`https://doi.org/${result.doi}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(event) => event.stopPropagation()}
                                className="font-medium text-primary-500 hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-sm"
                              >
                                DOI: {result.doi}
                              </a>
                            )}
                            {result.containerTitle && (
                              <span className="font-medium text-text-secondary/80">
                                {result.containerTitle}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="bg-bg-base border border-border-subtle rounded-xl p-5 shadow-sm flex flex-col gap-4 h-full">
                    {selectedResult ? (
                      <>
                        <div className="flex flex-col gap-4">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div className="p-2 rounded-md bg-primary-500/10 text-primary-600 dark:text-primary-300">
                                <BookOpen className="w-5 h-5" />
                              </div>
                              <div className="space-y-2 min-w-0">
                                <div className="space-y-1">
                                  <p className="text-caption font-medium text-primary-500 uppercase tracking-wider">
                                    {selectedResult.type?.replace(/_/g, " ") ||
                                      "Research"}
                                  </p>
                                  <h3 className="text-xl font-semibold text-text-primary leading-snug">
                                    {selectedResult.title}
                                  </h3>
                                </div>
                                <p className="text-sm text-text-secondary leading-relaxed">
                                  {selectedResult.authors.join(", ")}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={handleAddSelectedResult}
                              disabled={loading}
                              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-500 text-white rounded-lg font-semibold hover:bg-primary-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed w-full sm:w-auto"
                            >
                              {loading ? (
                                <Loader className="w-4 h-4 animate-spin" />
                              ) : (
                                <Plus className="w-4 h-4" />
                              )}
                              {loading ? "Adding..." : "Add to library"}
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-text-tertiary">
                            {selectedResult.doi && (
                              <div className="flex flex-col gap-1">
                                <span className="font-medium text-text-secondary">
                                  DOI
                                </span>
                                <a
                                  href={`https://doi.org/${selectedResult.doi}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="truncate text-primary-500 hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-sm"
                                  title={selectedResult.doi}
                                >
                                  {selectedResult.doi}
                                </a>
                              </div>
                            )}
                            {selectedResult.publicationDate && (
                              <div>
                                <span className="font-medium text-text-secondary block">
                                  Year
                                </span>
                                <span>{selectedResult.publicationDate}</span>
                              </div>
                            )}
                            {selectedResult.containerTitle && (
                              <div>
                                <span className="font-medium text-text-secondary block">
                                  Journal / Venue
                                </span>
                                <span>{selectedResult.containerTitle}</span>
                              </div>
                            )}
                            {selectedResult.publisher && (
                              <div>
                                <span className="font-medium text-text-secondary block">
                                  Publisher
                                </span>
                                <span>{selectedResult.publisher}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="bg-bg-elevated/80 border border-border-subtle rounded-lg p-4 max-h-52 overflow-y-auto">
                          <p className="text-sm text-text-secondary whitespace-pre-line">
                            {selectedResult.abstract ||
                              "No abstract available for this entry."}
                          </p>
                        </div>
                        <div className="flex items-center justify-between gap-3 flex-wrap border-t border-border-subtle pt-4 mt-auto">
                          {selectedResult.sourceUrl ? (
                            <a
                              href={selectedResult.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary-500 hover:text-primary-600 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-sm"
                            >
                              <ExternalLink className="w-4 h-4" />
                              View original source
                            </a>
                          ) : (
                            <span className="text-caption text-text-tertiary">
                              No external link available
                            </span>
                          )}
                          <span className="text-caption text-text-tertiary">
                            Tip: add now, organize topics later.
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center text-text-secondary">
                        <BookOpen className="w-10 h-10 mb-4 text-text-tertiary" />
                        <p className="font-medium">
                          Select a paper on the left to see its full details.
                        </p>
                        <p className="text-sm mt-2">
                          You can review the abstract, venue, and metadata
                          before adding it to your workspace.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "manual" && (
          <div
            className="space-y-6"
            role="tabpanel"
            id="view-panel-manual"
            aria-labelledby="view-tab-manual"
          >
            <div>
              <label
                htmlFor="view-manual-title"
                className="block text-sm font-medium text-text-primary mb-2"
              >
                Title <span className="text-red-500">*</span>
              </label>
              <input
                ref={manualTitleInputRef}
                id="view-manual-title"
                type="text"
                value={manualTitle}
                onChange={(e) => {
                  setManualTitle(e.target.value);
                  if (error) setError("");
                }}
                placeholder="Enter paper title"
                maxLength={255}
                aria-invalid={!manualTitle.trim() && error === "Title is required"}
                aria-describedby={error ? "manual-entry-error" : undefined}
                className="w-full px-4 py-3 bg-bg-base border border-border-subtle rounded-lg text-body focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <span className="text-xs text-text-tertiary text-right mt-1 block">
                {manualTitle.length}/255
              </span>
            </div>

            <div>
              <label
                htmlFor="view-manual-authors"
                className="block text-sm font-medium text-text-primary mb-2"
              >
                Authors{" "}
                <span className="text-text-tertiary">(comma separated)</span>
              </label>
              <input
                id="view-manual-authors"
                type="text"
                value={manualAuthors}
                onChange={(e) => setManualAuthors(e.target.value)}
                placeholder="John Doe, Jane Smith, et al."
                maxLength={1000}
                className="w-full px-4 py-3 bg-bg-base border border-border-subtle rounded-lg text-body focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label
                htmlFor="view-manual-doi"
                className="block text-sm font-medium text-text-primary mb-2"
              >
                DOI <span className="text-text-tertiary">(optional)</span>
              </label>
              <input
                id="view-manual-doi"
                type="text"
                value={manualDoi}
                onChange={(e) => setManualDoi(e.target.value)}
                placeholder="10.1038/nature12373"
                maxLength={255}
                className="w-full px-4 py-3 bg-bg-base border border-border-subtle rounded-lg text-body focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label
                htmlFor="view-manual-url"
                className="block text-sm font-medium text-text-primary mb-2"
              >
                URL <span className="text-text-tertiary">(optional)</span>
              </label>
              <input
                id="view-manual-url"
                type="url"
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                placeholder="https://..."
                maxLength={2048}
                className="w-full px-4 py-3 bg-bg-base border border-border-subtle rounded-lg text-body focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {error && (
              <div
                id="manual-entry-error"
                className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg"
              >
                {error}
              </div>
            )}

            <button
              onClick={handleManualAdd}
              disabled={loading}
              className="w-full px-6 py-4 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-semibold flex items-center justify-center gap-2 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader className="w-6 h-6 animate-spin" />
              ) : (
                <Plus className="w-6 h-6" />
              )}
              {loading ? "Adding Paper..." : "Add Paper"}
            </button>
          </div>
        )}
      </div>

      {/* Help Card */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
          💡 Tips
        </h3>
        <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1 list-disc list-inside">
          <li>Use DOI search for the most accurate results</li>
          <li>Keyword search finds papers from CrossRef database</li>
          <li>Manual entry is perfect for papers without a DOI</li>
        </ul>
      </div>
    </div>
  );
}

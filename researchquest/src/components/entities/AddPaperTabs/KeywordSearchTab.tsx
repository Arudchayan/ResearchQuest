import { useRef, useCallback } from "react";
import { Loader, Search, X, BookOpen, Plus, ExternalLink } from "lucide-react";
import type { CrossrefPaper } from "../../../types/database";

interface KeywordSearchTabProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  onSearch: (query: string) => Promise<void>;
  onAdd: () => Promise<void>;
  loading: boolean;
  searchResults: CrossrefPaper[];
  selectedResult: CrossrefPaper | null;
  setSelectedResult: (res: CrossrefPaper) => void;
  resultLimit: string;
  setResultLimit: (val: string) => void;
  sortField: string;
  setSortField: (val: any) => void;
  sortOrder: string;
  setSortOrder: (val: any) => void;
  isValidUrl: (url: string) => boolean;
}

export function KeywordSearchTab({
  searchQuery,
  setSearchQuery,
  onSearch,
  onAdd,
  loading,
  searchResults,
  selectedResult,
  setSelectedResult,
  resultLimit,
  setResultLimit,
  sortField,
  setSortField,
  sortOrder,
  setSortOrder,
  isValidUrl,
}: KeywordSearchTabProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") onSearch(searchQuery);
  }, [onSearch, searchQuery]);

  return (
    <div className="space-y-6" role="tabpanel" id="view-panel-search">
      <div className="space-y-4">
        <label htmlFor="view-search-input" className="block text-sm font-medium text-text-primary mb-3">
          Search by Keywords or Title
        </label>
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <input
              ref={searchInputRef}
              id="view-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="e.g., CRISPR gene editing"
              className="w-full px-4 py-3 bg-bg-base border border-border-subtle rounded-lg focus:ring-2 focus:ring-primary-500"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(""); searchInputRef.current?.focus(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-tertiary"
                aria-label="Clear search"
                title="Clear search"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>
          <button
            onClick={() => onSearch(searchQuery)}
            disabled={loading || !searchQuery.trim()}
            className="px-6 py-3 bg-primary-500 text-white rounded-lg flex items-center gap-2 hover:bg-primary-600 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? <Loader className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            Search
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
           <select value={resultLimit} onChange={(e) => setResultLimit(e.target.value)} aria-label="Result limit" className="bg-bg-base border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
             <option value="10">10 Results</option>
             <option value="25">25 Results</option>
             <option value="50">50 Results</option>
           </select>
           <select value={sortField} onChange={(e) => setSortField(e.target.value)} aria-label="Sort field" className="bg-bg-base border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
             <option value="score">Relevance</option>
             <option value="published">Date</option>
           </select>
           <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} aria-label="Sort order" className="bg-bg-base border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
             <option value="desc">Descending</option>
             <option value="asc">Ascending</option>
           </select>
        </div>
      </div>

      {searchResults.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
            {searchResults.map((result, idx) => (
              <button
                key={result.doi || idx}
                onClick={() => setSelectedResult(result)}
                aria-pressed={selectedResult?.doi === result.doi}
                className={`w-full text-left p-4 border rounded-xl transition-all hover:bg-bg-elevated/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2 ${selectedResult?.doi === result.doi ? "border-primary-500 ring-1 ring-primary-500 bg-bg-elevated/50" : "border-border-subtle"}`}
              >
                <h4 className="font-semibold text-text-primary line-clamp-2">{result.title}</h4>
                <p className="text-sm text-text-secondary truncate">{result.authors.join(", ")}</p>
              </button>
            ))}
          </div>
          <div className="bg-bg-base border border-border-subtle rounded-xl p-5 shadow-sm">
            {selectedResult ? (
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">{selectedResult.title}</h3>
                <p className="text-sm text-text-secondary">{selectedResult.authors.join(", ")}</p>
                <p className="text-sm text-text-tertiary line-clamp-4">{selectedResult.abstract}</p>
                {selectedResult.sourceUrl && isValidUrl(selectedResult.sourceUrl) && (
                  <a
                    href={selectedResult.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:underline"
                  >
                    View original source
                    <ExternalLink className="w-4 h-4" aria-hidden="true" />
                  </a>
                )}
                <button
                  onClick={onAdd}
                  disabled={loading}
                  className="w-full py-2.5 bg-primary-500 text-white rounded-lg font-semibold flex justify-center items-center gap-2 hover:bg-primary-600 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2 disabled:opacity-70 disabled:cursor-not-allowed"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Add to library
                </button>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-text-secondary">
                <BookOpen className="w-10 h-10 mb-4 text-text-tertiary" />
                <p>Select a paper to see details.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

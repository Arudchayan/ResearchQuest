import { useState, useRef, useCallback } from "react";
import { Loader, Search, X } from "lucide-react";
import type { CrossrefPaper } from "../../types/database";

interface DOISearchTabProps {
  doiInput: string;
  setDoiInput: (val: string) => void;
  onSearch: (doi: string) => Promise<void>;
  onAdd: () => Promise<void>;
  loading: boolean;
  doiResult: CrossrefPaper | null;
  isValidUrl: (url: string) => boolean;
}

export function DOISearchTab({
  doiInput,
  setDoiInput,
  onSearch,
  onAdd,
  loading,
  doiResult,
  isValidUrl,
}: DOISearchTabProps) {
  const doiInputRef = useRef<HTMLInputElement>(null);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") onSearch(doiInput);
  }, [onSearch, doiInput]);

  return (
    <div className="space-y-6" role="tabpanel" id="view-panel-doi">
      <div>
        <label htmlFor="view-doi-input" className="block text-sm font-medium text-text-primary mb-3">
          Enter DOI (Digital Object Identifier)
        </label>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <input
              ref={doiInputRef}
              id="view-doi-input"
              type="text"
              value={doiInput}
              onChange={(e) => setDoiInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="e.g., 10.1038/nature12373"
              className="w-full px-4 py-3 bg-bg-base border border-border-subtle rounded-lg focus:ring-2 focus:ring-primary-500"
            />
            {doiInput && (
              <button
                onClick={() => { setDoiInput(""); doiInputRef.current?.focus(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-tertiary"
                aria-label="Clear input"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => onSearch(doiInput)}
            disabled={loading || !doiInput.trim()}
            className="px-6 py-3 bg-primary-500 text-white rounded-lg flex items-center gap-2"
          >
            {loading ? <Loader className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            Search
          </button>
        </div>
      </div>

      {doiResult && (
        <div className="space-y-4">
          <div className="p-6 border-2 border-primary-500 rounded-lg bg-bg-elevated">
            <h3 className="text-lg font-semibold mb-2">{doiResult.title}</h3>
            <p className="text-sm text-text-secondary mb-3">{doiResult.authors.join(", ")}</p>
            {doiResult.abstract && (
              <p className="mt-4 pt-4 border-t text-sm text-text-secondary line-clamp-4">
                {doiResult.abstract}
              </p>
            )}
          </div>
          <button
            onClick={onAdd}
            disabled={loading}
            className="w-full py-4 bg-primary-500 text-white rounded-lg font-semibold flex justify-center items-center gap-2"
          >
            {loading ? <Loader className="w-6 h-6 animate-spin" /> : "Add Paper to Library"}
          </button>
        </div>
      )}
    </div>
  );
}

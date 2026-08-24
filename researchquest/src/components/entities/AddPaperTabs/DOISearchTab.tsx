import { useRef } from "react";
import { Loader, Search, X, Plus } from "lucide-react";
import type { CrossrefPaper } from "../../../types/database";
import { Tooltip, TooltipTrigger, TooltipContent } from "../../ui/tooltip";

function formatAuthorsLine(authors: string[]) {
  if (authors.length === 0) return "";
  if (authors.length <= 6) return authors.join(", ");
  return `${authors.slice(0, 6).join(", ")}, et al.`;
}

interface DOISearchTabProps {
  doiInput: string;
  setDoiInput: (val: string) => void;
  onSearch: (doi: string) => Promise<void>;
  onAdd: () => Promise<void>;
  loading: boolean;
  isAdding: boolean;
  doiResult: CrossrefPaper | null;
  isValidUrl: (url: string) => boolean;
}

export function DOISearchTab({
  doiInput,
  setDoiInput,
  onSearch,
  onAdd,
  loading,
  isAdding,
  doiResult,
}: DOISearchTabProps) {
  const doiInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-6" role="tabpanel" id="view-panel-doi">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (doiInput.trim()) {
            void onSearch(doiInput);
          }
        }}
      >
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
              placeholder="e.g., 10.1038/nature12373"
              className="w-full px-4 py-3 bg-bg-base border border-border-subtle rounded-lg focus:ring-2 focus:ring-primary-500"
            />
            {doiInput && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => { setDoiInput(""); doiInputRef.current?.focus(); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-tertiary"
                    aria-label="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Clear search</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <button
            type="submit"
            disabled={loading || !doiInput.trim()}
            className="px-6 py-3 bg-primary-500 text-white rounded-lg flex items-center gap-2 hover:bg-primary-600 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? <Loader className="w-5 h-5 animate-spin" aria-hidden="true" /> : <Search className="w-5 h-5" aria-hidden="true" />}
            Search
          </button>
        </div>
      </form>

      {doiResult && (
        <div className="space-y-4">
          <div className="p-6 border-2 border-primary-500 rounded-lg bg-bg-elevated">
            <h3 className="text-lg font-semibold mb-2">{doiResult.title}</h3>
            <p className="text-sm text-text-secondary mb-3">
              {formatAuthorsLine(doiResult.authors)}
            </p>
            {doiResult.abstract && (
              <p className="mt-4 pt-4 border-t text-sm text-text-secondary line-clamp-4">
                {doiResult.abstract}
              </p>
            )}
          </div>
          <button
            onClick={onAdd}
            disabled={loading || isAdding}
            className="w-full py-4 bg-primary-500 text-white rounded-lg font-semibold flex justify-center items-center gap-2 hover:bg-primary-600 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2 disabled:opacity-70 disabled:cursor-not-allowed"
            aria-live="polite"
            aria-atomic="true"
          >
            {isAdding ? (
              <>
                <Loader className="w-6 h-6 animate-spin" aria-hidden="true" />
                Adding Paper...
              </>
            ) : (
              <>
                <Plus className="w-6 h-6" aria-hidden="true" />
                Add Paper to Library
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

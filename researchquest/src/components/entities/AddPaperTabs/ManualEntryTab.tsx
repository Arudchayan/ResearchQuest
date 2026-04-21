import { useRef, useEffect } from "react";
import { Loader, Plus } from "lucide-react";

interface ManualEntryTabProps {
  manualTitle: string;
  setManualTitle: (val: string) => void;
  manualAuthors: string;
  setManualAuthors: (val: string) => void;
  manualDoi: string;
  setManualDoi: (val: string) => void;
  manualUrl: string;
  setManualUrl: (val: string) => void;
  onAdd: () => Promise<void>;
  loading: boolean;
  error: string;
}

export function ManualEntryTab({
  manualTitle,
  setManualTitle,
  manualAuthors,
  setManualAuthors,
  manualDoi,
  setManualDoi,
  manualUrl,
  setManualUrl,
  onAdd,
  loading,
  error,
}: ManualEntryTabProps) {
  const manualTitleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (error === "Title is required") {
      manualTitleInputRef.current?.focus();
    }
  }, [error]);

  return (
    <div className="space-y-6" role="tabpanel" id="view-panel-manual">
      <div className="space-y-4">
        <div>
          <label htmlFor="manual-title" className="block text-sm font-medium mb-1">
            Title <span aria-hidden="true">*</span>
          </label>
          <input
            id="manual-title"
            ref={manualTitleInputRef}
            type="text"
            required
            value={manualTitle}
            onChange={(e) => setManualTitle(e.target.value)}
            className="w-full p-3 bg-bg-base border rounded-lg"
            placeholder="Enter paper title"
          />
        </div>
        <div>
          <label htmlFor="manual-authors" className="block text-sm font-medium mb-1">Authors</label>
          <input
            id="manual-authors"
            type="text"
            value={manualAuthors}
            onChange={(e) => setManualAuthors(e.target.value)}
            className="w-full p-3 bg-bg-base border rounded-lg"
            placeholder="John Doe, Jane Smith"
          />
        </div>
        <div>
          <label htmlFor="manual-doi" className="block text-sm font-medium mb-1">DOI</label>
          <input
            id="manual-doi"
            type="text"
            value={manualDoi}
            onChange={(e) => setManualDoi(e.target.value)}
            className="w-full p-3 bg-bg-base border rounded-lg"
            placeholder="10.1038/nature12373"
          />
        </div>
        <div>
          <label htmlFor="manual-url" className="block text-sm font-medium mb-1">URL</label>
          <input
            id="manual-url"
            type="text"
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
            className="w-full p-3 bg-bg-base border rounded-lg"
            placeholder="https://..."
          />
        </div>
        {error && (
          <div role="alert" className="text-red-500 text-sm">
            {error}
          </div>
        )}
        <button
          type="button"
          onClick={onAdd}
          disabled={loading}
          className="w-full py-4 bg-primary-500 text-white rounded-lg font-semibold flex justify-center items-center gap-2"
        >
          {loading ? (
            <>
              <Loader className="w-6 h-6 animate-spin" />
              Adding Paper...
            </>
          ) : (
            <>
              <Plus className="w-6 h-6" />
              Add Paper
            </>
          )}
        </button>
      </div>
    </div>
  );
}

import { useEffect, useRef } from "react";
import { Loader, Plus } from "lucide-react";

export interface ManualEntryErrors {
  title?: string;
  url?: string;
  doi?: string;
  submit?: string;
}

export const MANUAL_TITLE_MAX_LENGTH = 255;
export const MANUAL_AUTHORS_MAX_LENGTH = 255;
export const MANUAL_DOI_MAX_LENGTH = 500;
export const MANUAL_URL_MAX_LENGTH = 500;

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
  errors: ManualEntryErrors;
  clearFieldError: (field: keyof ManualEntryErrors) => void;
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
  errors,
  clearFieldError,
}: ManualEntryTabProps) {
  const titleRef = useRef<HTMLInputElement>(null);
  const doiRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);

  // Focus the first invalid field so keyboard/screen-reader users land on it.
  useEffect(() => {
    if (errors.title) {
      titleRef.current?.focus();
    } else if (errors.doi) {
      doiRef.current?.focus();
    } else if (errors.url) {
      urlRef.current?.focus();
    }
  }, [errors]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void onAdd();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="manual-title" className="block text-sm font-medium mb-1">Title <span aria-hidden="true">*</span></label>
        <input
          id="manual-title"
          ref={titleRef}
          type="text"
          value={manualTitle}
          onChange={(e) => {
            setManualTitle(e.target.value);
            clearFieldError("title");
          }}
          required
          maxLength={MANUAL_TITLE_MAX_LENGTH}
          aria-invalid={!!errors.title}
          aria-describedby={`manual-title-count${errors.title ? " manual-title-error" : ""}`}
          placeholder="Enter paper title"
          className="w-full px-3 py-2 border rounded-lg bg-bg-base"
        />
        <p id="manual-title-count" aria-live="polite" className="mt-1 text-xs text-text-secondary">
          {manualTitle.length}/{MANUAL_TITLE_MAX_LENGTH}
        </p>
        {errors.title && (
          <p id="manual-title-error" role="alert" className="mt-1 text-sm text-destructive">
            {errors.title}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="manual-authors" className="block text-sm font-medium mb-1">Authors</label>
        <input
          id="manual-authors"
          type="text"
          value={manualAuthors}
          onChange={(e) => {
            setManualAuthors(e.target.value);
            clearFieldError("submit");
          }}
          maxLength={MANUAL_AUTHORS_MAX_LENGTH}
          aria-describedby="manual-authors-count manual-authors-hint"
          placeholder="Doe, John; Smith, Jane"
          className="w-full px-3 py-2 border rounded-lg bg-bg-base"
        />
        <p id="manual-authors-hint" className="mt-1 text-xs text-text-secondary">
          Separate authors with semicolons.
        </p>
        <p id="manual-authors-count" aria-live="polite" className="mt-1 text-xs text-text-secondary">
          {manualAuthors.length}/{MANUAL_AUTHORS_MAX_LENGTH}
        </p>
      </div>

      <div>
        <label htmlFor="manual-doi" className="block text-sm font-medium mb-1">DOI</label>
        <input
          id="manual-doi"
          ref={doiRef}
          type="text"
          value={manualDoi}
          onChange={(e) => {
            setManualDoi(e.target.value);
            clearFieldError("doi");
          }}
          maxLength={MANUAL_DOI_MAX_LENGTH}
          aria-invalid={!!errors.doi}
          aria-describedby={`manual-doi-count${errors.doi ? " manual-doi-error" : ""}`}
          placeholder="e.g., 10.1038/nature12373"
          className="w-full px-3 py-2 border rounded-lg bg-bg-base"
        />
        <p id="manual-doi-count" aria-live="polite" className="mt-1 text-xs text-text-secondary">
          {manualDoi.length}/{MANUAL_DOI_MAX_LENGTH}
        </p>
        {errors.doi && (
          <p id="manual-doi-error" role="alert" className="mt-1 text-sm text-destructive">
            {errors.doi}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="manual-url" className="block text-sm font-medium mb-1">URL</label>
        <input
          id="manual-url"
          ref={urlRef}
          type="text"
          inputMode="url"
          value={manualUrl}
          onChange={(e) => {
            setManualUrl(e.target.value);
            clearFieldError("url");
          }}
          maxLength={MANUAL_URL_MAX_LENGTH}
          aria-invalid={!!errors.url}
          aria-describedby={`manual-url-count${errors.url ? " manual-url-error" : ""}`}
          placeholder="https://example.com/paper"
          className="w-full px-3 py-2 border rounded-lg bg-bg-base"
        />
        <p id="manual-url-count" aria-live="polite" className="mt-1 text-xs text-text-secondary">
          {manualUrl.length}/{MANUAL_URL_MAX_LENGTH}
        </p>
        {errors.url && (
          <p id="manual-url-error" role="alert" className="mt-1 text-sm text-destructive">
            {errors.url}
          </p>
        )}
      </div>

      {errors.submit && (
        <div role="alert" className="p-4 bg-destructive-bg border border-destructive/20 text-destructive rounded-lg">
          {errors.submit}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2 bg-primary-500 text-white rounded-lg flex justify-center items-center gap-2 hover:bg-primary-600 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2 disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <Loader className="w-4 h-4 animate-spin" /> Adding Paper...
          </>
        ) : (
          <>
            <Plus className="w-4 h-4" /> Add Paper
          </>
        )}
      </button>
    </form>
  );
}

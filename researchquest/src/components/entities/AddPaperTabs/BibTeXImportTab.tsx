import { useState } from "react";
import { Upload, AlertCircle, Loader, Plus } from "lucide-react";
import type { BibTeXEntry, BibTeXWarnings } from "../../../utils/bibtexParser";

interface BibTeXImportTabProps {
  onFileSelect: (file: File) => void;
  onImport: () => Promise<void>;
  loading: boolean;
  error: string;
  parsedEntries: BibTeXEntry[];
  selectedEntryIds: Set<string>;
  toggleEntrySelection: (id: string) => void;
  importProgress: { current: number; total: number } | null;
  importStats?: { success: number; failed: number } | null;
  parseWarnings?: BibTeXWarnings | null;
}

export function BibTeXImportTab({
  onFileSelect,
  onImport,
  loading,
  error,
  parsedEntries,
  selectedEntryIds,
  toggleEntrySelection,
  importStats,
  parseWarnings,
}: BibTeXImportTabProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="bibtex-file-upload" className="block text-sm font-medium mb-3">Upload BibTeX File (.bib)</label>
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-6 text-center relative transition-colors ${
            isDragging
              ? "border-primary-500 bg-primary-50 dark:bg-primary-900/10"
              : "border-border-subtle hover:bg-bg-base"
          }`}
        >
          <input
            id="bibtex-file-upload"
            type="file"
            accept=".bib"
            onChange={handleFileInputChange}
            aria-invalid={!!error}
            aria-describedby={error ? "bibtex-error" : undefined}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
          <div className="flex flex-col items-center gap-2 text-text-secondary pointer-events-none">
            <Upload className={`w-8 h-8 ${isDragging ? "text-primary-600" : "text-primary-500"}`} />
            <p className="font-medium">
              {isDragging ? "Drop BibTeX file here" : "Click to upload or drag and drop"}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div
          id="bibtex-error"
          role="alert"
          className="p-4 bg-destructive-bg border border-destructive/20 text-destructive rounded-lg flex items-center gap-2"
        >
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {parseWarnings &&
        (parseWarnings.duplicateKeys.length > 0 || parseWarnings.stringYears.length > 0) && (
          <div
            role="status"
            className="p-4 bg-bg-elevated border border-border-subtle rounded-lg text-sm"
          >
            {parseWarnings.duplicateKeys.length > 0 && (
              <p>
                {parseWarnings.duplicateKeys.length} duplicate entry key(s) renamed (
                {parseWarnings.duplicateKeys.slice(0, 3).join(", ")}
                {parseWarnings.duplicateKeys.length > 3 ? ", …" : ""}) — review before
                importing.
              </p>
            )}
            {parseWarnings.stringYears.length > 0 && (
              <p>
                {parseWarnings.stringYears.length} @string-defined year(s) could not be
                resolved and were left out.
              </p>
            )}
          </div>
        )}

      {importStats && (
        <div
          role="status"
          className="p-4 bg-bg-elevated border border-border-subtle rounded-lg text-sm"
        >
          Imported {importStats.success} of {importStats.success + importStats.failed} entries
          {importStats.failed > 0
            ? ` — ${importStats.failed} failed.`
            : " successfully."}
        </div>
      )}

      {parsedEntries.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            {selectedEntryIds.size} papers selected
          </p>
          <div className="max-h-[400px] overflow-y-auto border rounded-lg divide-y">
            {parsedEntries.map((entry, index) => {
              const hasTitle = Boolean(entry.title?.trim());
              return (
                <div key={`${entry.id}-${index}`} className="p-3 flex items-start gap-3 hover:bg-bg-base">
                  <input
                    id={`bibtex-entry-${entry.id}`}
                    type="checkbox"
                    checked={selectedEntryIds.has(entry.id)}
                    onChange={() => toggleEntrySelection(entry.id)}
                    disabled={!hasTitle}
                    className="mt-1 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <label htmlFor={`bibtex-entry-${entry.id}`} className="flex-1 min-w-0 cursor-pointer">
                    <p className="font-medium truncate">
                      {hasTitle ? entry.title : "Untitled"}
                      {!hasTitle && (
                        <span className="ml-2 inline-block align-middle text-xs font-medium px-2 py-0.5 rounded-full bg-destructive-bg border border-destructive/20 text-destructive">
                          Missing title
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-text-secondary truncate">{entry.authors?.join(", ")}</p>
                  </label>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={onImport}
            disabled={loading || selectedEntryIds.size === 0}
            className="w-full py-2 bg-primary-500 text-white rounded-lg flex justify-center items-center gap-2 hover:bg-primary-600 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Import Selected ({selectedEntryIds.size})
          </button>
        </div>
      )}
    </div>
  );
}

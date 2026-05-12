import { useState } from "react";
import { Upload, AlertCircle, Loader, Plus } from "lucide-react";
import type { BibTeXEntry } from "../../../utils/bibtexParser";

interface BibTeXImportTabProps {
  onFileSelect: (file: File) => void;
  onImport: () => Promise<void>;
  loading: boolean;
  error: string;
  parsedEntries: BibTeXEntry[];
  selectedEntryIds: Set<string>;
  toggleEntrySelection: (id: string) => void;
  importProgress: { current: number; total: number } | null;
}

export function BibTeXImportTab({
  onFileSelect,
  onImport,
  loading,
  error,
  parsedEntries,
  selectedEntryIds,
  toggleEntrySelection,
  importProgress,
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
    <div className="space-y-6" role="tabpanel" id="view-panel-import">
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
          role="alert"
          className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2"
        >
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {parsedEntries.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            {selectedEntryIds.size} papers selected
          </p>
          <div className="max-h-[400px] overflow-y-auto border rounded-lg divide-y">
            {parsedEntries.map((entry) => (
              <div key={entry.id} className="p-3 flex items-start gap-3 hover:bg-bg-base">
                <input
                  type="checkbox"
                  checked={selectedEntryIds.has(entry.id)}
                  onChange={() => toggleEntrySelection(entry.id)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{entry.title || "Untitled"}</p>
                  <p className="text-sm text-text-secondary truncate">{entry.authors?.join(", ")}</p>
                </div>
              </div>
            ))}
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

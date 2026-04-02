import { Upload, AlertCircle, Loader, Plus } from "lucide-react";
import type { BibTeXEntry } from "../../utils/bibtexParser";

interface BibTeXImportTabProps {
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImport: () => Promise<void>;
  loading: boolean;
  error: string;
  parsedEntries: BibTeXEntry[];
  selectedEntryIds: Set<string>;
  toggleEntrySelection: (id: string) => void;
  importProgress: { current: number; total: number } | null;
}

export function BibTeXImportTab({
  onFileChange,
  onImport,
  loading,
  error,
  parsedEntries,
  selectedEntryIds,
  toggleEntrySelection,
  importProgress,
}: BibTeXImportTabProps) {
  return (
    <div className="space-y-6" role="tabpanel" id="view-panel-import">
      <div>
        <label className="block text-sm font-medium mb-3">Upload BibTeX File (.bib)</label>
        <div className="border-2 border-dashed border-border-subtle rounded-lg p-6 text-center hover:bg-bg-base relative">
          <input type="file" accept=".bib" onChange={onFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
          <div className="flex flex-col items-center gap-2 text-text-secondary">
            <Upload className="w-8 h-8 text-primary-500" />
            <p className="font-medium">Click to upload or drag and drop</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {parsedEntries.length > 0 && (
        <div className="space-y-4">
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
            onClick={onImport}
            disabled={loading || selectedEntryIds.size === 0}
            className="w-full py-2 bg-primary-500 text-white rounded-lg flex justify-center items-center gap-2"
          >
            {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Import {selectedEntryIds.size} Selected
          </button>
        </div>
      )}
    </div>
  );
}

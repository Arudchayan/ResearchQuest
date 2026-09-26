import { ArrowLeft, FileText } from "lucide-react";

export function EditorPlaceholder({ onBackToList }: { readonly onBackToList?: () => void }) {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center p-8 text-center">
      {onBackToList && (
        <button
          type="button"
          onClick={onBackToList}
          aria-label="Back to notes list"
          className="absolute left-4 top-4 inline-flex min-h-11 min-w-11 items-center justify-center rounded-control text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2 lg:hidden"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-bg-elevated">
        <FileText className="h-8 w-8 text-text-tertiary" aria-hidden="true" />
      </div>
      <h2 className="text-subtitle font-medium text-text-primary">Select a note</h2>
      <p className="mt-2 max-w-xs text-small text-text-secondary">Choose a note from the list to start editing, or create a new one.</p>
    </div>
  );
}

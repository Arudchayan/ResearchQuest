import { FileText } from "lucide-react";

export function EditorPlaceholder() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-bg-elevated">
        <FileText className="h-8 w-8 text-text-tertiary" aria-hidden="true" />
      </div>
      <h2 className="text-subtitle font-medium text-text-primary">Select a note</h2>
      <p className="mt-2 max-w-xs text-small text-text-secondary">Choose a note from the list to start editing, or create a new one.</p>
    </div>
  );
}

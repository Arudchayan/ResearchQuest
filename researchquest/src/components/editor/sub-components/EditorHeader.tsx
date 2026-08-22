import { AlertCircle, ArrowLeft, Check, Loader2 } from "lucide-react";
import { useState } from "react";
import type { SaveState } from "../hooks/useMarkdownEditor";

interface EditorHeaderProps {
  title: string;
  setTitle: (title: string) => void;
  saveState: SaveState;
  onBackToList?: () => void;
}

export function EditorHeader({ title, setTitle, saveState, onBackToList }: EditorHeaderProps) {
  const [isTitleFocused, setIsTitleFocused] = useState(false);

  return (
    <div className="flex items-center gap-3 border-b border-border-subtle bg-bg-surface px-4 py-3 sm:px-6 sm:py-4">
      {onBackToList && <button type="button" onClick={onBackToList} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2 lg:hidden" aria-label="Back to notes list"><ArrowLeft className="h-4 w-4" /></button>}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onFocus={() => setIsTitleFocused(true)}
        onBlur={() => setIsTitleFocused(false)}
        maxLength={255}
        className="min-w-0 flex-1 border-none bg-transparent font-serif text-subtitle font-semibold text-text-primary outline-none placeholder:text-text-tertiary sm:text-title"
        placeholder="Enter title..."
        aria-label="Note title"
      />
      <div className="flex items-center gap-3">
        {isTitleFocused && (
          <span className="text-xs text-text-tertiary animate-in fade-in duration-200">
            {title.length}/255
          </span>
        )}
        <SaveStatus saveState={saveState} />
      </div>
    </div>
  );
}

function SaveStatus({ saveState }: { readonly saveState: SaveState }) {
  switch (saveState) {
    case "saving": return <div className="flex items-center gap-2 text-caption text-text-tertiary" role="status" aria-live="polite"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /><span>Saving</span></div>;
    case "saved": return <div className="flex items-center gap-2 text-caption text-success" role="status" aria-live="polite"><Check className="h-4 w-4" aria-hidden="true" /><span>Saved</span></div>;
    case "error": return <div className="flex items-center gap-2 text-caption text-destructive" role="alert"><AlertCircle className="h-4 w-4" aria-hidden="true" /><span>Couldn’t save</span></div>;
  }
}

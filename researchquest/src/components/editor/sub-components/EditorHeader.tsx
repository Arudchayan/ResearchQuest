import { Save } from "lucide-react";
import { useState } from "react";

interface EditorHeaderProps {
  title: string;
  setTitle: (title: string) => void;
  saving: boolean;
}

export function EditorHeader({ title, setTitle, saving }: EditorHeaderProps) {
  const [isTitleFocused, setIsTitleFocused] = useState(false);

  return (
    <div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-6 py-4">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onFocus={() => setIsTitleFocused(true)}
        onBlur={() => setIsTitleFocused(false)}
        maxLength={255}
        className="min-w-0 flex-1 rounded-lg bg-transparent font-serif text-lg font-semibold text-text-primary outline-none placeholder:text-text-tertiary focus:bg-bg-elevated/60 focus:px-2 transition-all"
        placeholder="Enter title..."
        aria-label="Note title"
      />
      <div className="flex shrink-0 items-center gap-3">
        {isTitleFocused && (
          <span className="text-caption text-text-tertiary animate-in fade-in duration-200">
            {title.length}/255
          </span>
        )}
        {saving && (
          <div className="status-chip bg-accent-soft text-accent-strong">
            <Save className="h-3.5 w-3.5 animate-pulse" aria-hidden="true" />
            <span>Saving...</span>
          </div>
        )}
      </div>
    </div>
  );
}

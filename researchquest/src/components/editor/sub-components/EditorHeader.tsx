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
    <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between bg-bg-surface">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onFocus={() => setIsTitleFocused(true)}
        onBlur={() => setIsTitleFocused(false)}
        maxLength={255}
        className="flex-1 text-title font-semibold bg-transparent border-none outline-none text-text-primary placeholder-text-tertiary"
        placeholder="Enter title..."
        aria-label="Note title"
      />
      <div className="flex items-center gap-3">
        {isTitleFocused && (
          <span className="text-xs text-text-tertiary animate-in fade-in duration-200">
            {title.length}/255
          </span>
        )}
        {saving && (
          <div className="flex items-center gap-2 text-small text-text-tertiary">
            <Save className="w-4 h-4 animate-pulse" />
            <span>Saving...</span>
          </div>
        )}
      </div>
    </div>
  );
}

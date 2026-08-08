import { AlignLeft, Clock, Sparkles } from "lucide-react";

interface EditorFooterProps {
  wordCount: number;
  readingTime: string;
}

export function EditorFooter({ wordCount, readingTime }: EditorFooterProps) {
  return (
    <div className="flex items-center justify-between border-t border-border-subtle bg-bg-surface px-6 py-3 text-caption text-text-tertiary">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-bg-elevated/70 px-2.5 py-1.5" title="Word count">
          <AlignLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{wordCount} words</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-bg-elevated/70 px-2.5 py-1.5" title="Estimated reading time">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{readingTime}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 hidden sm:flex">
        <Sparkles className="h-3.5 w-3.5 text-accent-strong" aria-hidden="true" />
        <span>Markdown supported. Use Ctrl/Cmd shortcuts.</span>
      </div>
    </div>
  );
}

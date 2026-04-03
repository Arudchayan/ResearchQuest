import { AlignLeft, Clock, Sparkles } from "lucide-react";

interface EditorFooterProps {
  wordCount: number;
  readingTime: string;
}

export function EditorFooter({ wordCount, readingTime }: EditorFooterProps) {
  return (
    <div className="px-6 py-4 border-t border-border-subtle bg-bg-surface text-caption text-text-tertiary flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5" title="Word count">
          <AlignLeft className="w-4 h-4" />
          <span>{wordCount} words</span>
        </div>
        <div className="flex items-center gap-1.5" title="Estimated reading time">
          <Clock className="w-4 h-4" />
          <span>{readingTime}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 hidden sm:flex">
        <Sparkles className="w-4 h-4" />
        <span>Markdown supported. Use Ctrl/Cmd shortcuts.</span>
      </div>
    </div>
  );
}

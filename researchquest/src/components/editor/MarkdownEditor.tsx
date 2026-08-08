import { useEffect, useCallback, useRef, useState, lazy, Suspense } from "react";
import type { EditorView } from "@codemirror/view";
import { FileText } from "lucide-react";
import { CitationPicker } from "./CitationPicker";
import { TopicSelector } from "../topics/TopicSelector";

// Hooks
import { useMarkdownEditor } from "./hooks/useMarkdownEditor";
import { useFormatting } from "./hooks/useFormatting";
import { useEditorActions } from "./hooks/useEditorActions";
import { useLinkDialog } from "./hooks/useLinkDialog";

// Sub-components
import { EditorHeader } from "./sub-components/EditorHeader";
import { EditorToolbar } from "./sub-components/EditorToolbar";
import { EditorFooter } from "./sub-components/EditorFooter";
import { LinkDialog } from "./sub-components/LinkDialog";

const LazyEditorContent = lazy(() => import("./sub-components/EditorContent"));

function EditorSkeleton() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg-surface animate-pulse p-6 space-y-3">
      <div className="shimmer h-5 bg-bg-muted rounded-lg w-3/4" />
      <div className="h-5 bg-bg-muted rounded-lg w-1/2" />
      <div className="h-5 bg-bg-muted rounded-lg w-5/6" />
      <div className="h-5 bg-bg-muted rounded-lg w-2/3" />
      <div className="h-5 bg-bg-muted rounded-lg w-3/4" />
    </div>
  );
}

export function MarkdownEditor() {
  const editorViewRef = useRef<EditorView | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [citationPickerOpen, setCitationPickerOpen] = useState(false);

  const {
    selectedNote,
    content,
    setContent,
    title,
    setTitle,
    debouncedContent,
    viewMode,
    setViewMode,
    saving,
    setSaving,
    wordCount,
    readingTime,
    effectiveTheme,
    isZenMode,
    toggleZenMode,
    updateNote,
    userId,
  } = useMarkdownEditor();

  const { applyFormatting, handleCitationSelect } = useFormatting(editorViewRef);
  const { linkDialogOpen, openLinkDialog, closeLinkDialog, handleLinkSubmit, linkTextValue, setLinkTextValue, linkUrlValue, setLinkUrlValue, linkError, linkUrlInputRef } = useLinkDialog(editorViewRef);
  const { handleCopyMarkdown, handleCopyRichText, handleExport, handlePrint, saveNote } = useEditorActions(content, title, previewRef, selectedNote, userId, updateNote, setSaving);

  // Auto-save
  useEffect(() => {
    if (!selectedNote || !userId) return;
    const timer = setTimeout(() => { void saveNote(); }, 1000);
    return () => clearTimeout(timer);
  }, [content, title, selectedNote, userId, saveNote]);

  const handleGlobalKeyDown = useCallback((event: KeyboardEvent) => {
    if (!(event.metaKey || event.ctrlKey) || !event.shiftKey || linkDialogOpen) return;
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;

    const key = event.key.toLowerCase();
    if (key === "e") { setViewMode("edit"); event.preventDefault(); }
    else if (key === "p") { setViewMode("preview"); event.preventDefault(); }
    else if (key === "s") { setViewMode("split"); event.preventDefault(); }
    else if (key === "f") { toggleZenMode(); event.preventDefault(); }
  }, [linkDialogOpen, toggleZenMode, setViewMode]);

  useEffect(() => {
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [handleGlobalKeyDown]);

  if (!selectedNote) {
    return (
      <div className="h-screen-dynamic flex items-center justify-center bg-bg-base">
        <div className="animate-rise surface-card flex flex-col items-center px-8 py-10 text-center">
          <span className="icon-tile h-14 w-14 rounded-2xl bg-blue-soft text-blue-strong">
            <FileText className="h-7 w-7" aria-hidden="true" />
          </span>
          <p className="mt-4 max-w-xs text-body text-text-secondary">
            Select a note or create a new one to start editing
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen-dynamic flex flex-col bg-bg-base">
      <EditorHeader title={title} setTitle={setTitle} saving={saving} />

      <EditorToolbar
        applyFormatting={applyFormatting}
        handleCopyMarkdown={handleCopyMarkdown}
        handleCopyRichText={handleCopyRichText}
        openLinkDialog={openLinkDialog}
        setCitationPickerOpen={setCitationPickerOpen}
        handleExport={handleExport}
        handlePrint={handlePrint}
        isZenMode={isZenMode}
        toggleZenMode={toggleZenMode}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />

      <div className="border-b border-border-subtle bg-bg-surface px-6 py-4">
        <TopicSelector entityId={selectedNote.id} entityType="note" />
      </div>

      <Suspense fallback={<EditorSkeleton />}>
        <LazyEditorContent
          content={content}
          setContent={setContent}
          debouncedContent={debouncedContent}
          viewMode={viewMode}
          effectiveTheme={effectiveTheme}
          editorViewRef={editorViewRef}
          previewRef={previewRef}
          applyFormatting={applyFormatting}
          openLinkDialog={openLinkDialog}
          setCitationPickerOpen={setCitationPickerOpen}
          setViewMode={setViewMode}
          toggleZenMode={toggleZenMode}
        />
      </Suspense>

      <EditorFooter wordCount={wordCount} readingTime={readingTime} />

      <LinkDialog
        isOpen={linkDialogOpen}
        onClose={closeLinkDialog}
        onSubmit={handleLinkSubmit}
        linkText={linkTextValue}
        setLinkText={setLinkTextValue}
        linkUrl={linkUrlValue}
        setLinkUrl={setLinkUrlValue}
        error={linkError}
        inputRef={linkUrlInputRef}
      />

      {citationPickerOpen && (
        <CitationPicker
          open={citationPickerOpen}
          onOpenChange={setCitationPickerOpen}
          onSelect={(c) => handleCitationSelect(c, setCitationPickerOpen)}
        />
      )}
    </div>
  );
}

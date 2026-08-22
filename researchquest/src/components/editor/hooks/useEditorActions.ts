import { useCallback } from "react";
import type { RefObject } from "react";
import { toast } from "sonner";
import DOMPurify from "dompurify";
import { NOTE_BODY_MAX_LENGTH } from "../../../hooks/useNotes";
import { useAppStore } from "../../../store/appStore";
import { downloadFile } from "../../../utils/export";
import type { Note } from "../../../types/database";
import type { SaveState } from "./useMarkdownEditor";

interface EditorActionOptions {
  readonly content: string;
  readonly title: string;
  readonly previewRef: RefObject<HTMLDivElement | null>;
  readonly selectedNote: Note | null;
  readonly userId: string | undefined;
  readonly updateNote: (noteId: string, updates: Partial<Note>) => Promise<boolean>;
  readonly setSaveState: (saveState: SaveState) => void;
}

export function useEditorActions({ content, title, previewRef, selectedNote, userId, updateNote, setSaveState }: EditorActionOptions) {
  const handleCopyMarkdown = useCallback(() => {
    if (!content) return;
    navigator.clipboard.writeText(content).then(() => {
      toast.success("Markdown copied to clipboard");
    }).catch(() => {
      toast.error("Failed to copy Markdown");
    });
  }, [content]);

  const handleCopyRichText = useCallback(() => {
    const previewElement = previewRef.current;
    if (!previewElement) {
      toast.error("Preview must be visible to copy rich text");
      return;
    }

    const html = DOMPurify.sanitize(previewElement.innerHTML);
    const text = previewElement.innerText;

    try {
      const clipboardItem = new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([text], { type: "text/plain" }),
      });
      navigator.clipboard.write([clipboardItem]).then(() => {
        toast.success("Rich text copied to clipboard");
      }).catch(() => {
        toast.error("Failed to copy rich text");
      });
    } catch (err) {
      navigator.clipboard.writeText(text).then(() => {
        toast.success("Plain text copied (Rich text not supported by browser)");
      }).catch(() => {
        toast.error("Failed to copy text");
      });
    }
  }, [previewRef]);

  const handleExport = useCallback(() => {
    if (!content) return;

    const exportTitle = title.trim() || "Untitled Note";
    const safeTitle = exportTitle
      .replace(/[^a-z0-9\s-_]/gi, "")
      .replace(/\s+/g, "_");
    const filename = `${safeTitle || "note"}.md`;

    downloadFile(content, filename, "text/markdown;charset=utf-8");
  }, [content, title]);

  const handlePrint = useCallback(() => {
    const previewElement = previewRef.current;
    if (!previewElement) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to print.");
      return;
    }

    const htmlContent = DOMPurify.sanitize(previewElement.innerHTML);
    const rawTitle = title || "Untitled Note";
    const documentTitle = rawTitle
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${documentTitle}</title>
          <style>
            body { font-family: sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 2rem; }
            h1, h2, h3 { margin-top: 24px; margin-bottom: 16px; font-weight: 600; }
            h1 { font-size: 2em; border-bottom: 1px solid #eaecef; }
            pre { padding: 16px; background-color: #f6f8fa; border-radius: 3px; }
            @media print { body { padding: 0; margin: 1cm; } }
          </style>
        </head>
        <body>
          <h1>${documentTitle}</h1>
          <div class="markdown-body">${htmlContent}</div>
          <script>window.onload = function() { window.print(); window.close(); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }, [title, previewRef]);

  const saveNote = useCallback(async () => {
    if (!selectedNote || !userId) return;

    if (content.length > NOTE_BODY_MAX_LENGTH) {
      toast.error(`Note content exceeds ${NOTE_BODY_MAX_LENGTH.toLocaleString()} characters`);
      setSaveState("error");
      return;
    }

    const noteId = selectedNote.id;
    setSaveState("saving");
    try {
      const tagMatches = content.match(/#(\w+)/g);
      const tags = tagMatches
        ? [...new Set(tagMatches.map((tag) => tag.slice(1)))]
        : [];

      const updates: Partial<Note> = { markdown_body: content, tags };
      const trimmedTitle = title.trim();
      if (trimmedTitle) {
        updates.title = trimmedTitle;
      }

      const didSave = await updateNote(noteId, updates);
      if (useAppStore.getState().selectedNote?.id === noteId) {
        setSaveState(didSave ? "saved" : "error");
      }
    } catch {
      if (useAppStore.getState().selectedNote?.id === noteId) {
        setSaveState("error");
      }
    }
  }, [selectedNote, userId, content, title, updateNote, setSaveState]);

  return {
    handleCopyMarkdown,
    handleCopyRichText,
    handleExport,
    handlePrint,
    saveNote,
  };
}

import { useCallback } from "react";
import { toast } from "sonner";
import DOMPurify from "dompurify";
import { NOTE_BODY_MAX_LENGTH } from "../../../hooks/useNotes";

export function useEditorActions(
  content: string,
  title: string,
  previewRef: React.RefObject<HTMLDivElement>,
  selectedNote: any,
  userId: string | undefined,
  updateNote: any,
  setSaving: (saving: boolean) => void,
) {
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

    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title></title>
          <style>
            body { font-family: sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 2rem; }
            h1, h2, h3 { margin-top: 24px; margin-bottom: 16px; font-weight: 600; }
            h1 { font-size: 2em; border-bottom: 1px solid #eaecef; }
            pre { padding: 16px; background-color: #f6f8fa; border-radius: 3px; }
            @media print { body { padding: 0; margin: 1cm; } }
          </style>
        </head>
        <body>
          <h1 id="print-title"></h1>
          <div class="markdown-body" id="print-content"></div>
          <script>window.onload = function() { window.print(); window.close(); };</script>
        </body>
      </html>
    `);

    printWindow.document.title = rawTitle;
    const printTitleEl = printWindow.document.getElementById("print-title");
    if (printTitleEl) {
      printTitleEl.textContent = rawTitle;
    }

    const printContentEl = printWindow.document.getElementById("print-content");
    if (printContentEl) {
      printContentEl.innerHTML = htmlContent;
    }

    printWindow.document.close();
  }, [title, previewRef]);

  const saveNote = useCallback(async () => {
    if (!selectedNote || !userId) return;

    if (content.length > NOTE_BODY_MAX_LENGTH) {
      toast.error(`Note content exceeds ${NOTE_BODY_MAX_LENGTH.toLocaleString()} characters`);
      return;
    }

    setSaving(true);
    try {
      const tagMatches = content.match(/#(\w+)/g);
      const tags = tagMatches
        ? [...new Set(tagMatches.map((tag) => tag.slice(1)))]
        : [];

      const trimmedTitle = title.trim();
      const persistedTitle = trimmedTitle.length > 0 ? trimmedTitle : null;

      await updateNote(selectedNote.id, {
        title: persistedTitle,
        markdown_body: content,
        tags,
      });
    } catch (err) {
      // Error handled by updateNote
    } finally {
      setSaving(false);
    }
  }, [selectedNote, userId, content, title, updateNote, setSaving]);

  return {
    handleCopyMarkdown,
    handleCopyRichText,
    handleExport,
    handlePrint,
    saveNote,
  };
}

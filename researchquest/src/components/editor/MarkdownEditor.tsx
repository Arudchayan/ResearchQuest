import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { EditorView, keymap } from "@codemirror/view";
import { githubLight, githubDark } from "@uiw/codemirror-theme-github";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import rehypeHighlight from "rehype-highlight";
import {
  Bold,
  Italic,
  Code,
  List,
  Link2,
  Save,
  Columns,
  Eye,
  Pencil,
  Sparkles,
  Download,
  AlignLeft,
  Clock,
  Printer,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../../store/appStore";
import { TopicSelector } from "../topics/TopicSelector";
import { isValidUrl } from "../../utils/security";
import { countWords } from "../../utils/text";
import { useNotes } from "../../hooks/useNotes";

type ViewMode = "split" | "edit" | "preview";

const VIEW_OPTIONS: {
  id: ViewMode;
  label: string;
  icon: typeof Pencil;
  description: string;
  shortcut: string;
}[] = [
  {
    id: "edit",
    label: "Edit",
    icon: Pencil,
    description: "Focus on writing without the preview pane",
    shortcut: "Shift+Ctrl/Cmd+E",
  },
  {
    id: "split",
    label: "Split",
    icon: Columns,
    description: "See editor and preview side-by-side",
    shortcut: "Shift+Ctrl/Cmd+S",
  },
  {
    id: "preview",
    label: "Preview",
    icon: Eye,
    description: "Review formatted output in full width",
    shortcut: "Shift+Ctrl/Cmd+P",
  },
];

export function MarkdownEditor() {
  const { selectedNote, setSelectedNote, effectiveTheme, user, isZenMode, toggleZenMode } = useAppStore(
    useShallow((state) => ({
      selectedNote: state.selectedNote,
      setSelectedNote: state.setSelectedNote,
      effectiveTheme: state.effectiveTheme,
      user: state.user,
      isZenMode: state.isZenMode,
      toggleZenMode: state.toggleZenMode,
    })),
  );

  const userId = user?.id;
  const { updateNote } = useNotes(userId);

  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [isTitleFocused, setIsTitleFocused] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const editorViewRef = useRef<EditorView | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [pendingLinkRange, setPendingLinkRange] = useState<{
    from: number;
    to: number;
  } | null>(null);
  const [linkTextValue, setLinkTextValue] = useState("");
  const [linkUrlValue, setLinkUrlValue] = useState("");
  const linkUrlInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Memoize word count and reading time to avoid recalculation on every render
  const wordCount = useMemo(() => countWords(content), [content]);
  const readingTime = useMemo(() => {
    const wordsPerMinute = 200;
    const minutes = Math.ceil(wordCount / wordsPerMinute);
    if (wordCount === 0) return "0 min read";
    if (minutes <= 1) return "1 min read";
    return `${minutes} min read`;
  }, [wordCount]);

  useEffect(() => {
    return () => {
      editorViewRef.current = null;
    };
  }, []);

  const closeLinkDialog = useCallback(() => {
    setLinkDialogOpen(false);
    setPendingLinkRange(null);
    setLinkTextValue("");
    setLinkUrlValue("");
    setLinkError(null);
  }, []);

  useEffect(() => {
    if (!linkDialogOpen) {
      return;
    }

    setLinkError(null);
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => {
      linkUrlInputRef.current?.focus();
    });

    return () => {
      document.body.style.overflow = "unset";
      cancelAnimationFrame(frame);
    };
  }, [linkDialogOpen]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && linkDialogOpen) {
        event.preventDefault();
        closeLinkDialog();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [closeLinkDialog, linkDialogOpen]);

  // Load selected note
  useEffect(() => {
    if (selectedNote) {
      setContent(selectedNote.markdown_body);
      setTitle(selectedNote.title || "");
    } else {
      setContent("");
      setTitle("");
    }
  }, [selectedNote]);

  const openLinkDialog = useCallback(() => {
    const view = editorViewRef.current;
    if (!view) return;

    const { state } = view;
    const { from, to } = state.selection.main;
    const selectedText = state.sliceDoc(from, to);

    setPendingLinkRange({ from, to });
    setLinkTextValue(selectedText);
    setLinkUrlValue("");
    setLinkError(null);
    setLinkDialogOpen(true);
  }, []);

  const applyWrappedFormatting = useCallback(
    (startWrapper: string, endWrapper: string, placeholder: string) => {
      const view = editorViewRef.current;
      if (!view) return;

      const { state } = view;
      const { from, to } = state.selection.main;
      const selectedText = state.sliceDoc(from, to);
      const hasSelection = from !== to;
      const alreadyWrapped =
        hasSelection &&
        selectedText.startsWith(startWrapper) &&
        selectedText.endsWith(endWrapper) &&
        selectedText.length >= startWrapper.length + endWrapper.length;

      if (alreadyWrapped) {
        const unwrapped = selectedText.slice(
          startWrapper.length,
          selectedText.length - endWrapper.length,
        );
        view.dispatch({
          changes: { from, to, insert: unwrapped },
          selection: { anchor: from, head: from + unwrapped.length },
          scrollIntoView: true,
        });
        view.focus();
        return;
      }

      const text =
        hasSelection && selectedText.length > 0 ? selectedText : placeholder;
      const insert = `${startWrapper}${text}${endWrapper}`;
      const anchor = from + startWrapper.length;
      const head = anchor + text.length;

      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor, head },
        scrollIntoView: true,
      });
      view.focus();
    },
    [],
  );

  const applyListFormatting = useCallback(() => {
    const view = editorViewRef.current;
    if (!view) return;

    const { state } = view;
    const [range] = state.selection.ranges;

    if (state.selection.ranges.length === 1 && range.from === range.to) {
      const line = state.doc.lineAt(range.from);
      const prefix = line.text.startsWith("- ") ? "" : "- ";

      if (prefix) {
        view.dispatch({
          changes: { from: line.from, to: line.from, insert: prefix },
          selection: {
            anchor: range.from + prefix.length,
            head: range.from + prefix.length,
          },
          scrollIntoView: true,
        });
      }
      view.focus();
      return;
    }

    const lineNumbers = new Set<number>();
    state.selection.ranges.forEach((currentRange) => {
      let line = state.doc.lineAt(currentRange.from);
      lineNumbers.add(line.number);

      while (line.to < currentRange.to) {
        line = state.doc.line(line.number + 1);
        lineNumbers.add(line.number);
      }
    });

    const changes = Array.from(lineNumbers)
      .map((lineNumber) => state.doc.line(lineNumber))
      .filter((line) => !/^(?:[-*] |\d+\. )/.test(line.text.trimStart()))
      .map((line) => ({ from: line.from, to: line.from, insert: "- " }))
      .sort((a, b) => a.from - b.from);

    if (changes.length > 0) {
      view.dispatch({ changes, scrollIntoView: true });
    }

    view.focus();
  }, []);

  const applyFormatting = useCallback(
    (format: "bold" | "italic" | "code" | "list") => {
      switch (format) {
        case "bold":
          applyWrappedFormatting("**", "**", "bold text");
          break;
        case "italic":
          applyWrappedFormatting("*", "*", "italic text");
          break;
        case "code":
          applyWrappedFormatting("`", "`", "code");
          break;
        case "list":
          applyListFormatting();
          break;
      }
    },
    [applyListFormatting, applyWrappedFormatting],
  );

  const handleExport = useCallback(() => {
    if (!content) return;

    const exportTitle = title.trim() || "Untitled Note";
    // Sanitize filename: replace non-alphanumeric chars with underscore, keep nice format
    const safeTitle = exportTitle.replace(/[^a-z0-9\s-_]/gi, "").replace(/\s+/g, "_");
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
    if (!previewElement) {
      // Should not happen if the component structure is correct
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to print.");
      return;
    }

    const htmlContent = previewElement.innerHTML;
    const rawTitle = title || "Untitled Note";
    // Basic HTML escaping to prevent XSS in the new window title
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
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 800px;
              margin: 0 auto;
              padding: 2rem;
            }
            h1, h2, h3, h4, h5, h6 {
              margin-top: 24px;
              margin-bottom: 16px;
              font-weight: 600;
              line-height: 1.25;
            }
            h1 { font-size: 2em; padding-bottom: 0.3em; border-bottom: 1px solid #eaecef; }
            h2 { font-size: 1.5em; padding-bottom: 0.3em; border-bottom: 1px solid #eaecef; }
            p { margin-top: 0; margin-bottom: 16px; }
            blockquote {
              padding: 0 1em;
              color: #6a737d;
              border-left: 0.25em solid #dfe2e5;
              margin: 0 0 16px 0;
            }
            ul, ol { padding-left: 2em; margin-bottom: 16px; }
            li { margin: 0.25em 0; }
            code {
              padding: 0.2em 0.4em;
              margin: 0;
              font-size: 85%;
              background-color: rgba(27,31,35,0.05);
              border-radius: 3px;
              font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
            }
            pre {
              padding: 16px;
              overflow: auto;
              font-size: 85%;
              line-height: 1.45;
              background-color: #f6f8fa;
              border-radius: 3px;
              margin-bottom: 16px;
            }
            pre code {
              background-color: transparent;
              padding: 0;
            }
            img {
              max-width: 100%;
              box-sizing: border-box;
            }
            table {
              border-collapse: collapse;
              width: 100%;
              margin-bottom: 16px;
            }
            table th, table td {
              padding: 6px 13px;
              border: 1px solid #dfe2e5;
            }
            table tr {
              background-color: #fff;
              border-top: 1px solid #c6cbd1;
            }
            table tr:nth-child(2n) {
              background-color: #f6f8fa;
            }
            a { color: #0366d6; text-decoration: none; }
            a:hover { text-decoration: underline; }
            hr {
              height: 0.25em;
              padding: 0;
              margin: 24px 0;
              background-color: #e1e4e8;
              border: 0;
            }
            @media print {
              body { padding: 0; margin: 1cm; }
              a { text-decoration: none; color: #000; }
            }
          </style>
        </head>
        <body>
          <h1>${documentTitle}</h1>
          <div class="markdown-body">
            ${htmlContent}
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }, [title]);

  const handleLinkSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!pendingLinkRange) return;

      const url = linkUrlValue.trim();
      const text = linkTextValue.trim();

      if (!url) {
        setLinkError("Link URL is required");
        return;
      }

      if (!isValidUrl(url)) {
        setLinkError(
          "Invalid URL protocol. Only http, https, and mailto are allowed.",
        );
        return;
      }

      const view = editorViewRef.current;
      if (!view) {
        closeLinkDialog();
        return;
      }

      const safeText = text.length > 0 ? text : url;
      const insert = `[${safeText}](${url})`;
      const anchor = pendingLinkRange.from + 1;
      const head = anchor + safeText.length;

      view.dispatch({
        changes: {
          from: pendingLinkRange.from,
          to: pendingLinkRange.to,
          insert,
        },
        selection: { anchor, head },
        scrollIntoView: true,
      });
      view.focus();
      closeLinkDialog();
    },
    [closeLinkDialog, linkTextValue, linkUrlValue, pendingLinkRange],
  );

  const formattingExtensions = useMemo(
    () => [
      keymap.of([
        {
          key: "Mod-b",
          preventDefault: true,
          run: () => {
            applyFormatting("bold");
            return true;
          },
        },
        {
          key: "Mod-i",
          preventDefault: true,
          run: () => {
            applyFormatting("italic");
            return true;
          },
        },
        {
          key: "Mod-Shift-c",
          preventDefault: true,
          run: () => {
            applyFormatting("code");
            return true;
          },
        },
        {
          key: "Mod-Shift-l",
          preventDefault: true,
          run: () => {
            applyFormatting("list");
            return true;
          },
        },
        {
          key: "Mod-k",
          preventDefault: true,
          run: () => {
            openLinkDialog();
            return true;
          },
        },
        {
          key: "Mod-Shift-e",
          preventDefault: true,
          run: () => {
            setViewMode("edit");
            return true;
          },
        },
        {
          key: "Mod-Shift-s",
          preventDefault: true,
          run: () => {
            setViewMode("split");
            return true;
          },
        },
        {
          key: "Mod-Shift-p",
          preventDefault: true,
          run: () => {
            setViewMode("preview");
            return true;
          },
        },
        {
          key: "Mod-Shift-f",
          preventDefault: true,
          run: () => {
            toggleZenMode();
            return true;
          },
        },
      ]),
    ],
    [applyFormatting, openLinkDialog, toggleZenMode],
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (
        !(event.metaKey || event.ctrlKey) ||
        !event.shiftKey ||
        linkDialogOpen
      ) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "e") {
        setViewMode("edit");
        event.preventDefault();
      } else if (key === "p") {
        setViewMode("preview");
        event.preventDefault();
      } else if (key === "s") {
        setViewMode("split");
        event.preventDefault();
      } else if (key === "f") {
        toggleZenMode();
        event.preventDefault();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [linkDialogOpen, toggleZenMode]);

  const saveNote = useCallback(async () => {
    if (!selectedNote || !userId) return;

    setSaving(true);

    try {
      // Extract tags from content (words starting with #)
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
      // updateNote handles standard errors and toasts.
      // If a non-standard error occurs (exception), we should ideally log it safely
      // but without leaking. For now, we avoid console.error(err)
      // or use a safe logger if imported. Given we are Sentinel,
      // preventing the leak is priority.
    } finally {
      setSaving(false);
    }
  }, [selectedNote, userId, content, title, updateNote]);

  // Auto-save with debounce
  useEffect(() => {
    if (!selectedNote || !userId) return;

    const timer = setTimeout(() => {
      void saveNote();
    }, 1000);

    return () => clearTimeout(timer);
  }, [content, title, selectedNote, userId, saveNote]);

  if (!selectedNote) {
    return (
      <div className="h-screen-dynamic flex items-center justify-center bg-bg-base">
        <div className="text-center text-text-tertiary">
          <p className="text-body">
            Select a note or create a new one to start editing
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen-dynamic flex flex-col bg-bg-base">
      {/* Title Input */}
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

      {/* Toolbar */}
      <div className="px-6 py-3 bg-bg-elevated border-b border-border-subtle flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => applyFormatting("bold")}
            className="p-2 rounded-md transition-colors hover:bg-bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
            aria-label="Bold (Ctrl/Cmd+B)"
            title="Bold (Ctrl/Cmd+B)"
          >
            <Bold className="w-4 h-4 text-text-secondary" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => applyFormatting("italic")}
            className="p-2 rounded-md transition-colors hover:bg-bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
            aria-label="Italic (Ctrl/Cmd+I)"
            title="Italic (Ctrl/Cmd+I)"
          >
            <Italic
              className="w-4 h-4 text-text-secondary"
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            onClick={() => applyFormatting("code")}
            className="p-2 rounded-md transition-colors hover:bg-bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
            aria-label="Inline code (Ctrl/Cmd+Shift+C)"
            title="Inline code (Ctrl/Cmd+Shift+C)"
          >
            <Code className="w-4 h-4 text-text-secondary" aria-hidden="true" />
          </button>
          <div className="w-px h-6 bg-border-subtle mx-1" aria-hidden="true" />
          <button
            type="button"
            onClick={() => applyFormatting("list")}
            className="p-2 rounded-md transition-colors hover:bg-bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
            aria-label="Bulleted list (Ctrl/Cmd+Shift+L)"
            title="Bulleted list (Ctrl/Cmd+Shift+L)"
          >
            <List className="w-4 h-4 text-text-secondary" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={openLinkDialog}
            className="p-2 rounded-md transition-colors hover:bg-bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
            aria-label="Insert link (Ctrl/Cmd+K)"
            title="Insert link (Ctrl/Cmd+K)"
          >
            <Link2 className="w-4 h-4 text-text-secondary" aria-hidden="true" />
          </button>
          <div className="w-px h-6 bg-border-subtle mx-1" aria-hidden="true" />
          <button
            type="button"
            onClick={handleExport}
            className="p-2 rounded-md transition-colors hover:bg-bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
            aria-label="Export to Markdown"
            title="Export to Markdown"
          >
            <Download className="w-4 h-4 text-text-secondary" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="p-2 rounded-md transition-colors hover:bg-bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
            aria-label="Print Note"
            title="Print Note"
          >
            <Printer className="w-4 h-4 text-text-secondary" aria-hidden="true" />
          </button>
          <div className="w-px h-6 bg-border-subtle mx-1" aria-hidden="true" />
          <button
            type="button"
            onClick={toggleZenMode}
            className={`p-2 rounded-md transition-colors hover:bg-bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 ${
              isZenMode ? "bg-primary-500/10 text-primary-500" : ""
            }`}
            aria-label={isZenMode ? "Exit Zen Mode" : "Enter Zen Mode (Ctrl/Cmd+Shift+F)"}
            title={isZenMode ? "Exit Zen Mode" : "Enter Zen Mode (Ctrl/Cmd+Shift+F)"}
          >
            {isZenMode ? (
              <Minimize2 className="w-4 h-4 text-text-secondary" aria-hidden="true" />
            ) : (
              <Maximize2 className="w-4 h-4 text-text-secondary" aria-hidden="true" />
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span
            className="text-caption text-text-tertiary hidden xl:inline"
            aria-hidden="true"
          >
            Layout
          </span>
          <div
            className="inline-flex rounded-md border border-border-subtle overflow-hidden"
            role="radiogroup"
            aria-label="Toggle editor layout"
          >
            {VIEW_OPTIONS.map(({ id, label, icon: OptionIcon, shortcut }) => {
              const isActive = viewMode === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  onClick={() => setViewMode(id)}
                  className={`flex items-center gap-2 px-3 py-2 text-small transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 ${
                    isActive
                      ? "bg-primary-500 text-white"
                      : "text-text-secondary hover:text-text-primary hover:bg-bg-surface"
                  }`}
                  title={`${label} (${shortcut})`}
                >
                  <OptionIcon className="w-4 h-4" aria-hidden="true" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="px-6 py-4 border-b border-border-subtle bg-bg-surface">
        <TopicSelector entityId={selectedNote.id} entityType="note" />
      </div>

      <div
        className={`flex-1 flex overflow-hidden ${viewMode === "split" ? "flex-col lg:flex-row" : "flex-col"}`}
      >
        <div
          className={`${viewMode === "split" ? "lg:w-3/5" : "w-full"} ${viewMode === "preview" ? "hidden" : "block"} h-full bg-bg-surface border-b border-border-subtle lg:border-b-0`}
        >
          <div className="h-full overflow-auto">
            <CodeMirror
              value={content}
              height="100%"
              theme={effectiveTheme === "dark" ? githubDark : githubLight}
              extensions={[
                markdown(),
                EditorView.lineWrapping,
                ...formattingExtensions,
              ]}
              onChange={(value) => setContent(value)}
              className="h-full font-mono text-code"
              onCreateEditor={(view) => {
                editorViewRef.current = view;
              }}
              basicSetup={{
                lineNumbers: true,
                highlightActiveLineGutter: true,
                highlightSpecialChars: true,
                foldGutter: true,
                drawSelection: true,
                dropCursor: true,
                allowMultipleSelections: true,
                indentOnInput: true,
                syntaxHighlighting: true,
                bracketMatching: true,
                closeBrackets: true,
                autocompletion: true,
                rectangularSelection: true,
                crosshairCursor: true,
                highlightActiveLine: true,
                highlightSelectionMatches: true,
                closeBracketsKeymap: true,
                defaultKeymap: true,
                searchKeymap: true,
                historyKeymap: true,
                foldKeymap: true,
                completionKeymap: true,
                lintKeymap: true,
              }}
            />
          </div>
        </div>

        {viewMode === "split" && (
          <div
            className="hidden lg:block w-px bg-border-subtle flex-shrink-0"
            aria-hidden="true"
          />
        )}

        <div
          className={`${viewMode === "split" ? "lg:w-2/5" : "w-full"} ${viewMode === "edit" ? "hidden" : "block"} h-full overflow-auto bg-bg-base p-6`}
        >
          <div ref={previewRef} className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeSanitize, rehypeHighlight]}
            >
              {content || "*Start typing to see preview...*"}
            </ReactMarkdown>
          </div>
        </div>
      </div>

      <div className="px-6 py-4 border-t border-border-subtle bg-bg-surface text-caption text-text-tertiary flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5" title="Word count">
            <AlignLeft className="w-4 h-4" aria-hidden="true" />
            <span>{wordCount} words</span>
          </div>
          <div className="flex items-center gap-1.5" title="Estimated reading time">
            <Clock className="w-4 h-4" aria-hidden="true" />
            <span>{readingTime}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 hidden sm:flex">
          <Sparkles className="w-4 h-4" aria-hidden="true" />
          <span>
            Markdown supported. Use Ctrl/Cmd shortcuts.
          </span>
        </div>
      </div>

      {linkDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="link-dialog-title"
        >
          <div className="w-full max-w-md rounded-lg bg-bg-surface border border-border-subtle shadow-xl">
            <div className="p-6 border-b border-border-subtle">
              <h2
                id="link-dialog-title"
                className="text-lg font-semibold text-text-primary"
              >
                Insert link
              </h2>
              <p className="text-caption text-text-secondary mt-1">
                Wrap your selection with a Markdown link. Leave the text blank
                to use the URL as the label.
              </p>
            </div>

            <form onSubmit={handleLinkSubmit} className="p-6 space-y-4">
              <div>
                <label
                  htmlFor="link-text"
                  className="block text-caption font-medium text-text-secondary mb-1"
                >
                  Link text
                </label>
                <input
                  id="link-text"
                  type="text"
                  value={linkTextValue}
                  onChange={(event) => {
                    setLinkTextValue(event.target.value);
                  }}
                  className="w-full px-3 py-2 rounded-md border border-border-subtle bg-bg-base text-small focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g. Research dataset"
                />
              </div>

              <div>
                <label
                  htmlFor="link-url"
                  className="block text-caption font-medium text-text-secondary mb-1"
                >
                  URL
                </label>
                <input
                  id="link-url"
                  ref={linkUrlInputRef}
                  type="url"
                  value={linkUrlValue}
                  onChange={(event) => {
                    setLinkUrlValue(event.target.value);
                    if (linkError) {
                      setLinkError(null);
                    }
                  }}
                  required
                  maxLength={2048}
                  className="w-full px-3 py-2 rounded-md border border-border-subtle bg-bg-base text-small focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="https://example.com"
                />
                {linkError && (
                  <p className="text-caption text-destructive mt-1">
                    {linkError}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeLinkDialog}
                  className="px-4 py-2 rounded-md border border-border-subtle bg-bg-base text-small font-medium text-text-primary hover:bg-bg-elevated transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-md bg-primary-500 text-white text-small font-medium hover:bg-primary-600 transition-colors"
                >
                  Insert link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

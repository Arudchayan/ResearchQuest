import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView, keymap } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { githubLight, githubDark } from "@uiw/codemirror-theme-github";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import rehypeHighlight from "rehype-highlight";
import type { ViewMode } from "../hooks/useMarkdownEditor";

interface EditorContentProps {
  content: string;
  setContent: (content: string) => void;
  debouncedContent: string;
  viewMode: ViewMode;
  effectiveTheme: string;
  editorViewRef: React.MutableRefObject<EditorView | null>;
  previewRef: React.RefObject<HTMLDivElement>;
  applyFormatting: (format: "bold" | "italic" | "code" | "list" | "heading") => void;
  openLinkDialog: () => void;
  setCitationPickerOpen: (open: boolean) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleZenMode: () => void;
}

const REMARK_PLUGINS = [remarkGfm];
const REHYPE_PLUGINS = [rehypeSanitize, rehypeHighlight];

export default function EditorContent({
  content,
  setContent,
  debouncedContent,
  viewMode,
  effectiveTheme,
  editorViewRef,
  previewRef,
  applyFormatting,
  openLinkDialog,
  setCitationPickerOpen,
  setViewMode,
  toggleZenMode,
}: EditorContentProps) {
  const extensions = useMemo(
    () => [
      markdown(),
      EditorView.contentAttributes.of({ "aria-label": "Note editor" }),
      EditorView.lineWrapping,
      keymap.of([
        { key: "Mod-b", run: () => { applyFormatting("bold"); return true; } },
        { key: "Mod-i", run: () => { applyFormatting("italic"); return true; } },
        { key: "Mod-Shift-c", run: () => { applyFormatting("code"); return true; } },
        { key: "Mod-Shift-l", run: () => { applyFormatting("list"); return true; } },
        { key: "Mod-Shift-h", run: () => { applyFormatting("heading"); return true; } },
        { key: "Mod-k", run: () => { openLinkDialog(); return true; } },
        { key: "Mod-Shift-r", run: () => { setCitationPickerOpen(true); return true; } },
        { key: "Mod-Shift-e", run: () => { setViewMode("edit"); return true; } },
        { key: "Mod-Shift-s", run: () => { setViewMode("split"); return true; } },
        { key: "Mod-Shift-p", run: () => { setViewMode("preview"); return true; } },
        { key: "Mod-Shift-f", run: () => { toggleZenMode(); return true; } },
      ]),
    ],
    [applyFormatting, openLinkDialog, setCitationPickerOpen, setViewMode, toggleZenMode],
  );

  return (
    <div className={`flex min-h-0 flex-1 overflow-hidden ${viewMode === "split" ? "flex-col lg:flex-row" : "flex-col"}`}>
      <div className={`${viewMode === "split" ? "lg:w-3/5" : "w-full"} ${viewMode === "preview" ? "hidden" : "block"} h-full min-h-0 bg-bg-surface`}>
        <div className="h-full overflow-auto">
          <CodeMirror
            value={content}
            height="100%"
            theme={effectiveTheme === "dark" ? githubDark : githubLight}
            extensions={extensions}
            onChange={setContent}
            className="h-full font-mono text-code"
            onCreateEditor={(view: EditorView) => { editorViewRef.current = view; }}
            basicSetup={{
              lineNumbers: true,
              foldGutter: true,
              highlightActiveLine: true,
              bracketMatching: true,
              closeBrackets: true,
              autocompletion: true,
              historyKeymap: true,
            }}
          />
        </div>
      </div>

      {viewMode === "split" && <div className="hidden lg:block w-px bg-border-subtle flex-shrink-0" />}

      <div className={`${viewMode === "split" ? "lg:w-2/5" : "w-full"} ${viewMode === "edit" ? "hidden" : "block"} h-full min-h-0 overflow-auto bg-bg-base p-4 sm:p-6`}>
        <div ref={previewRef} className="prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown
            remarkPlugins={REMARK_PLUGINS}
            rehypePlugins={REHYPE_PLUGINS}
            components={{
              pre: (props) => <pre {...props} tabIndex={0} />,
            }}
          >
            {debouncedContent || "*Start typing to see preview...*"}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

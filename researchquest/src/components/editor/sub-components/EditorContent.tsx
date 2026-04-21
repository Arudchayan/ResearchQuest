import CodeMirror from "@uiw/react-codemirror";
import { githubLight, githubDark } from "@uiw/codemirror-theme-github";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import rehypeHighlight from "rehype-highlight";
import type { EditorView } from "@codemirror/view";
import type { ViewMode } from "../hooks/useMarkdownEditor";

interface EditorContentProps {
  content: string;
  setContent: (content: string) => void;
  debouncedContent: string;
  viewMode: ViewMode;
  effectiveTheme: string;
  extensions: any[];
  editorViewRef: React.MutableRefObject<EditorView | null>;
  previewRef: React.RefObject<HTMLDivElement>;
}

const REMARK_PLUGINS = [remarkGfm];
const REHYPE_PLUGINS = [rehypeSanitize, rehypeHighlight];

export function EditorContent({
  content,
  setContent,
  debouncedContent,
  viewMode,
  effectiveTheme,
  extensions,
  editorViewRef,
  previewRef,
}: EditorContentProps) {
  return (
    <div className={`flex-1 flex overflow-hidden ${viewMode === "split" ? "flex-col lg:flex-row" : "flex-col"}`}>
      <div className={`${viewMode === "split" ? "lg:w-3/5" : "w-full"} ${viewMode === "preview" ? "hidden" : "block"} h-full bg-bg-surface`}>
        <div className="h-full overflow-auto">
          <CodeMirror
            value={content}
            height="100%"
            theme={effectiveTheme === "dark" ? githubDark : githubLight}
            extensions={extensions}
            onChange={setContent}
            className="h-full font-mono text-code"
            onCreateEditor={(view) => { editorViewRef.current = view; }}
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

      <div className={`${viewMode === "split" ? "lg:w-2/5" : "w-full"} ${viewMode === "edit" ? "hidden" : "block"} h-full overflow-auto bg-bg-base p-6`}>
        <div ref={previewRef} className="prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS}>
            {debouncedContent || "*Start typing to see preview...*"}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

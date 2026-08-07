import {
  Bold,
  Italic,
  Heading,
  Code,
  List,
  Link2,
  Quote,
  Copy,
  ClipboardList,
  Download,
  Printer,
  Maximize2,
  Minimize2,
  Columns,
  Eye,
  Pencil,
} from "lucide-react";
import type { ViewMode } from "../hooks/useMarkdownEditor";

type FormattingOption = "bold" | "italic" | "code" | "list" | "heading";

interface EditorToolbarProps {
  applyFormatting: (format: FormattingOption) => void;
  handleCopyMarkdown: () => void;
  handleCopyRichText: () => void;
  openLinkDialog: () => void;
  setCitationPickerOpen: (open: boolean) => void;
  handleExport: () => void;
  handlePrint: () => void;
  isZenMode: boolean;
  toggleZenMode: () => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}

const VIEW_OPTIONS: {
  id: ViewMode;
  label: string;
  icon: typeof Pencil;
  description: string;
  shortcut: string;
}[] = [
  { id: "edit", label: "Edit", icon: Pencil, description: "Focus on writing", shortcut: "Shift+Ctrl/Cmd+E" },
  { id: "split", label: "Split", icon: Columns, description: "Side-by-side", shortcut: "Shift+Ctrl/Cmd+S" },
  { id: "preview", label: "Preview", icon: Eye, description: "Full width preview", shortcut: "Shift+Ctrl/Cmd+P" },
];

export function EditorToolbar({
  applyFormatting,
  handleCopyMarkdown,
  handleCopyRichText,
  openLinkDialog,
  setCitationPickerOpen,
  handleExport,
  handlePrint,
  isZenMode,
  toggleZenMode,
  viewMode,
  setViewMode,
}: EditorToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-bg-elevated px-4 py-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
        <ToolbarButton onClick={() => applyFormatting("bold")} icon={Bold} label="Bold" shortcut="Ctrl/Cmd+B" />
        <ToolbarButton onClick={() => applyFormatting("italic")} icon={Italic} label="Italic" shortcut="Ctrl/Cmd+I" />
        <ToolbarButton onClick={() => applyFormatting("heading")} icon={Heading} label="Toggle Heading" shortcut="Ctrl/Cmd+Shift+H" />
        <ToolbarButton onClick={() => applyFormatting("code")} icon={Code} label="Inline code" shortcut="Ctrl/Cmd+Shift+C" />
        <Divider />
        <ToolbarButton onClick={handleCopyMarkdown} icon={Copy} label="Copy Markdown" />
        <ToolbarButton onClick={handleCopyRichText} icon={ClipboardList} label="Copy Rich Text" />
        <Divider />
        <ToolbarButton onClick={() => applyFormatting("list")} icon={List} label="Bulleted list" shortcut="Ctrl/Cmd+Shift+L" />
        <ToolbarButton onClick={openLinkDialog} icon={Link2} label="Insert link" shortcut="Ctrl/Cmd+K" />
        <ToolbarButton onClick={() => setCitationPickerOpen(true)} icon={Quote} label="Insert Citation" shortcut="Ctrl/Cmd+Shift+R" />
        <Divider />
        <ToolbarButton onClick={handleExport} icon={Download} label="Export to Markdown" />
        <ToolbarButton onClick={handlePrint} icon={Printer} label="Print Note" />
        <Divider />
        <ToolbarButton
          onClick={toggleZenMode}
          icon={isZenMode ? Minimize2 : Maximize2}
          label={isZenMode ? "Exit Zen Mode" : "Enter Zen Mode"}
          shortcut="Ctrl/Cmd+Shift+F"
          active={isZenMode}
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-caption text-text-tertiary hidden xl:inline">Layout</span>
        <div className="inline-flex rounded-md border border-border-subtle overflow-hidden" role="radiogroup">
          {VIEW_OPTIONS.map(({ id, label, icon: Icon, shortcut }) => (
            <button
              key={id}
              type="button"
              onClick={() => setViewMode(id)}
              className={`flex items-center gap-2 px-3 py-2 text-small transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2 ${
                viewMode === id ? "bg-primary-500 text-bg-base" : "text-text-secondary hover:bg-bg-surface hover:text-text-primary"
              }`}
              title={`${label} (${shortcut})`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

interface ToolbarButtonProps {
  readonly onClick: () => void;
  readonly icon: typeof Bold;
  readonly label: string;
  readonly shortcut?: string;
  readonly active?: boolean;
}

function ToolbarButton({ onClick, icon: Icon, label, shortcut, active }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-control p-2 text-text-secondary transition-colors hover:bg-bg-surface hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2 ${active ? "bg-primary-50 text-text-primary" : ""}`}
      aria-label={shortcut ? `${label} (${shortcut})` : label}
      title={shortcut ? `${label} (${shortcut})` : label}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function Divider() {
  return <div className="w-px h-6 bg-border-subtle mx-1" aria-hidden="true" />;
}

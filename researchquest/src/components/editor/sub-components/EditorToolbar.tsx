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

interface EditorToolbarProps {
  applyFormatting: (format: any) => void;
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
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-bg-elevated px-4 py-2.5">
      <div className="flex items-center gap-2">
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
        <div className="inline-flex overflow-hidden rounded-lg border border-border-moderate bg-bg-surface p-0.5 shadow-sm" role="radiogroup">
          {VIEW_OPTIONS.map(({ id, label, icon: Icon, shortcut }) => (
            <button
              key={id}
              type="button"
              onClick={() => setViewMode(id)}
              className={`flex items-center gap-2 px-3 py-2 text-small transition-colors ${
                viewMode === id
                  ? "bg-accent-soft text-accent-strong shadow-sm rounded-md"
                  : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary rounded-md"
              }`}
              title={`${label} (${shortcut})`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ToolbarButton({ onClick, icon: Icon, label, shortcut, active }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`icon-btn ${active ? "bg-accent-soft text-accent-strong hover:bg-accent/20" : ""}`}
      aria-label={shortcut ? `${label} (${shortcut})` : label}
      title={shortcut ? `${label} (${shortcut})` : label}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

function Divider() {
  return <div className="mx-1 h-6 w-px bg-border-subtle" aria-hidden="true" />;
}

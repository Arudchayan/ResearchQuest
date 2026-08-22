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
  MoreHorizontal,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
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
        <ToolbarButton onClick={() => applyFormatting("list")} icon={List} label="Bulleted list" shortcut="Ctrl/Cmd+Shift+L" />

        <div className="hidden md:flex md:items-center md:gap-1">
          <Divider />
          <ToolbarButton onClick={handleCopyMarkdown} icon={Copy} label="Copy Markdown" />
          <ToolbarButton onClick={handleCopyRichText} icon={ClipboardList} label="Copy Rich Text" />
          <Divider />
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

        <div className="md:hidden">
          <MoreMenu
            openLinkDialog={openLinkDialog}
            handleCopyMarkdown={handleCopyMarkdown}
            handleCopyRichText={handleCopyRichText}
            setCitationPickerOpen={setCitationPickerOpen}
            handleExport={handleExport}
            handlePrint={handlePrint}
            isZenMode={isZenMode}
            toggleZenMode={toggleZenMode}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-caption text-text-tertiary hidden xl:inline">Layout</span>
        <div className="inline-flex rounded-md border border-border-subtle overflow-hidden" role="radiogroup">
          {VIEW_OPTIONS.map(({ id, label, icon: Icon, shortcut }) => (
            <button
              key={id}
              type="button"
              onClick={() => setViewMode(id)}
              className={`flex min-h-11 items-center gap-2 px-3 py-2 text-small transition-colors md:min-h-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2 ${
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

interface MoreMenuProps {
  openLinkDialog: () => void;
  handleCopyMarkdown: () => void;
  handleCopyRichText: () => void;
  setCitationPickerOpen: (open: boolean) => void;
  handleExport: () => void;
  handlePrint: () => void;
  isZenMode: boolean;
  toggleZenMode: () => void;
}

function MoreMenu({
  openLinkDialog,
  handleCopyMarkdown,
  handleCopyRichText,
  setCitationPickerOpen,
  handleExport,
  handlePrint,
  isZenMode,
  toggleZenMode,
}: MoreMenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="rounded-control p-2 text-text-secondary min-h-11 min-w-11 transition-colors hover:bg-bg-surface hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
          aria-label="More actions"
          title="More actions"
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-dropdown min-w-[220px] rounded-surface border border-border-subtle bg-bg-surface p-1 shadow-md animate-in fade-in-0 zoom-in-95"
          align="end"
          sideOffset={5}
        >
          <MoreMenuItem icon={Link2} label="Insert link" shortcut="Ctrl/Cmd+K" onSelect={openLinkDialog} />
          <MoreMenuItem icon={Copy} label="Copy Markdown" onSelect={handleCopyMarkdown} />
          <MoreMenuItem icon={ClipboardList} label="Copy Rich Text" onSelect={handleCopyRichText} />
          <MoreMenuItem icon={Quote} label="Insert Citation" shortcut="Ctrl/Cmd+Shift+R" onSelect={() => setCitationPickerOpen(true)} />
          <MoreMenuItem icon={Download} label="Export to Markdown" onSelect={handleExport} />
          <MoreMenuItem icon={Printer} label="Print Note" onSelect={handlePrint} />
          <MoreMenuItem
            icon={isZenMode ? Minimize2 : Maximize2}
            label={isZenMode ? "Exit Zen Mode" : "Enter Zen Mode"}
            shortcut="Ctrl/Cmd+Shift+F"
            active={isZenMode}
            onSelect={toggleZenMode}
          />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

interface MoreMenuItemProps {
  readonly icon: typeof Bold;
  readonly label: string;
  readonly shortcut?: string;
  readonly active?: boolean;
  readonly onSelect: () => void;
}

function MoreMenuItem({ icon: Icon, label, shortcut, active, onSelect }: MoreMenuItemProps) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-control px-3 py-2 text-small text-text-primary outline-none hover:bg-bg-elevated focus:bg-bg-elevated ${active ? "bg-primary-50 text-text-primary" : ""}`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span className="flex-1">{label}</span>
      {shortcut && <span className="text-caption text-text-tertiary">{shortcut}</span>}
    </DropdownMenu.Item>
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
      className={`rounded-control p-2 text-text-secondary min-h-11 min-w-11 transition-colors md:min-h-0 md:min-w-0 hover:bg-bg-surface hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2 ${active ? "bg-primary-50 text-text-primary" : ""}`}
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

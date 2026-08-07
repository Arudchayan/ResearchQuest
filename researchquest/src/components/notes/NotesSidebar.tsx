import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Ref } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowUpDown,
  Download,
  FileJson,
  FileText,
  Loader2,
  Plus,
  Search,
  Table,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useFilteredList } from "../../hooks/useFilteredList";
import { logger } from "../../utils/logger";
import {
  convertNotesToCSV,
  convertNotesToJSON,
  convertNotesToMarkdown,
  downloadFile,
} from "../../utils/export";
import { InlineError } from "../ui/ErrorFallback";
import { ListSkeleton } from "../ui/Skeleton";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import type { Note } from "../../types/database";
import { NoteCard } from "./NoteCard";

type SortOption =
  | "updated_desc"
  | "updated_asc"
  | "created_desc"
  | "created_asc"
  | "title_asc"
  | "title_desc";

interface NotesSidebarProps {
  readonly notes: Note[];
  readonly selectedNote: Note | null;
  readonly notesLoading: boolean;
  readonly notesSyncError: { readonly message: string } | null;
  readonly isCreating: boolean;
  readonly isMobileEditorOpen: boolean;
  readonly listRef: Ref<HTMLElement>;
  readonly onCreateNote: () => void;
  readonly onSelectNote: (note: Note) => void;
  readonly onDeleteNote: (noteId: string) => void;
}

function compareNotes(sortOption: SortOption, a: Note, b: Note): number {
  const firstTitle = a.title || "";
  const secondTitle = b.title || "";

  switch (sortOption) {
    case "updated_desc": return b.updated_at.localeCompare(a.updated_at);
    case "updated_asc": return a.updated_at.localeCompare(b.updated_at);
    case "created_desc": return b.created_at.localeCompare(a.created_at);
    case "created_asc": return a.created_at.localeCompare(b.created_at);
    case "title_asc": return firstTitle.localeCompare(secondTitle);
    case "title_desc": return secondTitle.localeCompare(firstTitle);
    default: return 0;
  }
}

export function NotesSidebar({
  notes,
  selectedNote,
  notesLoading,
  notesSyncError,
  isCreating,
  isMobileEditorOpen,
  listRef,
  onCreateNote,
  onSelectNote,
  onDeleteNote,
}: NotesSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>("updated_desc");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const allTags = useMemo(() => Array.from(new Set(notes.flatMap((note) => note.tags || []))).sort(), [notes]);
  const searchableFields = useCallback((note: Note) => [note.title || "", note.markdown_body || ""].join(" "), []);
  const sortNotes = useCallback((a: Note, b: Note) => compareNotes(sortOption, a, b), [sortOption]);
  const filterByTag = useCallback(
    (note: Note) => !selectedTag || note.tags?.includes(selectedTag) === true,
    [selectedTag],
  );
  const filteredNotes = useFilteredList(notes, searchQuery, searchableFields, sortNotes, filterByTag);
  const rowVirtualizer = useVirtualizer({
    count: filteredNotes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 152,
    overscan: 5,
  });

  useEffect(() => {
    if (!isMobileEditorOpen) requestAnimationFrame(() => rowVirtualizer.measure());
  }, [isMobileEditorOpen, rowVirtualizer]);

  const handleExport = (format: "markdown" | "csv" | "json") => {
    if (filteredNotes.length === 0) {
      toast.error("No notes to export");
      return;
    }

    const timestamp = new Date().toISOString().split("T")[0];
    try {
      const exportData = {
        markdown: { content: convertNotesToMarkdown(filteredNotes), extension: "md", type: "text/markdown" },
        csv: { content: convertNotesToCSV(filteredNotes), extension: "csv", type: "text/csv" },
        json: { content: convertNotesToJSON(filteredNotes), extension: "json", type: "application/json" },
      }[format];
      downloadFile(exportData.content, `research-notes-${timestamp}.${exportData.extension}`, exportData.type);
      toast.success(`Exported ${filteredNotes.length} notes as ${format.toUpperCase()}`);
    } catch (error) {
      logger.error("Export failed", error);
      toast.error("Failed to export notes");
    }
  };

  return (
    <aside ref={listRef} data-notes-list className={`min-h-0 min-w-0 w-full h-full flex-shrink-0 flex-col border-b border-border-subtle bg-bg-surface lg:flex lg:h-full lg:max-h-none lg:w-80 lg:flex-none lg:border-b-0 lg:border-r ${isMobileEditorOpen ? "hidden" : "flex"}`} aria-label="Notes list">
      <div className="space-y-4 border-b border-border-subtle p-4">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-subtitle font-bold text-text-primary">Notes</h1>
          <h2 className="sr-only">Notes list</h2>
          <div className="flex items-center gap-2">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button type="button" variant="ghost" size="icon" title="Export notes" aria-label="Export notes">
                  <Download className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content className="z-dropdown min-w-[180px] rounded-surface border border-border-subtle bg-bg-surface p-1 shadow-md animate-in fade-in-0 zoom-in-95" align="start" sideOffset={4}>
                  <ExportOption icon={FileText} label="Markdown (.md)" onSelect={() => handleExport("markdown")} />
                  <ExportOption icon={Table} label="CSV (.csv)" onSelect={() => handleExport("csv")} />
                  <ExportOption icon={FileJson} label="JSON (.json)" onSelect={() => handleExport("json")} />
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            <Button type="button" size="icon" onClick={onCreateNote} disabled={isCreating} aria-label={isCreating ? "Creating note" : "Create new note"}>
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="relative">
            <label htmlFor="notes-search-input" className="sr-only">Search notes</label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <Input id="notes-search-input" ref={searchInputRef} type="search" placeholder="Search notes..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="bg-bg-base pl-10 pr-12 text-small" />
            {searchQuery && <Button type="button" variant="ghost" size="icon" onClick={() => { setSearchQuery(""); searchInputRef.current?.focus(); }} className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full text-text-tertiary hover:text-text-primary" aria-label="Clear search"><X className="h-3.5 w-3.5" aria-hidden="true" /></Button>}
          </div>
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 shrink-0 text-text-tertiary" aria-hidden="true" />
            <select value={sortOption} onChange={(event) => setSortOption(event.target.value as SortOption)} className="min-h-11 min-w-0 w-full rounded-control border border-border-moderate bg-bg-base px-3 py-2 text-small text-text-primary shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2 md:min-h-0" aria-label="Sort notes">
              <option value="updated_desc">Last updated (newest)</option><option value="updated_asc">Last updated (oldest)</option><option value="created_desc">Date created (newest)</option><option value="created_asc">Date created (oldest)</option><option value="title_asc">Title (A–Z)</option><option value="title_desc">Title (Z–A)</option>
            </select>
          </div>
          {allTags.length > 0 && <div className="flex flex-wrap gap-2 overflow-x-auto pb-1">{allTags.map((tag) => <button key={tag} type="button" onClick={() => setSelectedTag((current) => current === tag ? null : tag)} className={`min-h-11 min-w-11 shrink-0 rounded-control border px-2 py-1 text-caption font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus md:min-h-0 ${selectedTag === tag ? "border-primary-500 bg-primary-50 text-text-primary" : "border-border-subtle bg-bg-elevated text-text-secondary hover:border-border-moderate hover:text-text-primary"}`} aria-label={`Filter notes by tag ${tag}`} aria-pressed={selectedTag === tag}>#{tag}</button>)}</div>}
        </div>
      </div>

      <div ref={parentRef} className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
        {notesSyncError ? <div className="p-4"><InlineError message={notesSyncError.message} /></div> : notesLoading ? <div className="p-4"><ListSkeleton count={6} itemType="note" /></div> : filteredNotes.length === 0 ? <NotesEmptyState searchQuery={searchQuery} isCreating={isCreating} onCreateNote={onCreateNote} /> : <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>{rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const note = filteredNotes[virtualRow.index];
          return note ? <div key={note.id} ref={rowVirtualizer.measureElement} data-index={virtualRow.index} style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${virtualRow.start}px)` }} className="border-b border-border-subtle"><NoteCard note={note} isSelected={selectedNote?.id === note.id} highlightQuery={searchQuery} onSelect={onSelectNote} onDelete={onDeleteNote} /></div> : null;
        })}</div>}
      </div>
    </aside>
  );
}

function ExportOption({ icon: Icon, label, onSelect }: { readonly icon: typeof FileText; readonly label: string; readonly onSelect: () => void }) {
  return <DropdownMenu.Item onSelect={onSelect} className="flex cursor-pointer items-center gap-2 rounded-control px-3 py-2 text-small text-text-secondary outline-none transition-colors data-[highlighted]:bg-bg-elevated data-[highlighted]:text-text-primary"><Icon className="h-4 w-4" />{label}</DropdownMenu.Item>;
}

function NotesEmptyState({ searchQuery, isCreating, onCreateNote }: { readonly searchQuery: string; readonly isCreating: boolean; readonly onCreateNote: () => void }) {
  return <div className="flex h-full min-h-64 flex-col items-center justify-center p-6 text-center" role="status" aria-live="polite"><div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-bg-elevated"><FileText className="h-6 w-6 text-text-tertiary" aria-hidden="true" /></div><h2 className="text-body-lg font-semibold text-text-primary">{searchQuery ? "No matches found" : "No notes yet"}</h2><p className="mt-1 max-w-xs text-small text-text-secondary">{searchQuery ? "Try a different keyword or clear your search." : "Create your first note to get started"}</p>{!searchQuery && <Button type="button" onClick={onCreateNote} disabled={isCreating} size="sm" className="mt-4"><Plus className="h-3.5 w-3.5" aria-hidden="true" />Create Note</Button>}</div>;
}

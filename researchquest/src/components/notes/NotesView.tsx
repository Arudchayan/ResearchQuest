import { logger } from "../../utils/logger";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  Plus,
  Search,
  FileText,
  X,
  ArrowUpDown,
  Loader2,
  Download,
  Table,
  FileJson,
  ArrowLeft,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useAppStore } from "../../store/appStore";
import { useShallow } from "zustand/react/shallow";
import { useNotes } from "../../hooks/useNotes";
import { MarkdownEditor } from "../editor/MarkdownEditor";
import { NoteCard } from "./NoteCard";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ConfirmDialog, useConfirmDialog } from "../ui/ConfirmDialog";
import { InlineError } from "../ui/ErrorFallback";
import { ListSkeleton } from "../ui/Skeleton";
import type { Note } from "../../types/database";
import { toast } from "sonner";
import {
  convertNotesToCSV,
  convertNotesToJSON,
  convertNotesToMarkdown,
  downloadFile,
} from "../../utils/export";
import { UNDO_WINDOW_MS } from "../../lib/constants";
import { cn } from "../../lib/utils";

type SortOption =
  | "updated_desc"
  | "updated_asc"
  | "created_desc"
  | "created_asc"
  | "title_asc"
  | "title_desc";

export function NotesView() {
  // Use useShallow to prevent re-renders when other store parts update
  // Optimization: Select only required state slices instead of full store
  const { selectedNote, setSelectedNote, userId, notesSyncError } = useAppStore(
    useShallow((state) => ({
      selectedNote: state.selectedNote,
      setSelectedNote: state.setSelectedNote,
      userId: state.user?.id,
      notesSyncError: state.dataSyncErrors?.notes ?? null,
    })),
  );

  // Note: useNotes hook already uses specific selectors for notes and loading,
  // so it won't cause re-renders on unrelated state changes.
  const {
    notes,
    loading: notesLoading,
    createNote,
    deleteNote,
    restoreNote,
  } = useNotes(userId);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>("updated_desc");
  const [isCreating, setIsCreating] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const { confirm, isOpen, config } = useConfirmDialog();

  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDeletedRef = useRef<Note | null>(null);

  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
    };
  }, []);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    if (notes && Array.isArray(notes)) {
      notes.forEach((note) => {
        if (note.tags && Array.isArray(note.tags)) {
          note.tags.forEach((tag) => tags.add(tag));
        }
      });
    }
    return Array.from(tags).sort();
  }, [notes]);

  // Performance: Pre-compute derived text fields for faster searching
  const searchableNotes = useMemo(() => {
    return (notes || []).map((note) => ({
      note,
      searchText: [note.title || "", note.markdown_body || ""]
        .join(" ")
        .toLowerCase(),
    }));
  }, [notes]);

  const filteredNotes = useMemo(() => {
    // Optimization: Skip filtering if query and tag are empty, and sort order matches default
    if (!searchQuery && !selectedTag && sortOption === "updated_desc") {
      return notes || [];
    }

    // Performance: Filter the pre-computed searchableNotes array directly
    // instead of allocating an intermediate Set and doing cross-reference lookups.
    // This maintains an O(N) fast path during the high-frequency keystroke filtering loop.
    const results = [];
    const normalizedQuery = searchQuery?.toLowerCase() || "";
    const safeSearchableNotes = searchableNotes || [];

    for (let i = 0; i < safeSearchableNotes.length; i++) {
      const sn = safeSearchableNotes[i];
      if (selectedTag && (!sn.note.tags || !sn.note.tags.includes(selectedTag))) {
        continue;
      }
      if (normalizedQuery && !sn.searchText.includes(normalizedQuery)) {
        continue;
      }
      results.push(sn.note);
    }

    return results.sort((a, b) => {
      switch (sortOption) {
        case "updated_desc":
          return b.updated_at > a.updated_at ? 1 : b.updated_at < a.updated_at ? -1 : 0;
        case "updated_asc":
          return a.updated_at > b.updated_at ? 1 : a.updated_at < b.updated_at ? -1 : 0;
        case "created_desc":
          return b.created_at > a.created_at ? 1 : b.created_at < a.created_at ? -1 : 0;
        case "created_asc":
          return a.created_at > b.created_at ? 1 : a.created_at < b.created_at ? -1 : 0;
        case "title_asc":
          return (a.title || "") > (b.title || "")
            ? 1
            : (a.title || "") < (b.title || "")
              ? -1
              : 0;
        case "title_desc":
          return (b.title || "") > (a.title || "")
            ? 1
            : (b.title || "") < (a.title || "")
              ? -1
              : 0;
        default:
          return 0;
      }
    });
  }, [notes, searchQuery, selectedTag, sortOption]);

  const rowVirtualizer = useVirtualizer({
    count: filteredNotes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 160,
    overscan: 5,
  });

  const handleCreateNote = async () => {
    setIsCreating(true);
    try {
      const newNote = await createNote({
        title: "",
        markdown_body: "",
      });
      if (newNote) {
        setSelectedNote(newNote);
        window.history.pushState(null, "", `/notes/${newNote.id}`);
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteWithUndo = useCallback(
    async (noteId: string) => {
      // Optimization: Access state directly to verify note exists and capture it for undo
      // This removes the `notes` dependency, stabilizing the callback and preventing rerenders
      const currentNotes = useAppStore.getState().notes;
      const note = currentNotes.find((n) => n.id === noteId);
      const success = await deleteNote(noteId);

      if (success && note) {
        lastDeletedRef.current = note;
        if (undoTimeoutRef.current) {
          clearTimeout(undoTimeoutRef.current);
        }

        // Optimization: Access state directly to keep callback stable and avoid re-renders
        const currentSelected = useAppStore.getState().selectedNote;
        if (currentSelected?.id === noteId) {
          setSelectedNote(null);
          window.history.pushState(null, "", "/notes");
        }

        const toastId = toast.success("Note deleted", {
          description: "Undo within 6 seconds to restore it.",
          duration: UNDO_WINDOW_MS,
          action: {
            label: "Undo",
            onClick: async () => {
              if (lastDeletedRef.current) {
                await restoreNote(lastDeletedRef.current);
                lastDeletedRef.current = null;
                if (undoTimeoutRef.current) {
                  clearTimeout(undoTimeoutRef.current);
                  undoTimeoutRef.current = null;
                }
                toast.dismiss(toastId);
              }
            },
          },
        });

        undoTimeoutRef.current = setTimeout(() => {
          lastDeletedRef.current = null;
          toast.dismiss(toastId);
          undoTimeoutRef.current = null;
        }, UNDO_WINDOW_MS);
      }
    },
    [deleteNote, restoreNote, setSelectedNote],
  );

  const handleDeleteNote = useCallback(
    async (noteId: string) => {
      const shouldDelete = await confirm({
        title: "Delete Note",
        message: "Are you sure you want to delete this note?",
        variant: "danger",
        confirmText: "Delete",
      });

      if (shouldDelete) {
        await handleDeleteWithUndo(noteId);
      }
    },
    [confirm, handleDeleteWithUndo],
  );

  const handleSelectNote = useCallback(
    (note: Note) => {
      setSelectedNote(note);
      window.history.pushState(null, "", `/notes/${note.id}`);
    },
    [setSelectedNote],
  );

  const handleExport = useCallback((format: "markdown" | "csv" | "json") => {
    if (filteredNotes.length === 0) {
      toast.error("No notes to export");
      return;
    }

    const timestamp = new Date().toISOString().split("T")[0];
    let content = "";
    let filename = "";
    let type = "";

    try {
      switch (format) {
        case "markdown":
          content = convertNotesToMarkdown(filteredNotes);
          filename = `research-notes-${timestamp}.md`;
          type = "text/markdown";
          break;
        case "csv":
          content = convertNotesToCSV(filteredNotes);
          filename = `research-notes-${timestamp}.csv`;
          type = "text/csv";
          break;
        case "json":
          content = convertNotesToJSON(filteredNotes);
          filename = `research-notes-${timestamp}.json`;
          type = "application/json";
          break;
      }

      downloadFile(content, filename, type);
      toast.success(
        `Exported ${filteredNotes.length} notes as ${format.toUpperCase()}`,
      );
    } catch (err) {
      logger.error("Export failed", err);
      toast.error("Failed to export notes");
    }
  }, [filteredNotes]);

  useEffect(() => {
    const handleExportShortcut = () => {
      handleExport("markdown");
    };

    document.addEventListener("export-current-view", handleExportShortcut);
    return () => {
      document.removeEventListener("export-current-view", handleExportShortcut);
    };
  }, [handleExport]);

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-bg-base text-text-primary lg:flex-row">
      {/* Notes List Sidebar */}
      <div
        className={cn(
          "w-full h-full max-h-[45vh] flex-shrink-0 border-b border-border-subtle bg-bg-elevated flex flex-col lg:h-full lg:max-h-none lg:w-80 lg:border-b-0 lg:border-r",
          selectedNote && "max-lg:hidden",
        )}
      >
        <div className="p-4 border-b border-border-subtle space-y-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="section-kicker">Research Notes</p>
              <h2 className="mt-1 truncate font-serif text-lg font-semibold text-text-primary">
                Notes
              </h2>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    className="icon-btn h-10 w-10"
                    title="Export notes"
                    aria-label="Export notes"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    className="min-w-[180px] bg-bg-surface rounded-lg shadow-lift border border-border-moderate p-1 z-50 animate-in fade-in-0 zoom-in-95"
                    align="start"
                    sideOffset={5}
                  >
                    <DropdownMenu.Item
                      onSelect={() => handleExport("markdown")}
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-bg-elevated hover:text-text-primary cursor-pointer outline-none"
                    >
                      <FileText className="h-4 w-4" />
                      Markdown (.md)
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onSelect={() => handleExport("csv")}
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-bg-elevated hover:text-text-primary cursor-pointer outline-none"
                    >
                      <Table className="h-4 w-4" />
                      CSV (.csv)
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onSelect={() => handleExport("json")}
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-bg-elevated hover:text-text-primary cursor-pointer outline-none"
                    >
                      <FileJson className="h-4 w-4" />
                      JSON (.json)
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>

              <button
                onClick={handleCreateNote}
                disabled={isCreating}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-text-primary text-bg-base shadow-lift transition-transform hover:-translate-y-0.5 hover:opacity-95 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
                aria-label={isCreating ? "Creating note..." : "Create new note"}
              >
                {isCreating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="relative">
              <label htmlFor="notes-search-input" className="sr-only">Search notes</label>
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
              <input
                id="notes-search-input"
                ref={searchInputRef}
                type="text"
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-border-moderate bg-bg-surface py-2.5 pl-9 pr-10 text-small text-text-primary shadow-sm placeholder:text-text-tertiary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                aria-label="Search notes"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-text-tertiary transition-colors hover:bg-bg-elevated hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
                  aria-label="Clear search"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 flex-shrink-0 text-text-tertiary" />
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="w-full cursor-pointer rounded-lg border border-border-moderate bg-bg-surface px-3 py-2.5 text-small text-text-primary shadow-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                aria-label="Sort notes"
              >
                <option value="updated_desc">Last Updated (Newest)</option>
                <option value="updated_asc">Last Updated (Oldest)</option>
                <option value="created_desc">Date Created (Newest)</option>
                <option value="created_asc">Date Created (Oldest)</option>
                <option value="title_asc">Title (A-Z)</option>
                <option value="title_desc">Title (Z-A)</option>
              </select>
            </div>
          </div>

          {allTags.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag((t) => (t === tag ? null : tag))}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                    selectedTag === tag
                      ? "border-accent/30 bg-accent-soft text-accent-strong"
                      : "border-border-subtle bg-bg-surface text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="sr-only" role="status" aria-live="polite">
          {!notesLoading && !notesSyncError && filteredNotes.length === 0 ? (searchQuery ? "No matches found. Try a different keyword or clear your search." : "No notes yet. Create your first note to get started") : ""}
        </div>

        <div ref={parentRef} className="flex-1 overflow-y-auto">
          {notesSyncError ? (
            <div className="p-4">
              <InlineError message={notesSyncError.message} />
            </div>
          ) : notesLoading ? (
            <div className="p-4">
              <ListSkeleton count={6} itemType="note" />
            </div>
          ) : filteredNotes.length === 0 ? (
            <div
              className="animate-rise surface-card m-4 flex flex-col items-center justify-center px-6 py-10 text-center"
            >
              <span className="icon-tile h-12 w-12 bg-blue-soft text-blue-strong">
                <FileText className="h-6 w-6" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-small font-semibold text-text-primary">
                {searchQuery ? "No matches found" : "No notes yet"}
              </h3>
              <p className="mt-1.5 max-w-[220px] text-caption text-text-secondary">
                {searchQuery
                  ? "Try a different keyword or clear your search."
                  : "Create your first note to get started"}
              </p>
              {!searchQuery && (
                <button
                  onClick={handleCreateNote}
                  disabled={isCreating}
                  className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-text-primary px-4 text-sm font-semibold text-bg-base shadow-lift transition-transform hover:-translate-y-0.5 hover:opacity-95 disabled:opacity-70 disabled:hover:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Create Note
                </button>
              )}
            </div>
          ) : (
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const note = filteredNotes[virtualRow.index];
                return (
                  <div
                    key={virtualRow.index}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className="p-2"
                  >
                    <NoteCard
                      note={note}
                      isSelected={selectedNote?.id === note.id}
                      highlightQuery={searchQuery}
                      onSelect={handleSelectNote}
                      onDelete={handleDeleteNote}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Editor Area */}
      <div
        className={cn(
          "w-full min-w-0 min-h-0 flex-1 flex-col h-full overflow-hidden bg-bg-base",
          selectedNote
            ? "absolute inset-0 z-20 flex lg:relative lg:inset-auto lg:z-auto"
            : "hidden lg:flex",
        )}
      >
        {selectedNote ? (
          <>
          <div className="lg:hidden p-3 border-b border-border-subtle bg-bg-surface">
              <button
                onClick={() => {
                  setSelectedNote(null);
                  window.history.pushState(null, "", "/notes");
                }}
                className="icon-btn -ml-2 inline-flex h-9 w-auto items-center gap-2 rounded-lg px-2 text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                aria-label="Back to notes"
              >
                <ArrowLeft className="h-5 w-5" />
                <span className="font-medium">Notes</span>
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden max-lg:[&>div]:h-full">
              <MarkdownEditor />
            </div>
          </>
        ) : (
          <div className="animate-rise flex flex-1 flex-col items-center justify-center p-8 text-center">
            <span className="icon-tile h-16 w-16 rounded-2xl bg-blue-soft text-blue-strong">
              <FileText className="h-8 w-8" aria-hidden="true" />
            </span>
            <h3 className="mt-4 font-serif text-lg font-medium text-text-primary">
              Select a note
            </h3>
            <p className="mt-1.5 max-w-xs text-small text-text-secondary">
              Choose a note from the sidebar to start editing, or create a new
              one.
            </p>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={isOpen}
        onClose={config.onClose || (() => {})}
        onConfirm={config.onConfirm || (() => {})}
        title={config.title || ""}
        message={config.message || ""}
        confirmText={config.confirmText}
        cancelText={config.cancelText}
        variant={config.variant}
        isLoading={config.isLoading}
      />
    </div>
  );
}

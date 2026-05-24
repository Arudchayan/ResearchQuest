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

  // ⚡ PERFORMANCE OPTIMIZATION: Pre-compute derived text fields for faster searching
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

    // ⚡ PERFORMANCE OPTIMIZATION: Filter the pre-computed searchableNotes array directly
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
    },
    [setSelectedNote],
  );

  const handleExport = (format: "markdown" | "csv" | "json") => {
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
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white dark:bg-slate-950 lg:flex-row">
      {/* Notes List Sidebar */}
      <div className="w-full max-h-[45vh] flex-shrink-0 border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900 flex flex-col lg:h-full lg:max-h-none lg:w-80 lg:border-b-0 lg:border-r">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Notes
            </h2>
            <div className="flex items-center gap-2">
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md transition-colors"
                    title="Export notes"
                    aria-label="Export notes"
                  >
                    <Download className="w-5 h-5" aria-hidden="true" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    className="min-w-[180px] bg-white dark:bg-slate-950 rounded-lg shadow-lg border border-slate-200 dark:border-slate-800 p-1 z-50 animate-in fade-in-0 zoom-in-95"
                    align="start"
                    sideOffset={5}
                  >
                    <DropdownMenu.Item
                      onSelect={() => handleExport("markdown")}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer outline-none"
                    >
                      <FileText className="w-4 h-4" />
                      Markdown (.md)
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onSelect={() => handleExport("csv")}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer outline-none"
                    >
                      <Table className="w-4 h-4" />
                      CSV (.csv)
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onSelect={() => handleExport("json")}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer outline-none"
                    >
                      <FileJson className="w-4 h-4" />
                      JSON (.json)
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>

              <button
                onClick={handleCreateNote}
                disabled={isCreating}
                className="p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                aria-label={isCreating ? "Creating note..." : "Create new note"}
              >
                {isCreating ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Plus className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="relative">
              <label htmlFor="notes-search-input" className="sr-only">Search notes</label>
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                id="notes-search-input"
                ref={searchInputRef}
                type="text"
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-10 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Search notes"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Clear search"
                >
                  <X className="w-3 h-3" aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
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
                  className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${
                    selectedTag === tag
                      ? "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800"
                      : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 dark:hover:bg-slate-700"
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
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
              className="flex flex-col items-center justify-center h-64 p-6 text-center animate-in fade-in duration-300"
              role="status"
              aria-live="polite"
            >
              <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3">
                <FileText className="w-6 h-6 text-slate-400 opacity-50" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
                {searchQuery ? "No matches found" : "No notes yet"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 max-w-[200px]">
                {searchQuery
                  ? "Try a different keyword or clear your search."
                  : "Create your first note to get started"}
              </p>
              {!searchQuery && (
                <button
                  onClick={handleCreateNote}
                  disabled={isCreating}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors disabled:opacity-70 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                >
                  <Plus className="w-3.5 h-3.5" />
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
                    className="border-b border-slate-100 dark:border-slate-800 last:border-b-0"
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
      <div className="w-full min-w-0 min-h-0 flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-slate-950">
        {selectedNote ? (
          <MarkdownEditor />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
              Select a note
            </h3>
            <p className="max-w-xs text-sm">
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

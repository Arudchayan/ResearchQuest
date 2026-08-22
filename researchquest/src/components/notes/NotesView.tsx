import { useCallback, useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useNotes } from "../../hooks/useNotes";
import { useUndoDelete } from "../../hooks/useUndoDelete";
import { useAppStore } from "../../store/appStore";
import { MarkdownEditor } from "../editor/MarkdownEditor";
import { EditorPlaceholder } from "../editor/EditorPlaceholder";
import { ConfirmDialog, useConfirmDialog } from "../ui/ConfirmDialog";
import type { Note } from "../../types/database";
import { parseRoute } from "../../lib/router";
import { NotesSidebar } from "./NotesSidebar";

export function NotesView() {
  const { selectedNote, setSelectedNote, userId, notesSyncError } = useAppStore(
    useShallow((state) => ({
      selectedNote: state.selectedNote,
      setSelectedNote: state.setSelectedNote,
      userId: state.user?.id,
      notesSyncError: state.dataSyncErrors?.notes ?? null,
    })),
  );
  const { notes, loading: notesLoading, createNote, deleteNote, restoreNote } = useNotes(userId);
  const [isCreating, setIsCreating] = useState(false);
  const [isMobileEditorOpen, setIsMobileEditorOpen] = useState(false);
  const notesListRef = useRef<HTMLElement | null>(null);
  const { confirm, isOpen, config } = useConfirmDialog();
  const { handleDeleteWithUndo } = useUndoDelete(
    (note: Note) => deleteNote(note.id),
    (note: Note) => restoreNote(note),
    { entityLabel: "Note" },
  );

  useEffect(() => {
    const syncNotesRoute = () => {
      const route = parseRoute(window.location.pathname);
      if (route.view !== "notes") return;

      const isEditorRoute = route.itemId !== null;
      setIsMobileEditorOpen(isEditorRoute);
      if (!isEditorRoute) {
        setSelectedNote(null);
        return;
      }

      const routedNote = useAppStore.getState().notes.find((note) => note.id === route.itemId);
      if (routedNote) setSelectedNote(routedNote);
    };

    syncNotesRoute();
    window.addEventListener("popstate", syncNotesRoute);
    return () => window.removeEventListener("popstate", syncNotesRoute);
  }, [setSelectedNote]);

  const navigateToNote = useCallback((noteId?: string) => {
    window.history.pushState(null, "", noteId ? `/notes/${noteId}` : "/notes");
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, []);

  const handleCreateNote = useCallback(async () => {
    setIsCreating(true);
    try {
      const newNote = await createNote({ title: "", markdown_body: "" });
      if (newNote) {
        setSelectedNote(newNote);
        setIsMobileEditorOpen(true);
        navigateToNote(newNote.id);
      }
    } finally {
      setIsCreating(false);
    }
  }, [createNote, navigateToNote, setSelectedNote]);

  const handleDeleteNote = useCallback(async (noteId: string) => {
    const shouldDelete = await confirm({
      title: "Delete note",
      message: "Are you sure you want to delete this note? You can undo this action for a short time.",
      variant: "danger",
      confirmText: "Delete",
    });
    if (!shouldDelete) return;

    const note = useAppStore.getState().notes.find((currentNote) => currentNote.id === noteId);
    if (!note) return;
    if (useAppStore.getState().selectedNote?.id === noteId) {
      setSelectedNote(null);
      setIsMobileEditorOpen(false);
      navigateToNote();
    }
    await handleDeleteWithUndo(note);
  }, [confirm, handleDeleteWithUndo, navigateToNote, setSelectedNote]);

  const handleSelectNote = useCallback((note: Note) => {
    setSelectedNote(note);
    setIsMobileEditorOpen(true);
    navigateToNote(note.id);
  }, [navigateToNote, setSelectedNote]);

  const handleBackToList = useCallback(() => {
    setIsMobileEditorOpen(false);
    // Keep the selected note mounted for desktop/autosave; mobile state is local.
    window.history.replaceState(null, "", "/notes");

    requestAnimationFrame(() => {
      const noteId = selectedNote?.id;
      if (!noteId || !notesListRef.current) return;

      const noteCard = Array.from(
        notesListRef.current.querySelectorAll<HTMLElement>("[data-note-card]"),
      ).find((element) => element.dataset["noteCard"] === noteId);

      (noteCard ?? notesListRef.current.querySelector<HTMLElement>("#notes-search-input"))?.focus();
    });
  }, [selectedNote?.id]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-bg-base lg:flex-row">
      <NotesSidebar
        notes={notes}
        selectedNote={selectedNote}
        notesLoading={notesLoading}
        notesSyncError={notesSyncError}
        isCreating={isCreating}
        isMobileEditorOpen={isMobileEditorOpen}
        listRef={notesListRef}
        onCreateNote={handleCreateNote}
        onSelectNote={handleSelectNote}
        onDeleteNote={handleDeleteNote}
      />

      <section className={`min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden bg-bg-base lg:flex ${isMobileEditorOpen ? "flex" : "hidden"}`} aria-label="Note editor">
        {selectedNote ? <MarkdownEditor onBackToList={handleBackToList} /> : <EditorPlaceholder />}
      </section>

      <ConfirmDialog
        isOpen={isOpen}
        onClose={config.onClose || (() => {})}
        onConfirm={config.onConfirm || (() => {})}
        title={config.title || ""}
        message={config.message || ""}
        {...(config.confirmText !== undefined ? { confirmText: config.confirmText } : {})}
        {...(config.cancelText !== undefined ? { cancelText: config.cancelText } : {})}
        {...(config.variant !== undefined ? { variant: config.variant } : {})}
        {...(config.isLoading !== undefined ? { isLoading: config.isLoading } : {})}
      />
    </div>
  );
}

import { useCallback, useRef } from "react";
import { XP_REWARDS } from "../utils/gamification";
import { useAppStore } from "../store/appStore";
import { useEntityCrud, type AppStoreState } from "./useEntityCrud";
import type { Note } from "../types/database";

export const NOTE_TITLE_MAX_LENGTH = 255;
export const NOTE_BODY_MAX_LENGTH = 100000;

type NoteInsertPayload = Pick<Note, "user_id" | "markdown_body" | "tags"> &
  Partial<Pick<Note, "title" | "linked_entity_ids">>;

const selectNotes = (state: AppStoreState) => state.notes;
const selectSetNotes = (state: AppStoreState) => state.setNotes;
const selectNotesLoading = (state: AppStoreState) => state.notesLoading;
const selectSelectedNote = (state: AppStoreState) => state.selectedNote;
const selectSetSelectedNote = (state: AppStoreState) => state.setSelectedNote;

export function useNotes(userId: string | undefined) {
  const fetchNotesRef = useRef<() => Promise<void>>(async () => {});

  const crud = useEntityCrud<Note, Partial<Note>>({
    userId,
    items: selectNotes,
    setItems: selectSetNotes,
    loading: selectNotesLoading,
    selected: selectSelectedNote,
    setSelected: selectSetSelectedNote,
    entityLabel: "Note",
    entityPlural: "notes",
    createVerb: "create",
    tableName: "notes",
    onSnapshotMissing: () => {
      void fetchNotesRef.current();
    },
    prepareCreate: (noteData, uid, fail) => {
      if (noteData.markdown_body === undefined) {
        fail("Note content is required");
        return null;
      }

      if (noteData.markdown_body.length > NOTE_BODY_MAX_LENGTH) {
        fail(
          `Note content exceeds ${NOTE_BODY_MAX_LENGTH.toLocaleString()} characters`,
        );
        return null;
      }

      const cleanData: NoteInsertPayload = {
        user_id: uid,
        markdown_body: noteData.markdown_body,
        tags: Array.isArray(noteData.tags) ? noteData.tags : [],
      };

      if (noteData.title && noteData.title.trim()) {
        if (noteData.title.length > NOTE_TITLE_MAX_LENGTH) {
          fail(`Note title exceeds ${NOTE_TITLE_MAX_LENGTH} characters`);
          return null;
        }
        cleanData.title = noteData.title.trim();
      }
      if (
        noteData.linked_entity_ids &&
        Array.isArray(noteData.linked_entity_ids) &&
        noteData.linked_entity_ids.length > 0
      ) {
        cleanData.linked_entity_ids = noteData.linked_entity_ids;
      }

      return cleanData;
    },
    prepareUpdate: (_current, updates, fail) => {
      if (updates.title && updates.title.length > NOTE_TITLE_MAX_LENGTH) {
        fail(`Note title exceeds ${NOTE_TITLE_MAX_LENGTH} characters`);
        return null;
      }

      if (
        updates.markdown_body &&
        updates.markdown_body.length > NOTE_BODY_MAX_LENGTH
      ) {
        fail(
          `Note content exceeds ${NOTE_BODY_MAX_LENGTH.toLocaleString()} characters`,
        );
        return null;
      }

      return updates;
    },
    xpCreate: { reward: XP_REWARDS.CREATE_NOTE, action: "create_note" },
    xpUpdate: {
      reward: XP_REWARDS.UPDATE_NOTE,
      action: "update_note",
      skipXpToast: true,
    },
  });

  const { error } = crud;

  // Item 33 (single loader per table): notes are loaded ONLY by useDataSync.
  // The hook-local duplicate fetch is deleted; manual refresh reuses the
  // single loader via the store retry signal, which useDataSync listens to.
  // Loaded items, ordering, and selected-note sync all come from that path,
  // so behavior is unchanged (this entry point has no production callers —
  // initial load and realtime merges already flow through useDataSync).
  const refreshNotes = useCallback(async () => {
    if (!userId) return;
    useAppStore.getState().retryDataSync("notes");
  }, [userId]);

  fetchNotesRef.current = refreshNotes;

  return {
    notes: crud.items,
    loading: crud.loading,
    error,
    createNote: crud.create,
    updateNote: crud.update,
    deleteNote: crud.delete,
    restoreNote: crud.restore,
    refreshNotes,
  };
}

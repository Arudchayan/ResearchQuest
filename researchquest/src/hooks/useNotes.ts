import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { awardXP, XP_REWARDS } from '../utils/gamification'
import { sortByUpdatedAt } from '../utils/sort'
import { toast } from 'sonner'
import type { Note } from '../types/database'
import { useAppStore } from '../store/appStore'

const NOTE_TITLE_MAX_LENGTH = 255
const NOTE_BODY_MAX_LENGTH = 100000

export function useNotes(userId: string | undefined) {
  // Use global state instead of local state
  const notes = useAppStore(state => state.notes)
  const loading = useAppStore(state => state.notesLoading)
  const setNotes = useAppStore(state => state.setNotes)
  const [error, setError] = useState<string | null>(null)

  // This function is now mainly for refreshing manually if needed,
  // but useDataSync handles the initial fetch and subscriptions.
  const fetchNotes = useCallback(async () => {
    if (!userId) return
    
    const { data, error: fetchError } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
    } else {
      // Data is already sorted by updated_at desc from the DB query above
      setNotes(data || [])
    }
  }, [userId, setNotes])

  const createNote = useCallback(async (noteData: Partial<Note>): Promise<Note | null> => {
    if (!userId) {
      setError('User not authenticated')
      toast.error('You must be logged in to create notes')
      return null
    }

    if (noteData.markdown_body === undefined) {
      setError('Note content is required')
      toast.error('Note content is required')
      return null
    }

    if (noteData.markdown_body.length > NOTE_BODY_MAX_LENGTH) {
      const msg = `Note content exceeds ${NOTE_BODY_MAX_LENGTH.toLocaleString()} characters`
      setError(msg)
      toast.error(msg)
      return null
    }

    const cleanData: any = {
      user_id: userId,
      markdown_body: noteData.markdown_body,
      tags: Array.isArray(noteData.tags) ? noteData.tags : [],
    }

    if (noteData.title && noteData.title.trim()) {
      if (noteData.title.length > NOTE_TITLE_MAX_LENGTH) {
        const msg = `Note title exceeds ${NOTE_TITLE_MAX_LENGTH} characters`
        setError(msg)
        toast.error(msg)
        return null
      }
      cleanData.title = noteData.title.trim()
    }
    if (noteData.linked_entity_ids && Array.isArray(noteData.linked_entity_ids) && noteData.linked_entity_ids.length > 0) {
      cleanData.linked_entity_ids = noteData.linked_entity_ids
    }

    const { data, error: createError } = await supabase
      .from('notes')
      .insert(cleanData)
      .select()
      .single()

    if (createError) {
      const errorMessage = createError.message || 'Unknown error occurred'
      setError(`Failed to create note: ${errorMessage}`)
      toast.error(`Failed to create note: ${errorMessage}`)
      return null
    }

    toast.success('Note created successfully')

    // Optimistic update
    setNotes(sortByUpdatedAt([data, ...useAppStore.getState().notes]))

    awardXP(userId, XP_REWARDS.CREATE_NOTE, 'create_note').catch(console.error)

    return data
  }, [userId, setNotes])

  const updateNote = useCallback(async (noteId: string, updates: Partial<Note>): Promise<boolean> => {
    if (!userId) {
      setError('User not authenticated')
      toast.error('You must be logged in to update notes')
      return false
    }

    if (updates.title && updates.title.length > NOTE_TITLE_MAX_LENGTH) {
      const msg = `Note title exceeds ${NOTE_TITLE_MAX_LENGTH} characters`
      setError(msg)
      toast.error(msg)
      return false
    }

    if (updates.markdown_body && updates.markdown_body.length > NOTE_BODY_MAX_LENGTH) {
      const msg = `Note content exceeds ${NOTE_BODY_MAX_LENGTH.toLocaleString()} characters`
      setError(msg)
      toast.error(msg)
      return false
    }

    // Optimistic update
    const currentNotes = useAppStore.getState().notes
    const previousNotes = [...currentNotes]

    setNotes(sortByUpdatedAt(currentNotes.map(note =>
      note.id === noteId ? { ...note, ...updates, updated_at: new Date().toISOString() } : note
    )))

    const { error: updateError } = await supabase
      .from('notes')
      .update(updates)
      .eq('id', noteId)
      .eq('user_id', userId)

    if (updateError) {
      const errorMessage = updateError.message || 'Unknown error occurred'
      setError(`Failed to update note: ${errorMessage}`)
      toast.error(`Failed to update note: ${errorMessage}`)
      // Revert on error - safely using fresh state
      // Actually, revert to 'previousNotes' is NOT safe if realtime updates happened.
      // But we captured 'previousNotes' just before 'setNotes', synchronously.
      // So 'previousNotes' IS the state before optimistic update.
      // However, if we restore it after async await, we overwrite realtime updates.
      // Correct way: Only revert the specific note.

      const freshNotes = useAppStore.getState().notes
      // Find the note in 'previousNotes' (the original state)
      const originalNote = previousNotes.find(n => n.id === noteId)

      if (originalNote) {
          setNotes(sortByUpdatedAt(freshNotes.map(n => n.id === noteId ? originalNote : n)))
      } else {
          // If note wasn't in previous state (unlikely for update), maybe we shouldn't do anything or re-fetch?
          void fetchNotes()
      }
      return false
    }

    if (userId) {
      awardXP(userId, XP_REWARDS.UPDATE_NOTE, 'update_note').catch(console.error)
    }

    return true
  }, [userId, setNotes, fetchNotes])

  const deleteNote = useCallback(async (noteId: string): Promise<boolean> => {
    if (!userId) {
      setError('User not authenticated')
      toast.error('You must be logged in to delete notes')
      return false
    }

    const currentNotes = useAppStore.getState().notes
    const deletedNote = currentNotes.find((n) => n.id === noteId)

    // Optimistic delete
    setNotes(currentNotes.filter((note) => note.id !== noteId))

    const { error: deleteError } = await supabase
      .from('notes')
      .delete()
      .eq('id', noteId)
      .eq('user_id', userId)

    if (deleteError) {
      const errorMessage = deleteError.message || 'Unknown error occurred'
      setError(`Failed to delete note: ${errorMessage}`)
      toast.error(`Failed to delete note: ${errorMessage}`)

      // Revert on error
      if (deletedNote) {
        setNotes(sortByUpdatedAt([...useAppStore.getState().notes, deletedNote]))
      }
      return false
    }

    return true
  }, [setNotes])

  const restoreNote = useCallback(async (note: Note): Promise<Note | null> => {
    if (!userId) {
      setError('User not authenticated')
      toast.error('You must be logged in to restore notes')
      return null
    }

    const payload = {
      ...note,
      user_id: userId,
      updated_at: new Date().toISOString(),
    }

    const { data, error: restoreError } = await supabase
      .from('notes')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single()

    if (restoreError) {
      const errorMessage = restoreError.message || 'Unknown error occurred'
      toast.error(`Failed to restore note: ${errorMessage}`)
      return null
    }

    const restoredNote = data as Note
    const currentNotes = useAppStore.getState().notes
    setNotes(sortByUpdatedAt([restoredNote, ...currentNotes.filter((existing) => existing.id !== restoredNote.id)]))

    toast.success('Note restored')
    return restoredNote
  }, [setNotes])

  return {
    notes,
    loading,
    error,
    createNote,
    updateNote,
    deleteNote,
    restoreNote,
    refreshNotes: fetchNotes,
  }
}

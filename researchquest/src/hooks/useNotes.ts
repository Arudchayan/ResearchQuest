import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { awardXP, XP_REWARDS } from '../utils/gamification'
import { toast } from 'sonner'
import type { Note } from '../types/database'

function getUpdatedAtTimestamp(value: string | null | undefined): number {
  if (!value) return 0
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function sortByUpdatedAt<T extends { updated_at: string | null | undefined }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => getUpdatedAtTimestamp(b.updated_at) - getUpdatedAtTimestamp(a.updated_at)
  )
}

export function useNotes(userId: string | undefined) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchNotes = useCallback(async () => {
    if (!userId) return
    
    setLoading(true)
    const { data, error: fetchError } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setNotes(sortByUpdatedAt(data || []))
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    if (!userId) {
      setNotes([])
      setLoading(false)
      return
    }

    void fetchNotes()
    
    // Subscribe to realtime updates
    const subscription = supabase
      .channel(`notes_realtime_${userId}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'notes', filter: `user_id=eq.${userId}` },
        (payload) => {
          console.log('Notes realtime update:', payload)
          // Optimistic UI update based on event type
          if (payload.eventType === 'INSERT') {
            // Check if note already exists (from optimistic update) to avoid duplicates
            setNotes(prev => {
              const exists = prev.some(n => n.id === (payload.new as Note).id)
              if (exists) {
                console.log('Note already exists (from optimistic update), skipping realtime insert')
                return sortByUpdatedAt(prev)
              }
              return sortByUpdatedAt([payload.new as Note, ...prev])
            })
          } else if (payload.eventType === 'UPDATE') {
            setNotes(prev => {
              const updatedNote = payload.new as Note
              const remaining = prev.filter(note => note.id !== updatedNote.id)
              return sortByUpdatedAt([updatedNote, ...remaining])
            })
          } else if (payload.eventType === 'DELETE') {
            setNotes(prev => prev.filter(note => note.id !== payload.old.id))
          }
        }
      )
      .subscribe((status) => {
        console.log('Notes subscription status:', status)
      })

    return () => {
      subscription.unsubscribe()
    }
  }, [userId, fetchNotes])

  async function createNote(noteData: Partial<Note>): Promise<Note | null> {
    if (!userId) {
      setError('User not authenticated')
      toast.error('You must be logged in to create notes')
      return null
    }

    // Validate required fields - markdown_body is required, but can be empty
    if (noteData.markdown_body === undefined) {
      setError('Note content is required')
      toast.error('Note content is required')
      return null
    }

    // Clean and prepare the data - only include defined fields
    const cleanData: any = {
      user_id: userId,
      markdown_body: noteData.markdown_body,
      tags: Array.isArray(noteData.tags) ? noteData.tags : [],
    }

    // Only add optional fields if they have values (and trim strings)
    if (noteData.title && noteData.title.trim()) {
      cleanData.title = noteData.title.trim()
    }
    if (noteData.linked_entity_ids && Array.isArray(noteData.linked_entity_ids) && noteData.linked_entity_ids.length > 0) {
      cleanData.linked_entity_ids = noteData.linked_entity_ids
    }

    console.log('Creating note with cleaned data:', cleanData)

    const { data, error: createError } = await supabase
      .from('notes')
      .insert(cleanData)
      .select()
      .single()

    if (createError) {
      console.error('Failed to create note:', createError)
      console.error('Error details:', JSON.stringify(createError, null, 2))
      console.error('Note data that failed:', cleanData)
      
      const errorMessage = createError.message || createError.details || createError.hint || 'Unknown error occurred'
      setError(`Failed to create note: ${errorMessage}`)
      toast.error(`Failed to create note: ${errorMessage}`)
      return null
    }

    console.log('Note created successfully:', data)
    toast.success('Note created successfully')

    // Optimistic update - add to local state immediately
    setNotes(prev => sortByUpdatedAt([data, ...prev]))

    // Award XP (don't await to avoid blocking)
    awardXP(userId, XP_REWARDS.CREATE_NOTE, 'create_note').catch(console.error)
    
    return data
  }

  async function updateNote(noteId: string, updates: Partial<Note>): Promise<boolean> {
    // Optimistic update
    setNotes(prev => {
      const updatedNotes = prev.map(note =>
        note.id === noteId ? { ...note, ...updates, updated_at: new Date().toISOString() } : note
      )
      return sortByUpdatedAt(updatedNotes)
    })

    const { error: updateError } = await supabase
      .from('notes')
      .update(updates)
      .eq('id', noteId)

    if (updateError) {
      console.error('Failed to update note:', updateError)
      console.error('Error details:', JSON.stringify(updateError, null, 2))
      
      const errorMessage = updateError.message || updateError.details || updateError.hint || 'Unknown error occurred'
      setError(`Failed to update note: ${errorMessage}`)
      toast.error(`Failed to update note: ${errorMessage}`)
      // Revert on error
      fetchNotes()
      return false
    }

    // Award XP (don't await to avoid blocking)
    if (userId) {
      awardXP(userId, XP_REWARDS.UPDATE_NOTE, 'update_note').catch(console.error)
    }
    
    return true
  }

  async function deleteNote(noteId: string): Promise<boolean> {
    const deletedNote = notes.find((n) => n.id === noteId)

    // Optimistic delete
    setNotes((prev) => prev.filter((note) => note.id !== noteId))

    const { error: deleteError } = await supabase
      .from('notes')
      .delete()
      .eq('id', noteId)

    if (deleteError) {
      console.error('Failed to delete note:', deleteError)
      console.error('Error details:', JSON.stringify(deleteError, null, 2))

      const errorMessage = deleteError.message || deleteError.details || deleteError.hint || 'Unknown error occurred'
      setError(`Failed to delete note: ${errorMessage}`)
      toast.error(`Failed to delete note: ${errorMessage}`)

      // Revert on error
      if (deletedNote) {
        setNotes((prev) => sortByUpdatedAt([...prev, deletedNote]))
      }
      return false
    }

    return true
  }

  async function restoreNote(note: Note): Promise<Note | null> {
    const payload = {
      ...note,
      updated_at: new Date().toISOString(),
    }

    const { data, error: restoreError } = await supabase
      .from('notes')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single()

    if (restoreError) {
      console.error('Failed to restore note:', restoreError)
      const errorMessage = restoreError.message || restoreError.details || restoreError.hint || 'Unknown error occurred'
      toast.error(`Failed to restore note: ${errorMessage}`)
      return null
    }

    const restoredNote = data as Note
    setNotes((prev) => {
      const remaining = prev.filter((existing) => existing.id !== restoredNote.id)
      return sortByUpdatedAt([restoredNote, ...remaining])
    })

    toast.success('Note restored')
    return restoredNote
  }

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

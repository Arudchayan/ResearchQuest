import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { awardXP, XP_REWARDS } from '../utils/gamification'
import type { Note } from '../types/database'

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
      setNotes(data || [])
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
            setNotes(prev => [payload.new as Note, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setNotes(prev => prev.map(note => 
              note.id === payload.new.id ? payload.new as Note : note
            ))
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
    if (!userId) return null

    const { data, error: createError } = await supabase
      .from('notes')
      .insert({
        ...noteData,
        user_id: userId,
        markdown_body: noteData.markdown_body || '',
        tags: noteData.tags || [],
      })
      .select()
      .single()

    if (createError) {
      setError(createError.message)
      return null
    }

    // Award XP (don't await to avoid blocking)
    awardXP(userId, XP_REWARDS.CREATE_NOTE, 'create_note').catch(console.error)
    
    return data
  }

  async function updateNote(noteId: string, updates: Partial<Note>): Promise<boolean> {
    // Optimistic update
    setNotes(prev => prev.map(note => 
      note.id === noteId ? { ...note, ...updates, updated_at: new Date().toISOString() } : note
    ))

    const { error: updateError } = await supabase
      .from('notes')
      .update(updates)
      .eq('id', noteId)

    if (updateError) {
      setError(updateError.message)
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
    // Optimistic delete
    const deletedNote = notes.find(n => n.id === noteId)
    setNotes(prev => prev.filter(note => note.id !== noteId))

    const { error: deleteError } = await supabase
      .from('notes')
      .delete()
      .eq('id', noteId)

    if (deleteError) {
      setError(deleteError.message)
      // Revert on error
      if (deletedNote) {
        setNotes(prev => [...prev, deletedNote])
      }
      return false
    }

    return true
  }

  return {
    notes,
    loading,
    error,
    createNote,
    updateNote,
    deleteNote,
    refreshNotes: fetchNotes,
  }
}

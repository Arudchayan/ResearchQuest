import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { awardXP, XP_REWARDS } from '../utils/gamification'
import type { Note } from '../types/database'

export function useNotes(userId: string | undefined) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) {
      setNotes([])
      setLoading(false)
      return
    }

    fetchNotes()
    
    // Subscribe to realtime updates
    const subscription = supabase
      .channel('notes_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'notes', filter: `user_id=eq.${userId}` },
        () => {
          fetchNotes()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [userId])

  async function fetchNotes() {
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
  }

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

    // Award XP
    await awardXP(userId, XP_REWARDS.CREATE_NOTE, 'create_note')
    
    return data
  }

  async function updateNote(noteId: string, updates: Partial<Note>): Promise<boolean> {
    const { error: updateError } = await supabase
      .from('notes')
      .update(updates)
      .eq('id', noteId)

    if (updateError) {
      setError(updateError.message)
      return false
    }

    // Award XP
    if (userId) {
      await awardXP(userId, XP_REWARDS.UPDATE_NOTE, 'update_note')
    }
    
    return true
  }

  async function deleteNote(noteId: string): Promise<boolean> {
    const { error: deleteError } = await supabase
      .from('notes')
      .delete()
      .eq('id', noteId)

    if (deleteError) {
      setError(deleteError.message)
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

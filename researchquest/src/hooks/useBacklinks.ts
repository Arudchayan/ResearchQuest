import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Note, Idea } from '../types/database'

export interface BacklinkItem {
  id: string
  title: string
  type: 'note' | 'idea'
  updated_at: string
}

export function useBacklinks(entityId: string | null, entityType: 'note' | 'paper' | 'idea' | null, userId: string | undefined) {
  const [backlinks, setBacklinks] = useState<BacklinkItem[]>([])
  const [loading, setLoading] = useState(false)

  const fetchBacklinks = useCallback(async () => {
    if (!entityId || !entityType || !userId) {
      setBacklinks([])
      return
    }

    setLoading(true)
    const results: BacklinkItem[] = []

    try {
      // Find notes that link to this entity
      // Notes have linked_entity_ids array that can contain any entity ID
      const { data: notesData, error: notesError } = await supabase
        .from('notes')
        .select('id, title, markdown_body, updated_at')
        .eq('user_id', userId)
        .contains('linked_entity_ids', [entityId])

      if (!notesError && notesData) {
        results.push(...notesData.map((note: Note) => ({
          id: note.id,
          title: note.title || note.markdown_body.split('\n')[0]?.replace(/^#+ /, '').trim() || 'Untitled Note',
          type: 'note' as const,
          updated_at: note.updated_at,
        })))
      }

      // Find ideas that link to this entity
      if (entityType === 'note') {
        const { data: ideasData, error: ideasError } = await supabase
          .from('ideas')
          .select('id, title, updated_at')
          .eq('user_id', userId)
          .contains('linked_note_ids', [entityId])

        if (!ideasError && ideasData) {
          results.push(...ideasData.map((idea: Idea) => ({
            id: idea.id,
            title: idea.title,
            type: 'idea' as const,
            updated_at: idea.updated_at,
          })))
        }
      } else if (entityType === 'paper') {
        const { data: ideasData, error: ideasError } = await supabase
          .from('ideas')
          .select('id, title, updated_at')
          .eq('user_id', userId)
          .contains('linked_paper_ids', [entityId])

        if (!ideasError && ideasData) {
          results.push(...ideasData.map((idea: Idea) => ({
            id: idea.id,
            title: idea.title,
            type: 'idea' as const,
            updated_at: idea.updated_at,
          })))
        }
      }

      // Sort by most recently updated
      results.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      
      setBacklinks(results)
    } catch (error) {
      console.error('Error fetching backlinks:', error)
      setBacklinks([])
    } finally {
      setLoading(false)
    }
  }, [entityId, entityType, userId])

  useEffect(() => {
    void fetchBacklinks()
  }, [fetchBacklinks])

  return {
    backlinks,
    loading,
    refresh: fetchBacklinks,
  }
}

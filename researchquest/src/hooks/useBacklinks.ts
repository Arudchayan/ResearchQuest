import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { Idea, Note } from '../types/database'

export interface BacklinkItem {
  id: string
  title: string
  type: 'note' | 'idea'
  updated_at: string
}

export function useBacklinks(entityId: string | null, entityType: 'note' | 'paper' | 'idea' | null, userId: string | undefined) {
  const [backlinks, setBacklinks] = useState<BacklinkItem[]>([])
  const [loading, setLoading] = useState(false)
  const requestIdRef = useRef(0)

  const deriveNoteTitle = useCallback((note: Pick<Note, 'title' | 'markdown_body'>) => {
    if (note.title?.trim()) return note.title

    const markdownHeading =
      typeof note.markdown_body === 'string'
        ? note.markdown_body
            .split('\n')
            .map((line) => line.trim())
            .find((line) => line)
        : null

    return markdownHeading?.replace(/^#+\s*/, '').trim() || 'Untitled Note'
  }, [])

  const fetchBacklinks = useCallback(async () => {
    requestIdRef.current += 1
    const requestId = requestIdRef.current

    if (!entityId || !entityType || !userId) {
      setBacklinks([])
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      const noteQuery = supabase
        .from('notes')
        .select('id, title, markdown_body, updated_at')
        .eq('user_id', userId)
        .contains('linked_entity_ids', [entityId])

      const ideaQuery =
        entityType === 'note'
          ? supabase
              .from('ideas')
              .select('id, title, updated_at')
              .eq('user_id', userId)
              .contains('linked_note_ids', [entityId])
          : entityType === 'paper'
            ? supabase
                .from('ideas')
                .select('id, title, updated_at')
                .eq('user_id', userId)
                .contains('linked_paper_ids', [entityId])
            : null

      const [notesResult, ideasResult] = await Promise.all([
        noteQuery,
        ideaQuery ?? Promise.resolve({ data: null, error: null }),
      ])

      if (requestId !== requestIdRef.current) return

      const results: BacklinkItem[] = []

      if (!notesResult.error && notesResult.data) {
        results.push(
          ...notesResult.data.map((note) => ({
            id: note.id,
            title: deriveNoteTitle(note),
            type: 'note' as const,
            updated_at: note.updated_at,
          })),
        )
      } else if (notesResult.error) {
        console.error('Error fetching note backlinks:', notesResult.error)
      }

      if (ideasResult && !ideasResult.error && ideasResult.data) {
        results.push(
          ...ideasResult.data.map((idea: Idea) => ({
            id: idea.id,
            title: idea.title,
            type: 'idea' as const,
            updated_at: idea.updated_at,
          })),
        )
      } else if (ideasResult?.error) {
        console.error('Error fetching idea backlinks:', ideasResult.error)
      }

      results.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())

      setBacklinks(results)
    } catch (error) {
      console.error('Error fetching backlinks:', error)
      setBacklinks([])
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false)
      }
    }
  }, [deriveNoteTitle, entityId, entityType, userId])

  useEffect(() => {
    void fetchBacklinks()
  }, [fetchBacklinks])

  return {
    backlinks,
    loading,
    refresh: fetchBacklinks,
  }
}

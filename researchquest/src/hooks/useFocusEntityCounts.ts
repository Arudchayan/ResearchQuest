import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface EntityCountState {
  notes: number
  papers: number
  ideas: number
}

interface LocalLengths {
  notes: number
  papers: number
  ideas: number
}

async function fetchCount(table: 'notes' | 'papers' | 'ideas', userId: string): Promise<number | null> {
  const { count, error } = await supabase
    .from(table)
    .select('*', { head: true, count: 'exact' })
    .eq('user_id', userId)

  if (error) {
    console.error(`Failed to fetch ${table} count:`, error)
    return null
  }

  return typeof count === 'number' ? count : null
}

export function useFocusEntityCounts(
  userId: string | undefined,
  localLengths: LocalLengths
): EntityCountState {
  const [counts, setCounts] = useState<EntityCountState>({
    notes: localLengths.notes,
    papers: localLengths.papers,
    ideas: localLengths.ideas,
  })
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    setCounts((prev) => ({
      ...prev,
      notes: localLengths.notes,
      papers: localLengths.papers,
      ideas: localLengths.ideas,
    }))
  }, [localLengths.notes, localLengths.papers, localLengths.ideas])

  const syncCountsFromServer = useCallback(async () => {
    if (!userId) {
      setCounts({ notes: 0, papers: 0, ideas: 0 })
      return
    }

    const [notesCount, papersCount, ideasCount] = await Promise.all([
      fetchCount('notes', userId),
      fetchCount('papers', userId),
      fetchCount('ideas', userId),
    ])

    setCounts((prev) => {
      const next: EntityCountState = { ...prev }

      if (typeof notesCount === 'number') {
        next.notes = notesCount
      } else if (!userId) {
        next.notes = 0
      }

      if (typeof papersCount === 'number') {
        next.papers = papersCount
      } else if (!userId) {
        next.papers = 0
      }

      if (typeof ideasCount === 'number') {
        next.ideas = ideasCount
      } else if (!userId) {
        next.ideas = 0
      }

      return next
    })
  }, [userId])

  useEffect(() => {
    void syncCountsFromServer()

    if (!userId) {
      if (channelRef.current) {
        channelRef.current.unsubscribe()
        channelRef.current = null
      }
      return
    }

    const channel = supabase
      .channel(`focus_entity_counts_${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notes', filter: `user_id=eq.${userId}` },
        () => {
          void syncCountsFromServer()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'papers', filter: `user_id=eq.${userId}` },
        () => {
          void syncCountsFromServer()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ideas', filter: `user_id=eq.${userId}` },
        () => {
          void syncCountsFromServer()
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      channel.unsubscribe()
      if (channelRef.current === channel) {
        channelRef.current = null
      }
    }
  }, [syncCountsFromServer, userId])

  return useMemo(() => counts, [counts])
}

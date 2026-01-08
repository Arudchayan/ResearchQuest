import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../store/appStore'
import type { Note, Paper, Idea } from '../types/database'

export interface RelatedItem {
  id: string
  title: string
  type: 'note' | 'paper' | 'idea'
  sharedTopics: number
  updated_at: string
}

export function useRelatedItems(entityId: string | null, entityType: 'note' | 'paper' | 'idea' | null, userId: string | undefined) {
  const [relatedItems, setRelatedItems] = useState<RelatedItem[]>([])
  const [loading, setLoading] = useState(false)

  // ⚡ PERFORMANCE OPTIMIZATION: Use atomic selectors to avoid unnecessary re-renders
  // and effect executions when unrelated store parts change.
  const notes = useAppStore(state => state.notes)
  const papers = useAppStore(state => state.papers)
  const ideas = useAppStore(state => state.ideas)

  const fetchRelatedItems = useCallback(async () => {
    if (!entityId || !entityType || !userId) {
      setRelatedItems([])
      return
    }

    setLoading(true)

    try {
      // First, get the topics for the current entity
      const topicTable = entityType === 'note' ? 'topic_notes' : entityType === 'paper' ? 'topic_papers' : 'topic_ideas'
      const entityColumn = entityType === 'note' ? 'note_id' : entityType === 'paper' ? 'paper_id' : 'idea_id'

      const { data: currentTopics, error: topicsError } = await supabase
        .from(topicTable)
        .select('topic_id')
        .eq(entityColumn, entityId)

      if (topicsError || !currentTopics || currentTopics.length === 0) {
        setRelatedItems([])
        setLoading(false)
        return
      }

      const topicIds = currentTopics.map(t => t.topic_id)

      // Now find other entities that share these topics
      const relatedMap = new Map<string, { item: RelatedItem, topicCount: number }>()

      // ⚡ PERFORMANCE OPTIMIZATION:
      // Instead of joining with full entity tables (which is slow and fetches redundant data),
      // we fetch only the IDs from the relationship tables and look up the full objects
      // in our global appStore (which is already synced with the DB).

      // Find related notes
      const { data: relatedNotes, error: notesError } = await supabase
        .from('topic_notes')
        .select('note_id, topic_id')
        .in('topic_id', topicIds)
        .neq('note_id', entityType === 'note' ? entityId : '00000000-0000-0000-0000-000000000000')

      if (!notesError && relatedNotes) {
        // Use current store state to ensure we have the latest data
        const currentNotes = useAppStore.getState().notes
        const noteMap = new Map(currentNotes.map(n => [n.id, n]))

        for (const link of relatedNotes) {
          const note = noteMap.get(link.note_id)
          // Store data is already filtered by userId in useDataSync, but we check to be safe
          if (note && note.user_id === userId) {
            const key = `note-${note.id}`
            if (relatedMap.has(key)) {
              relatedMap.get(key)!.topicCount++
            } else {
              relatedMap.set(key, {
                item: {
                  id: note.id,
                  title: note.title || note.markdown_body.split('\n')[0]?.replace(/^#+ /, '').trim() || 'Untitled Note',
                  type: 'note',
                  sharedTopics: 1,
                  updated_at: note.updated_at,
                },
                topicCount: 1,
              })
            }
          }
        }
      }

      // Find related papers
      const { data: relatedPapers, error: papersError } = await supabase
        .from('topic_papers')
        .select('paper_id, topic_id')
        .in('topic_id', topicIds)
        .neq('paper_id', entityType === 'paper' ? entityId : '00000000-0000-0000-0000-000000000000')

      if (!papersError && relatedPapers) {
        const currentPapers = useAppStore.getState().papers
        const paperMap = new Map(currentPapers.map(p => [p.id, p]))

        for (const link of relatedPapers) {
          const paper = paperMap.get(link.paper_id)
          if (paper && paper.user_id === userId) {
            const key = `paper-${paper.id}`
            if (relatedMap.has(key)) {
              relatedMap.get(key)!.topicCount++
            } else {
              relatedMap.set(key, {
                item: {
                  id: paper.id,
                  title: paper.title,
                  type: 'paper',
                  sharedTopics: 1,
                  updated_at: paper.updated_at,
                },
                topicCount: 1,
              })
            }
          }
        }
      }

      // Find related ideas
      const { data: relatedIdeas, error: ideasError } = await supabase
        .from('topic_ideas')
        .select('idea_id, topic_id')
        .in('topic_id', topicIds)
        .neq('idea_id', entityType === 'idea' ? entityId : '00000000-0000-0000-0000-000000000000')

      if (!ideasError && relatedIdeas) {
        const currentIdeas = useAppStore.getState().ideas
        const ideaMap = new Map(currentIdeas.map(i => [i.id, i]))

        for (const link of relatedIdeas) {
          const idea = ideaMap.get(link.idea_id)
          if (idea && idea.user_id === userId) {
            const key = `idea-${idea.id}`
            if (relatedMap.has(key)) {
              relatedMap.get(key)!.topicCount++
            } else {
              relatedMap.set(key, {
                item: {
                  id: idea.id,
                  title: idea.title,
                  type: 'idea',
                  sharedTopics: 1,
                  updated_at: idea.updated_at,
                },
                topicCount: 1,
              })
            }
          }
        }
      }

      // Convert map to array and update shared topic counts
      const finalResults = Array.from(relatedMap.values()).map(({ item, topicCount }) => ({
        ...item,
        sharedTopics: topicCount,
      }))

      // Sort by number of shared topics (desc), then by update time (desc)
      finalResults.sort((a, b) => {
        if (b.sharedTopics !== a.sharedTopics) {
          return b.sharedTopics - a.sharedTopics
        }
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      })

      setRelatedItems(finalResults)
    } catch (error) {
      console.error('Error fetching related items:', error)
      setRelatedItems([])
    } finally {
      setLoading(false)
    }
  }, [entityId, entityType, userId])

  // Re-run when dependencies change.
  // We use the stable atomic values (notes, papers, ideas) to trigger updates
  // only when the relevant data changes.
  useEffect(() => {
    void fetchRelatedItems()
  }, [fetchRelatedItems, notes, papers, ideas])

  return {
    relatedItems,
    loading,
    refresh: fetchRelatedItems,
  }
}

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { awardXP, XP_REWARDS } from '../utils/gamification'
import { toast } from 'sonner'
import type { Idea, IdeaStage } from '../types/database'
import { useAppStore } from '../store/appStore'

export function useIdeas(userId: string | undefined) {
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const setSelectedIdea = useAppStore((state) => state.setSelectedIdea)

  const syncSelectedIdea = useCallback((updated: Idea | null) => {
    if (!updated) return
    const current = useAppStore.getState().selectedIdea
    if (current?.id === updated.id) {
      setSelectedIdea(updated)
    }
  }, [setSelectedIdea])

  const fetchIdeas = useCallback(async () => {
    if (!userId) return

    setLoading(true)
    const { data, error: fetchError } = await supabase
      .from('ideas')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
    } else {
      const rows = data || []
      setIdeas(rows)
      const selected = useAppStore.getState().selectedIdea
      if (selected) {
        const fresh = rows.find((idea) => idea.id === selected.id)
        if (fresh) {
          setSelectedIdea(fresh)
        }
      }
    }
    setLoading(false)
  }, [setSelectedIdea, userId])

  useEffect(() => {
    if (!userId) {
      setIdeas([])
      setLoading(false)
      return
    }

    void fetchIdeas()

    // Subscribe to realtime updates
    const subscription = supabase
      .channel(`ideas_realtime_${userId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'ideas', filter: `user_id=eq.${userId}` },
        (payload) => {
          console.log('Ideas realtime update:', payload)
          // Optimistic UI update based on event type
          if (payload.eventType === 'INSERT') {
            // Check if idea already exists (from optimistic update) to avoid duplicates
            setIdeas(prev => {
              const exists = prev.some(i => i.id === (payload.new as Idea).id)
              if (exists) {
                console.log('Idea already exists (from optimistic update), skipping realtime insert')
                return prev
              }
              const next = [payload.new as Idea, ...prev]
              syncSelectedIdea(payload.new as Idea)
              return next
            })
          } else if (payload.eventType === 'UPDATE') {
            setIdeas(prev => prev.map(idea =>
              idea.id === payload.new.id ? payload.new as Idea : idea
            ))
            syncSelectedIdea(payload.new as Idea)
          } else if (payload.eventType === 'DELETE') {
            setIdeas(prev => prev.filter(idea => idea.id !== payload.old.id))
            const current = useAppStore.getState().selectedIdea
            if (current?.id === payload.old.id) {
              setSelectedIdea(null)
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('Ideas subscription status:', status)
      })

    return () => {
      subscription.unsubscribe()
    }
  }, [fetchIdeas, setSelectedIdea, syncSelectedIdea, userId])

  async function createIdea(ideaData: Partial<Idea>): Promise<Idea | null> {
    if (!userId) {
      setError('User not authenticated')
      toast.error('You must be logged in to create ideas')
      return null
    }

    // Validate required fields
    if (!ideaData.title || !ideaData.title.trim()) {
      setError('Idea title is required')
      toast.error('Idea title is required')
      return null
    }

    const trimmedTitle = ideaData.title.trim()
    let normalizedTitle = trimmedTitle
    let inferredDescription = ideaData.description?.trim() || ''

    if (!inferredDescription) {
      const lineSplit = trimmedTitle.split(/\n+/)
      if (lineSplit.length > 1) {
        const [firstLine, ...rest] = lineSplit
        if (firstLine.trim()) {
          inferredDescription = rest.join(' ').trim()
          normalizedTitle = firstLine.trim()
        }
      }
    }

    if (!inferredDescription) {
      const delimiters = [' — ', ' – ', ' - ', ': ']
      for (const delimiter of delimiters) {
        if (trimmedTitle.includes(delimiter)) {
          const [maybeTitle, maybeDescription] = trimmedTitle.split(delimiter)
          if (maybeTitle.trim() && maybeDescription.trim()) {
            normalizedTitle = maybeTitle.trim()
            inferredDescription = maybeDescription.trim()
            break
          }
        }
      }
    }

    // Clean and prepare the data - only include defined fields
    const cleanData: any = {
      user_id: userId,
      title: normalizedTitle,
      stage: ideaData.stage || 'Seed',
    }

    if (inferredDescription) {
      cleanData.description = inferredDescription
    }

    // Only add optional fields if they have values (and trim strings)
    if (ideaData.linked_note_ids && Array.isArray(ideaData.linked_note_ids) && ideaData.linked_note_ids.length > 0) {
      cleanData.linked_note_ids = ideaData.linked_note_ids
    }
    if (ideaData.linked_paper_ids && Array.isArray(ideaData.linked_paper_ids) && ideaData.linked_paper_ids.length > 0) {
      cleanData.linked_paper_ids = ideaData.linked_paper_ids
    }

    console.log('Creating idea with cleaned data:', cleanData)

    const { data, error: createError } = await supabase
      .from('ideas')
      .insert(cleanData)
      .select()
      .single()

    if (createError) {
      console.error('Failed to create idea:', createError)
      console.error('Error details:', JSON.stringify(createError, null, 2))
      console.error('Idea data that failed:', cleanData)
      
      const errorMessage = createError.message || createError.details || createError.hint || 'Unknown error occurred'
      setError(`Failed to create idea: ${errorMessage}`)
      toast.error(`Failed to create idea: ${errorMessage}`)
      return null
    }

    console.log('Idea created successfully:', data)
    toast.success('Idea created successfully')

    // Optimistic update - add to local state immediately
    setIdeas(prev => [data, ...prev])

    // Award XP (don't await to avoid blocking)
    awardXP(userId, XP_REWARDS.CREATE_IDEA, 'create_idea').catch(console.error)

    return data
  }

  async function updateIdea(ideaId: string, updates: Partial<Idea>, oldStage?: IdeaStage): Promise<boolean> {
    // Optimistic update
    let optimisticSnapshot: Idea | null = null
    setIdeas(prev => prev.map(idea => {
      if (idea.id === ideaId) {
        optimisticSnapshot = idea
        const optimistic: Idea = {
          ...idea,
          ...updates,
          updated_at: new Date().toISOString(),
        }
        syncSelectedIdea(optimistic)
        return optimistic
      }
      return idea
    }))

    const { data, error: updateError } = await supabase
      .from('ideas')
      .update(updates)
      .eq('id', ideaId)
      .select()
      .single()

    if (updateError) {
      console.error('Failed to update idea:', updateError)
      console.error('Error details:', JSON.stringify(updateError, null, 2))

      const errorMessage = updateError.message || updateError.details || updateError.hint || 'Unknown error occurred'
      setError(`Failed to update idea: ${errorMessage}`)
      toast.error(`Failed to update idea: ${errorMessage}`)
      // Revert on error
      if (optimisticSnapshot) {
        setIdeas(prev => prev.map(idea =>
          idea.id === ideaId ? optimisticSnapshot as Idea : idea
        ))
        syncSelectedIdea(optimisticSnapshot)
      } else {
        void fetchIdeas()
      }
      return false
    }

    if (data) {
      setIdeas(prev => prev.map(idea =>
        idea.id === data.id ? data : idea
      ))
      syncSelectedIdea(data as Idea)
    }

    if (updates.stage) {
      toast.success(`Idea stage updated to ${updates.stage}`)
    }

    // Award XP if stage advanced (don't await to avoid blocking)
    if (updates.stage && oldStage && updates.stage !== oldStage && userId) {
      const stages: IdeaStage[] = ['Seed', 'Developing', 'Supported', 'Mature']
      const oldIndex = stages.indexOf(oldStage)
      const newIndex = stages.indexOf(updates.stage)
      
      if (newIndex > oldIndex) {
        awardXP(userId, XP_REWARDS.ADVANCE_IDEA_STAGE, 'advance_idea_stage').catch(console.error)
      }
    }

    return true
  }

  async function deleteIdea(ideaId: string): Promise<boolean> {
    // Optimistic delete
    const deletedIdea = ideas.find(i => i.id === ideaId)
    setIdeas(prev => prev.filter(idea => idea.id !== ideaId))
    const current = useAppStore.getState().selectedIdea
    if (current?.id === ideaId) {
      setSelectedIdea(null)
    }

    const { error: deleteError } = await supabase
      .from('ideas')
      .delete()
      .eq('id', ideaId)

    if (deleteError) {
      console.error('Failed to delete idea:', deleteError)
      console.error('Error details:', JSON.stringify(deleteError, null, 2))

      const errorMessage = deleteError.message || deleteError.details || deleteError.hint || 'Unknown error occurred'
      setError(`Failed to delete idea: ${errorMessage}`)
      toast.error(`Failed to delete idea: ${errorMessage}`)
      // Revert on error
      if (deletedIdea) {
        setIdeas(prev => [...prev, deletedIdea])
        syncSelectedIdea(deletedIdea)
      }
      return false
    }

    toast.success('Idea deleted')
    return true
  }

  return {
    ideas,
    loading,
    error,
    createIdea,
    updateIdea,
    deleteIdea,
    refreshIdeas: fetchIdeas,
  }
}

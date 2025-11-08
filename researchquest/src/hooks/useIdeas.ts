import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { awardXP, XP_REWARDS } from '../utils/gamification'
import { toast } from 'sonner'
import type { Idea, IdeaStage } from '../types/database'

export function useIdeas(userId: string | undefined) {
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
      setIdeas(data || [])
    }
    setLoading(false)
  }, [userId])

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
              return [payload.new as Idea, ...prev]
            })
          } else if (payload.eventType === 'UPDATE') {
            setIdeas(prev => prev.map(idea => 
              idea.id === payload.new.id ? payload.new as Idea : idea
            ))
          } else if (payload.eventType === 'DELETE') {
            setIdeas(prev => prev.filter(idea => idea.id !== payload.old.id))
          }
        }
      )
      .subscribe((status) => {
        console.log('Ideas subscription status:', status)
      })

    return () => {
      subscription.unsubscribe()
    }
  }, [userId, fetchIdeas])

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

    // Clean and prepare the data - only include defined fields
    const cleanData: any = {
      user_id: userId,
      title: ideaData.title.trim(),
      stage: ideaData.stage || 'Seed',
    }

    // Only add optional fields if they have values (and trim strings)
    if (ideaData.description && ideaData.description.trim()) {
      cleanData.description = ideaData.description.trim()
    }
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
    setIdeas(prev => prev.map(idea => 
      idea.id === ideaId ? { ...idea, ...updates, updated_at: new Date().toISOString() } : idea
    ))

    const { error: updateError } = await supabase
      .from('ideas')
      .update(updates)
      .eq('id', ideaId)

    if (updateError) {
      console.error('Failed to update idea:', updateError)
      console.error('Error details:', JSON.stringify(updateError, null, 2))
      
      const errorMessage = updateError.message || updateError.details || updateError.hint || 'Unknown error occurred'
      setError(`Failed to update idea: ${errorMessage}`)
      toast.error(`Failed to update idea: ${errorMessage}`)
      // Revert on error
      fetchIdeas()
      return false
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

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
            setIdeas(prev => [payload.new as Idea, ...prev])
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
      toast.error('You must be logged in to create ideas')
      return null
    }

    const { data, error: createError } = await supabase
      .from('ideas')
      .insert({
        ...ideaData,
        user_id: userId,
        stage: ideaData.stage || 'Seed',
      })
      .select()
      .single()

    if (createError) {
      setError(createError.message)
      toast.error('Failed to create idea')
      return null
    }

    toast.success('Idea created successfully')
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
      setError(updateError.message)
      toast.error('Failed to update idea')
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
      setError(deleteError.message)
      toast.error('Failed to delete idea')
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

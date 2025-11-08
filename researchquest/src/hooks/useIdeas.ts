import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { awardXP, XP_REWARDS } from '../utils/gamification'
import type { Idea, IdeaStage } from '../types/database'

export function useIdeas(userId: string | undefined) {
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) {
      setIdeas([])
      setLoading(false)
      return
    }

    fetchIdeas()

    // Subscribe to realtime updates
    const subscription = supabase
      .channel('ideas_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'ideas', filter: `user_id=eq.${userId}` },
        () => {
          fetchIdeas()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [userId])

  async function fetchIdeas() {
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
  }

  async function createIdea(ideaData: Partial<Idea>): Promise<Idea | null> {
    if (!userId) return null

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
      return null
    }

    // Award XP
    await awardXP(userId, XP_REWARDS.CREATE_IDEA, 'create_idea')

    return data
  }

  async function updateIdea(ideaId: string, updates: Partial<Idea>, oldStage?: IdeaStage): Promise<boolean> {
    const { error: updateError } = await supabase
      .from('ideas')
      .update(updates)
      .eq('id', ideaId)

    if (updateError) {
      setError(updateError.message)
      return false
    }

    // Award XP if stage advanced
    if (updates.stage && oldStage && updates.stage !== oldStage && userId) {
      const stages: IdeaStage[] = ['Seed', 'Developing', 'Supported', 'Mature']
      const oldIndex = stages.indexOf(oldStage)
      const newIndex = stages.indexOf(updates.stage)
      
      if (newIndex > oldIndex) {
        await awardXP(userId, XP_REWARDS.ADVANCE_IDEA_STAGE, 'advance_idea_stage')
      }
    }

    return true
  }

  async function deleteIdea(ideaId: string): Promise<boolean> {
    const { error: deleteError } = await supabase
      .from('ideas')
      .delete()
      .eq('id', ideaId)

    if (deleteError) {
      setError(deleteError.message)
      return false
    }

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

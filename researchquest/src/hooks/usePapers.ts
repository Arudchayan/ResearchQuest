import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { awardXP, XP_REWARDS } from '../utils/gamification'
import type { Paper, CrossrefPaper } from '../types/database'

export function usePapers(userId: string | undefined) {
  const [papers, setPapers] = useState<Paper[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) {
      setPapers([])
      setLoading(false)
      return
    }

    fetchPapers()

    // Subscribe to realtime updates
    const subscription = supabase
      .channel('papers_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'papers', filter: `user_id=eq.${userId}` },
        () => {
          fetchPapers()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [userId])

  async function fetchPapers() {
    if (!userId) return

    setLoading(true)
    const { data, error: fetchError } = await supabase
      .from('papers')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setPapers(data || [])
    }
    setLoading(false)
  }

  async function searchPaperByDOI(doi: string): Promise<CrossrefPaper | null> {
    try {
      const response = await supabase.functions.invoke('fetch-paper', {
        body: { doi },
      })

      if (response.error) {
        setError(response.error.message)
        return null
      }

      return response.data?.data || null
    } catch (err: any) {
      setError(err.message)
      return null
    }
  }

  async function searchPapersByQuery(query: string): Promise<CrossrefPaper[]> {
    try {
      const response = await supabase.functions.invoke('fetch-paper', {
        body: { query },
      })

      if (response.error) {
        setError(response.error.message)
        return []
      }

      return response.data?.data || []
    } catch (err: any) {
      setError(err.message)
      return []
    }
  }

  async function createPaper(paperData: Partial<Paper>): Promise<Paper | null> {
    if (!userId) {
      setError('User not authenticated')
      return null
    }

    console.log('Creating paper with data:', { ...paperData, user_id: userId })
    
    const { data, error: createError } = await supabase
      .from('papers')
      .insert({
        ...paperData,
        user_id: userId,
        authors: paperData.authors || [],
        status: paperData.status || 'To Read',
      })
      .select()
      .single()

    if (createError) {
      console.error('Failed to create paper:', createError)
      setError(`Failed to create paper: ${createError.message}`)
      return null
    }

    console.log('Paper created successfully:', data)

    // Award XP (don't let this fail the paper creation)
    try {
      await awardXP(userId, XP_REWARDS.CREATE_PAPER, 'create_paper')
      console.log('XP awarded successfully')
    } catch (xpError) {
      console.error('Failed to award XP:', xpError)
      // Don't fail paper creation if XP awarding fails
    }

    return data
  }

  async function updatePaper(paperId: string, updates: Partial<Paper>): Promise<boolean> {
    const { error: updateError } = await supabase
      .from('papers')
      .update(updates)
      .eq('id', paperId)

    if (updateError) {
      setError(updateError.message)
      return false
    }

    // Award XP if status changed
    if (updates.status && userId) {
      await awardXP(userId, XP_REWARDS.UPDATE_PAPER_STATUS, 'update_paper_status')
    }

    return true
  }

  async function deletePaper(paperId: string): Promise<boolean> {
    const { error: deleteError } = await supabase
      .from('papers')
      .delete()
      .eq('id', paperId)

    if (deleteError) {
      setError(deleteError.message)
      return false
    }

    return true
  }

  return {
    papers,
    loading,
    error,
    searchPaperByDOI,
    searchPapersByQuery,
    createPaper,
    updatePaper,
    deletePaper,
    refreshPapers: fetchPapers,
  }
}

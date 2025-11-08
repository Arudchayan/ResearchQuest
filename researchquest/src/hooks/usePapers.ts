import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { awardXP, XP_REWARDS } from '../utils/gamification'
import { toast } from 'sonner'
import type { Paper, CrossrefPaper } from '../types/database'

export function usePapers(userId: string | undefined) {
  const [papers, setPapers] = useState<Paper[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPapers = useCallback(async () => {
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
  }, [userId])

  useEffect(() => {
    if (!userId) {
      setPapers([])
      setLoading(false)
      return
    }

    void fetchPapers()

    // Subscribe to realtime updates
    const subscription = supabase
      .channel(`papers_realtime_${userId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'papers', filter: `user_id=eq.${userId}` },
        (payload) => {
          console.log('Papers realtime update:', payload)
          // Optimistic UI update based on event type
          if (payload.eventType === 'INSERT') {
            setPapers(prev => [payload.new as Paper, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setPapers(prev => prev.map(paper => 
              paper.id === payload.new.id ? payload.new as Paper : paper
            ))
          } else if (payload.eventType === 'DELETE') {
            setPapers(prev => prev.filter(paper => paper.id !== payload.old.id))
          }
        }
      )
      .subscribe((status) => {
        console.log('Papers subscription status:', status)
      })

    return () => {
      subscription.unsubscribe()
    }
  }, [userId, fetchPapers])

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
      toast.error('You must be logged in to add papers')
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
      toast.error('Failed to add paper')
      return null
    }

    console.log('Paper created successfully:', data)
    toast.success('Paper added successfully')

    // Award XP (don't await to avoid blocking)
    awardXP(userId, XP_REWARDS.CREATE_PAPER, 'create_paper').catch(console.error)

    return data
  }

  async function updatePaper(paperId: string, updates: Partial<Paper>): Promise<boolean> {
    // Optimistic update
    setPapers(prev => prev.map(paper => 
      paper.id === paperId ? { ...paper, ...updates, updated_at: new Date().toISOString() } : paper
    ))

    const { error: updateError } = await supabase
      .from('papers')
      .update(updates)
      .eq('id', paperId)

    if (updateError) {
      setError(updateError.message)
      toast.error('Failed to update paper')
      // Revert on error
      fetchPapers()
      return false
    }

    if (updates.status) {
      toast.success(`Paper marked as ${updates.status}`)
    }

    // Award XP if status changed (don't await to avoid blocking)
    if (updates.status && userId) {
      awardXP(userId, XP_REWARDS.UPDATE_PAPER_STATUS, 'update_paper_status').catch(console.error)
    }

    return true
  }

  async function deletePaper(paperId: string): Promise<boolean> {
    // Optimistic delete
    const deletedPaper = papers.find(p => p.id === paperId)
    setPapers(prev => prev.filter(paper => paper.id !== paperId))

    const { error: deleteError } = await supabase
      .from('papers')
      .delete()
      .eq('id', paperId)

    if (deleteError) {
      setError(deleteError.message)
      toast.error('Failed to delete paper')
      // Revert on error
      if (deletedPaper) {
        setPapers(prev => [...prev, deletedPaper])
      }
      return false
    }

    toast.success('Paper deleted')
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

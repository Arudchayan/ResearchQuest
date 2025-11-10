import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { awardXP, XP_REWARDS } from '../utils/gamification'
import { toast } from 'sonner'
import type { Paper, CrossrefPaper } from '../types/database'

function extractFunctionErrorMessage(error: any, fallback: string): string {
  if (!error) return fallback

  const candidates: any[] = []

  if (error.context) {
    const context = error.context
    candidates.push(context.body, context.response)
    if (context.response) {
      candidates.push(context.response.error, context.response.data)
    }
  }

  if (error.error) {
    candidates.push(error.error)
  }

  for (const candidate of candidates) {
    if (!candidate) continue
    if (typeof candidate === 'string') {
      if (candidate.trim()) return candidate
      continue
    }

    if (typeof candidate.message === 'string' && candidate.message.trim()) {
      return candidate.message.trim()
    }

    if (candidate.error) {
      if (typeof candidate.error === 'string' && candidate.error.trim()) {
        return candidate.error.trim()
      }

      if (typeof candidate.error.message === 'string' && candidate.error.message.trim()) {
        return candidate.error.message.trim()
      }

      if (typeof candidate.error.details === 'string' && candidate.error.details.trim()) {
        return candidate.error.details.trim()
      }
    }

    if (typeof candidate.details === 'string' && candidate.details.trim()) {
      return candidate.details.trim()
    }
  }

  if (typeof error.message === 'string' && error.message.trim()) {
    return error.message.trim()
  }

  return fallback
}

function getUpdatedAtTimestamp(value: string | null | undefined): number {
  if (!value) return 0
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function sortByUpdatedAt<T extends { updated_at: string | null | undefined }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => getUpdatedAtTimestamp(b.updated_at) - getUpdatedAtTimestamp(a.updated_at)
  )
}

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
      setPapers(sortByUpdatedAt(data || []))
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
            setPapers(prev => sortByUpdatedAt([payload.new as Paper, ...prev]))
          } else if (payload.eventType === 'UPDATE') {
            setPapers(prev => {
              const updatedPaper = payload.new as Paper
              const remaining = prev.filter(paper => paper.id !== updatedPaper.id)
              return sortByUpdatedAt([updatedPaper, ...remaining])
            })
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
    if (!doi.trim()) {
      setError('Please enter a DOI to search')
      return null
    }

    try {
      const response = await supabase.functions.invoke('fetch-paper', {
        body: { doi },
      })

      if (response.error) {
        const errorMessage = extractFunctionErrorMessage(response.error, 'Failed to search for paper')
        setError(errorMessage)
        toast.error(errorMessage)
        return null
      }

      if (response.data?.error) {
        const errorMessage = response.data.error.message || 'Failed to search for paper'
        setError(errorMessage)
        toast.error(errorMessage)
        return null
      }

      return response.data?.data || null
    } catch (err: any) {
      const errorMessage = err.message || 'An error occurred while searching'
      setError(errorMessage)
      toast.error(errorMessage)
      return null
    }
  }

  async function searchPapersByQuery(query: string): Promise<CrossrefPaper[]> {
    if (!query.trim()) {
      setError('Please enter a search query')
      return []
    }

    try {
      const response = await supabase.functions.invoke('fetch-paper', {
        body: { query },
      })

      if (response.error) {
        const errorMessage = extractFunctionErrorMessage(response.error, 'Failed to search for papers')
        setError(errorMessage)
        toast.error(errorMessage)
        return []
      }

      if (response.data?.error) {
        const errorMessage = response.data.error.message || 'Failed to search for papers'
        setError(errorMessage)
        toast.error(errorMessage)
        return []
      }

      return response.data?.data || []
    } catch (err: any) {
      const errorMessage = err.message || 'An error occurred while searching'
      setError(errorMessage)
      toast.error(errorMessage)
      return []
    }
  }

  async function createPaper(paperData: Partial<Paper>): Promise<Paper | null> {
    if (!userId) {
      setError('User not authenticated')
      toast.error('You must be logged in to add papers')
      return null
    }

    // Validate required fields
    if (!paperData.title || !paperData.title.trim()) {
      setError('Paper title is required')
      toast.error('Paper title is required')
      return null
    }

    // Clean and prepare the data - only include defined fields
    const cleanData: any = {
      user_id: userId,
      title: paperData.title.trim(),
      authors: Array.isArray(paperData.authors) ? paperData.authors : [],
      status: paperData.status || 'To Read',
    }

    // Only add optional fields if they have values (and are not empty strings)
    if (paperData.doi && paperData.doi.trim()) cleanData.doi = paperData.doi.trim()
    if (paperData.source_url && paperData.source_url.trim()) cleanData.source_url = paperData.source_url.trim()
    if (paperData.abstract && paperData.abstract.trim()) cleanData.abstract = paperData.abstract.trim()
    
    // Handle publication_date - convert year to proper date format if needed
    if (paperData.publication_date && paperData.publication_date.trim() && paperData.publication_date !== 'null') {
      const pubDate = paperData.publication_date.trim()
      // If it's just a year (4 digits), convert to YYYY-01-01 format
      if (/^\d{4}$/.test(pubDate)) {
        cleanData.publication_date = `${pubDate}-01-01`
      } else {
        cleanData.publication_date = pubDate
      }
    }
    
    if (paperData.topic_ids && Array.isArray(paperData.topic_ids) && paperData.topic_ids.length > 0) {
      cleanData.topic_ids = paperData.topic_ids
    }

    console.log('Creating paper with cleaned data:', cleanData)
    console.log('User ID:', userId)
    
    const { data, error: createError } = await supabase
      .from('papers')
      .insert(cleanData)
      .select()
      .single()

    if (createError) {
      console.error('Failed to create paper - Full error object:', createError)
      console.error('Error code:', createError.code)
      console.error('Error message:', createError.message)
      console.error('Error details:', createError.details)
      console.error('Error hint:', createError.hint)
      console.error('Error stringified:', JSON.stringify(createError, null, 2))
      console.error('Paper data that failed:', cleanData)
      
      // Extract meaningful error message
      let errorMessage = 'Unknown error occurred'
      if (createError.message) {
        errorMessage = createError.message
      } else if (createError.details) {
        errorMessage = createError.details
      } else if (createError.hint) {
        errorMessage = createError.hint
      } else if (typeof createError === 'string') {
        errorMessage = createError
      } else if (createError.code) {
        errorMessage = `Database error (code: ${createError.code})`
      }
      
      setError(`Failed to create paper: ${errorMessage}`)
      toast.error(`Failed to add paper: ${errorMessage}`, { duration: 5000 })
      return null
    }

    console.log('Paper created successfully:', data)
    toast.success('Paper added successfully')

    // Optimistic update - add to local state immediately
    setPapers(prev => sortByUpdatedAt([data, ...prev]))

    // Award XP (don't await to avoid blocking)
    awardXP(userId, XP_REWARDS.CREATE_PAPER, 'create_paper').catch(console.error)

    return data
  }

  async function updatePaper(paperId: string, updates: Partial<Paper>): Promise<boolean> {
    // Optimistic update
    setPapers(prev => {
      const updatedPapers = prev.map(paper =>
        paper.id === paperId ? { ...paper, ...updates, updated_at: new Date().toISOString() } : paper
      )
      return sortByUpdatedAt(updatedPapers)
    })

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
        setPapers(prev => sortByUpdatedAt([...prev, deletedPaper]))
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

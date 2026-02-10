import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { awardXP, XP_REWARDS } from '../utils/gamification'
import { sortByUpdatedAt } from '../utils/sort'
import { isValidUrl } from '../utils/security'
import { toast } from 'sonner'
import type { Paper, CrossrefPaper } from '../types/database'
import { useAppStore } from '../store/appStore'

// Helper function to create a reading task for a newly added paper
async function createReadingTaskForPaper(userId: string, paper: Paper): Promise<void> {
  try {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('auto_create_reading_tasks')
      .eq('id', userId)
      .single()

    const autoCreateEnabled = profile?.auto_create_reading_tasks !== false

    if (!autoCreateEnabled) {
      return
    }

    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 7)
    const dueDateString = dueDate.toISOString().split('T')[0]

    const paperTitle = paper.title.length > 50 
      ? `${paper.title.substring(0, 47)}...` 
      : paper.title

    const { error } = await supabase
      .from('tasks')
      .insert({
        user_id: userId,
        title: `Read: ${paperTitle}`,
        description: `Review and take notes on this paper. ${paper.authors.length > 0 ? `Authors: ${paper.authors.slice(0, 3).join(', ')}${paper.authors.length > 3 ? ', et al.' : ''}` : ''}`,
        priority: 'medium',
        category: 'Reading',
        due_date: dueDateString,
        completed: false,
      })

    if (error) {
      // 🛡️ Security: Log only the message, not the full error object
      console.error('Failed to create reading task:', error.message)
    } else {
      toast.success('Reading task created', {
        description: `Due in 7 days - check your Tasks`,
        duration: 2000,
      })
    }
  } catch (error: any) {
    // 🛡️ Security: Log only the message, not the full error object
    console.error('Error creating reading task:', error?.message || 'Unknown error')
  }
}

export interface PaperSearchOptions {
  rows?: number
  sort?: 'score' | 'published' | 'created' | 'updated' | 'indexed'
  order?: 'asc' | 'desc'
}

function extractFunctionErrorMessage(error: any, fallback: string): string {
  if (!error) return fallback

  // 🛡️ Security: Simplified error extraction to prevent leaking internal details like 'details', 'hint', or full stack traces.
  // We prioritize 'message' properties.

  const candidates: any[] = []

  // Check top-level message
  if (typeof error === 'string') return error.trim() || fallback
  if (error.message) candidates.push(error.message)

  // Check context (Supabase Edge Functions)
  if (error.context?.response?.error) {
      candidates.push(error.context.response.error)
  }

  for (const candidate of candidates) {
      if (!candidate) continue
      if (typeof candidate === 'string') return candidate.trim()
      if (typeof candidate.message === 'string') return candidate.message.trim()
  }

  return fallback
}

export function usePapers(userId: string | undefined) {
  const papers = useAppStore(state => state.papers)
  const loading = useAppStore(state => state.papersLoading)
  const setPapers = useAppStore(state => state.setPapers)
  const setSelectedPaper = useAppStore((state) => state.setSelectedPaper)
  const [error, setError] = useState<string | null>(null)

  const syncSelectedPaper = useCallback((updated: Paper | null) => {
    if (!updated) return
    const current = useAppStore.getState().selectedPaper
    if (current?.id === updated.id) {
      setSelectedPaper(updated)
    }
  }, [setSelectedPaper])

  const fetchPapers = useCallback(async () => {
    if (!userId) return

    const { data, error: fetchError } = await supabase
      .from('papers')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
    } else {
      const sorted = sortByUpdatedAt(data || [])
      setPapers(sorted)
      const selected = useAppStore.getState().selectedPaper
      if (selected) {
        const fresh = sorted.find((paper) => paper.id === selected.id)
        if (fresh) {
          setSelectedPaper(fresh)
        }
      }
    }
  }, [userId, setPapers, setSelectedPaper])

  const searchPaperByDOI = useCallback(async (doi: string): Promise<CrossrefPaper | null> => {
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
  }, [])

  const searchPapersByQuery = useCallback(async (query: string, options: PaperSearchOptions = {}): Promise<CrossrefPaper[]> => {
    if (!query.trim()) {
      setError('Please enter a search query')
      return []
    }

    try {
      const response = await supabase.functions.invoke('fetch-paper', {
        body: {
          query,
          rows: options.rows,
          sort: options.sort,
          order: options.order,
        },
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
  }, [])

  const createPaper = useCallback(async (paperData: Partial<Paper>): Promise<Paper | null> => {
    if (!userId) {
      setError('User not authenticated')
      toast.error('You must be logged in to add papers')
      return null
    }

    if (!paperData.title || !paperData.title.trim()) {
      setError('Paper title is required')
      toast.error('Paper title is required')
      return null
    }

    const cleanData: any = {
      user_id: userId,
      title: paperData.title.trim(),
      authors: Array.isArray(paperData.authors) ? paperData.authors : [],
      status: paperData.status || 'To Read',
    }

    if (paperData.doi && paperData.doi.trim()) cleanData.doi = paperData.doi.trim()
    if (paperData.source_url && paperData.source_url.trim()) {
      const url = paperData.source_url.trim()
      if (isValidUrl(url)) {
        cleanData.source_url = url
      }
    }
    if (paperData.abstract && paperData.abstract.trim()) cleanData.abstract = paperData.abstract.trim()
    
    if (paperData.publication_date && paperData.publication_date.trim() && paperData.publication_date !== 'null') {
      const pubDate = paperData.publication_date.trim()
      if (/^\d{4}$/.test(pubDate)) {
        cleanData.publication_date = `${pubDate}-01-01`
      } else {
        cleanData.publication_date = pubDate
      }
    }
    
    if (paperData.topic_ids && Array.isArray(paperData.topic_ids) && paperData.topic_ids.length > 0) {
      cleanData.topic_ids = paperData.topic_ids
    }
    
    const { data, error: createError } = await supabase
      .from('papers')
      .insert(cleanData)
      .select()
      .single()

    if (createError) {
      // 🛡️ Security: Only expose the error message or code, not internal details/hints
      const errorMessage = createError.message || (createError.code ? `Error ${createError.code}` : 'Unknown error occurred')
      
      setError(`Failed to create paper: ${errorMessage}`)
      toast.error(`Failed to add paper: ${errorMessage}`, { duration: 5000 })
      return null
    }

    toast.success('Paper added successfully')

    // Optimistic update - get latest state to be safe
    setPapers(sortByUpdatedAt([data, ...useAppStore.getState().papers]))

    awardXP(userId, XP_REWARDS.CREATE_PAPER, 'create_paper').catch((e) => console.error(e?.message))
    
    void createReadingTaskForPaper(userId, data)
    
    return data
  }, [userId, setPapers])

  const updatePaper = useCallback(async (paperId: string, updates: Partial<Paper>): Promise<boolean> => {
    if (!userId) {
      setError('User not authenticated')
      toast.error('You must be logged in to update papers')
      return false
    }

    if (updates.source_url) {
      const url = updates.source_url.trim()
      if (isValidUrl(url)) {
        updates.source_url = url
      } else {
        delete updates.source_url
      }
    }

    let optimisticSnapshot: Paper | null = null
    const papers = useAppStore.getState().papers // Get fresh state

    setPapers(sortByUpdatedAt(papers.map(paper => {
        if (paper.id === paperId) {
          optimisticSnapshot = paper
          const optimistic: Paper = {
            ...paper,
            ...updates,
            updated_at: new Date().toISOString(),
          }
          syncSelectedPaper(optimistic)
          return optimistic
        }
        return paper
      })))

    const { data, error: updateError } = await supabase
      .from('papers')
      .update(updates)
      .eq('id', paperId)
      .eq('user_id', userId)
      .select()
      .single()

    if (updateError) {
      setError(updateError.message)
      toast.error('Failed to update paper')
      if (optimisticSnapshot) {
        // Revert safely by using current state
        const currentPapers = useAppStore.getState().papers
        setPapers(sortByUpdatedAt(currentPapers.map(p =>
          p.id === paperId ? optimisticSnapshot as Paper : p
        )))
        syncSelectedPaper(optimisticSnapshot)
      }
      return false
    }

    if (data) {
       // Update with confirmed data safely
       const currentPapers = useAppStore.getState().papers
       setPapers(sortByUpdatedAt(currentPapers.map(paper =>
          paper.id === data.id ? data : paper
        )))
      syncSelectedPaper(data as Paper)
    }

    if (updates.status) {
      toast.success(`Paper marked as ${updates.status}`)
    }

    if (updates.status && userId) {
      awardXP(userId, XP_REWARDS.UPDATE_PAPER_STATUS, 'update_paper_status').catch((e) => console.error(e?.message))
    }

    return true
  }, [userId, setPapers, syncSelectedPaper])

  const deletePaper = useCallback(async (paperId: string): Promise<boolean> => {
    if (!userId) {
      setError('User not authenticated')
      toast.error('You must be logged in to delete papers')
      return false
    }

    const papers = useAppStore.getState().papers // Get fresh state
    const deletedPaper = papers.find(p => p.id === paperId)

    setPapers(papers.filter(paper => paper.id !== paperId))
    const current = useAppStore.getState().selectedPaper
    if (current?.id === paperId) {
      setSelectedPaper(null)
    }

    const { error: deleteError } = await supabase
      .from('papers')
      .delete()
      .eq('id', paperId)
      .eq('user_id', userId)

    if (deleteError) {
      setError(deleteError.message)
      toast.error('Failed to delete paper')
      // Revert on error safely
      if (deletedPaper) {
        const currentPapers = useAppStore.getState().papers
        setPapers(sortByUpdatedAt([...currentPapers, deletedPaper]))
        syncSelectedPaper(deletedPaper)
      }
      return false
    }

    return true
  }, [userId, setPapers, setSelectedPaper, syncSelectedPaper])

  const restorePaper = useCallback(async (paper: Paper): Promise<Paper | null> => {
    if (!userId) {
      setError('User not authenticated')
      toast.error('You must be logged in to restore papers')
      return null
    }

    const payload = {
      ...paper,
      user_id: userId,
      updated_at: new Date().toISOString(),
    }

    const { data, error: restoreError } = await supabase
      .from('papers')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single()

    if (restoreError) {
      const errorMessage = restoreError.message || 'Unknown error occurred'
      toast.error(`Failed to restore paper: ${errorMessage}`)
      return null
    }

    const restoredPaper = data as Paper
    const currentPapers = useAppStore.getState().papers
    setPapers(sortByUpdatedAt([restoredPaper, ...currentPapers.filter((existing) => existing.id !== restoredPaper.id)]))

    toast.success('Paper restored')
    return restoredPaper
  }, [userId, setPapers])

  return {
    papers,
    loading,
    error,
    searchPaperByDOI,
    searchPapersByQuery,
    createPaper,
    updatePaper,
    deletePaper,
    restorePaper,
    refreshPapers: fetchPapers,
  }
}

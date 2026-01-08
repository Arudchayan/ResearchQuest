import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { awardXP, XP_REWARDS } from '../utils/gamification'
import { sortByUpdatedAt } from '../utils/sort'
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
      console.error('Failed to create reading task:', error)
    } else {
      toast.success('Reading task created', {
        description: `Due in 7 days - check your Tasks`,
        duration: 2000,
      })
    }
  } catch (error) {
    console.error('Error creating reading task:', error)
  }
}

export interface PaperSearchOptions {
  rows?: number
  sort?: 'score' | 'published' | 'created' | 'updated' | 'indexed'
  order?: 'asc' | 'desc'
}

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

  async function fetchPapers() {
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
  }

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

  async function searchPapersByQuery(query: string, options: PaperSearchOptions = {}): Promise<CrossrefPaper[]> {
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
  }

  async function createPaper(paperData: Partial<Paper>): Promise<Paper | null> {
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
    if (paperData.source_url && paperData.source_url.trim()) cleanData.source_url = paperData.source_url.trim()
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

    toast.success('Paper added successfully')

    // Optimistic update - get latest state to be safe
    setPapers(sortByUpdatedAt([data, ...useAppStore.getState().papers]))

    awardXP(userId, XP_REWARDS.CREATE_PAPER, 'create_paper').catch(console.error)
    
    void createReadingTaskForPaper(userId, data)
    
    return data
  }

  async function updatePaper(paperId: string, updates: Partial<Paper>): Promise<boolean> {
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
      awardXP(userId, XP_REWARDS.UPDATE_PAPER_STATUS, 'update_paper_status').catch(console.error)
    }

    return true
  }

  async function deletePaper(paperId: string): Promise<boolean> {
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

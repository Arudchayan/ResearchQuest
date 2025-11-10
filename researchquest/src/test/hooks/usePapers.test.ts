import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { usePapers } from '../../hooks/usePapers'
import { mockSupabaseClient, mockPaper } from '../mocks/supabase'
import type { Paper } from '../../types/database'

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
  },
}))

// Mock gamification utils
vi.mock('../../utils/gamification', () => ({
  awardXP: vi.fn().mockResolvedValue(true),
  XP_REWARDS: {
    CREATE_PAPER: 10,
    UPDATE_PAPER_STATUS: 5,
  },
}))

describe('usePapers Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Paper Loading', () => {
    it('should initialize with loading state', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      })

      const { result } = renderHook(() => usePapers('test-user-id'))

      expect(result.current.loading).toBe(true)
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
    })

    it('should fetch papers on mount with userId', async () => {
      const mockPapers: Paper[] = [mockPaper]
      
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockPapers, error: null }),
      })

      const { result } = renderHook(() => usePapers('test-user-id'))

      await waitFor(() => {
        expect(result.current.papers).toHaveLength(1)
        expect(result.current.papers[0]).toEqual(mockPaper)
      })
    })

    it('should handle fetch errors gracefully', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ 
          data: null, 
          error: { message: 'Fetch error' } 
        }),
      })

      const { result } = renderHook(() => usePapers('test-user-id'))

      await waitFor(() => {
        expect(result.current.error).toBe('Fetch error')
        expect(result.current.papers).toEqual([])
      })
    })

    it('should not fetch papers without userId', async () => {
      const { result } = renderHook(() => usePapers(undefined))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
        expect(result.current.papers).toEqual([])
      })
    })
  })

  describe('Create Paper', () => {
    it('should create a paper successfully', async () => {
      const newPaper: Paper = { ...mockPaper, id: 'new-paper-id' }
      
      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: newPaper, error: null }),
      })

      const { result } = renderHook(() => usePapers('test-user-id'))

      await waitFor(() => expect(result.current.loading).toBe(false))

      const paperData = {
        title: 'New Paper',
        authors: ['Author'],
        doi: '10.1234/new',
      }

      const createdPaper = await result.current.createPaper(paperData)

      expect(createdPaper).toEqual(newPaper)
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('papers')
    })

    it('should optimistically update UI after creating paper', async () => {
      const newPaper: Paper = { ...mockPaper, id: 'new-paper-id' }
      
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
        insert: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: newPaper, error: null }),
      })

      const { result } = renderHook(() => usePapers('test-user-id'))

      await waitFor(() => expect(result.current.loading).toBe(false))
      
      const paperData = {
        title: 'New Paper',
        authors: ['Author'],
      }

      await result.current.createPaper(paperData)

      await waitFor(() => {
        expect(result.current.papers).toHaveLength(1)
        expect(result.current.papers[0]).toEqual(newPaper)
      })
    })

    it('should handle create errors', async () => {
      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ 
          data: null, 
          error: { message: 'Create failed' } 
        }),
      })

      const { result } = renderHook(() => usePapers('test-user-id'))

      await waitFor(() => expect(result.current.loading).toBe(false))

      const createdPaper = await result.current.createPaper({
        title: 'New Paper',
        authors: ['Author'],
      })

      expect(createdPaper).toBeNull()
    })

    it('should not create paper without userId', async () => {
      const { result } = renderHook(() => usePapers(undefined))

      await waitFor(() => expect(result.current.loading).toBe(false))

      const createdPaper = await result.current.createPaper({
        title: 'New Paper',
        authors: ['Author'],
      })

      expect(createdPaper).toBeNull()
    })
  })

  describe('Update Paper', () => {
    it('should update paper status successfully', async () => {
      const initialPaper: Paper = mockPaper
      const updatedPaper: Paper = { ...mockPaper, status: 'Read' }

      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [initialPaper], error: null }),
        update: vi.fn().mockReturnThis(),
      }))

      const { result } = renderHook(() => usePapers('test-user-id'))

      await waitFor(() => expect(result.current.papers).toHaveLength(1))

      await result.current.updatePaper(mockPaper.id, { status: 'Read' })

      await waitFor(() => {
        const updated = result.current.papers.find(p => p.id === mockPaper.id)
        expect(updated?.status).toBe('Read')
      })
    })

    it('should handle update errors and revert optimistic update', async () => {
      const initialPaper: Paper = mockPaper

      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [initialPaper], error: null }),
        update: vi.fn().mockReturnThis(),
      }))

      // Mock update to fail
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [initialPaper], error: null }),
      }).mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ 
          error: { message: 'Update failed' } 
        }),
      })

      const { result } = renderHook(() => usePapers('test-user-id'))

      await waitFor(() => expect(result.current.papers).toHaveLength(1))

      const success = await result.current.updatePaper(mockPaper.id, { status: 'Read' })

      expect(success).toBe(false)
    })
  })

  describe('Delete Paper', () => {
    it('should delete paper successfully', async () => {
      const initialPaper: Paper = mockPaper

      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [initialPaper], error: null }),
        delete: vi.fn().mockReturnThis(),
      }))

      const { result } = renderHook(() => usePapers('test-user-id'))

      await waitFor(() => expect(result.current.papers).toHaveLength(1))

      await result.current.deletePaper(mockPaper.id)

      await waitFor(() => {
        expect(result.current.papers).toHaveLength(0)
      })
    })

    it('should handle delete errors and revert optimistic delete', async () => {
      const initialPaper: Paper = mockPaper

      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [initialPaper], error: null }),
        delete: vi.fn().mockReturnThis(),
      }))

      const { result } = renderHook(() => usePapers('test-user-id'))

      await waitFor(() => expect(result.current.papers).toHaveLength(1))

      // Mock delete to fail
      mockSupabaseClient.from.mockReturnValueOnce({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ 
          error: { message: 'Delete failed' } 
        }),
      })

      const success = await result.current.deletePaper(mockPaper.id)

      expect(success).toBe(false)
      // Should still have the paper after failed delete
      await waitFor(() => {
        expect(result.current.papers).toHaveLength(1)
      })
    })
  })

  describe('Realtime Updates', () => {
    it('should set up realtime subscription for papers', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      })

      const { result } = renderHook(() => usePapers('test-user-id'))

      await waitFor(() => {
        expect(mockSupabaseClient.channel).toHaveBeenCalledWith(
          expect.stringContaining('papers_realtime_')
        )
      })
    })

    it('should avoid duplicate papers from realtime when optimistic update exists', async () => {
      const newPaper: Paper = { ...mockPaper, id: 'new-paper-id' }
      
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
        insert: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: newPaper, error: null }),
      })

      const { result } = renderHook(() => usePapers('test-user-id'))

      await waitFor(() => expect(result.current.loading).toBe(false))
      
      // Create paper (optimistic update)
      await result.current.createPaper({
        title: 'New Paper',
        authors: ['Author'],
      })

      await waitFor(() => {
        expect(result.current.papers).toHaveLength(1)
      })

      // Paper should not be duplicated even if realtime fires
      expect(result.current.papers.filter(p => p.id === newPaper.id)).toHaveLength(1)
    })
  })

  describe('Search Papers', () => {
    it('should search papers by DOI', async () => {
      const mockSearchResult = {
        title: 'Found Paper',
        authors: ['Author'],
        doi: '10.1234/found',
        sourceUrl: 'https://example.com',
        abstract: 'Abstract',
        publicationDate: '2024',
      }

      mockSupabaseClient.functions.invoke.mockResolvedValue({
        data: { data: mockSearchResult },
        error: null,
      })

      const { result } = renderHook(() => usePapers('test-user-id'))

      await waitFor(() => expect(result.current.loading).toBe(false))

      const searchResult = await result.current.searchPaperByDOI('10.1234/found')

      expect(searchResult).toEqual(mockSearchResult)
      expect(mockSupabaseClient.functions.invoke).toHaveBeenCalledWith(
        'fetch-paper',
        { body: { doi: '10.1234/found' } }
      )
    })

    it('should search papers by query', async () => {
      const mockSearchResults = [
        {
          title: 'Paper 1',
          authors: ['Author 1'],
          doi: '10.1234/1',
        },
        {
          title: 'Paper 2',
          authors: ['Author 2'],
          doi: '10.1234/2',
        },
      ]

      mockSupabaseClient.functions.invoke.mockResolvedValue({
        data: { data: mockSearchResults },
        error: null,
      })

      const { result } = renderHook(() => usePapers('test-user-id'))

      await waitFor(() => expect(result.current.loading).toBe(false))

      const searchResults = await result.current.searchPapersByQuery('quantum')

      expect(searchResults).toEqual(mockSearchResults)
      expect(mockSupabaseClient.functions.invoke).toHaveBeenCalledWith(
        'fetch-paper',
        { body: { query: 'quantum', rows: undefined, sort: undefined, order: undefined } }
      )
    })

    it('should pass search options to supabase function', async () => {
      mockSupabaseClient.functions.invoke.mockResolvedValue({
        data: { data: [] },
        error: null,
      })

      const { result } = renderHook(() => usePapers('test-user-id'))

      await waitFor(() => expect(result.current.loading).toBe(false))

      await result.current.searchPapersByQuery('ai ethics', {
        rows: 25,
        sort: 'published',
        order: 'asc',
      })

      expect(mockSupabaseClient.functions.invoke).toHaveBeenLastCalledWith(
        'fetch-paper',
        { body: { query: 'ai ethics', rows: 25, sort: 'published', order: 'asc' } }
      )
    })

    it('should handle search errors', async () => {
      mockSupabaseClient.functions.invoke.mockResolvedValue({
        data: null,
        error: { message: 'Search failed' },
      })

      const { result } = renderHook(() => usePapers('test-user-id'))

      await waitFor(() => expect(result.current.loading).toBe(false))

      const searchResult = await result.current.searchPaperByDOI('10.1234/fail')

      expect(searchResult).toBeNull()
    })
  })
})

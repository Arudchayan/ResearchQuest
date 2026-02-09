import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useIdeas } from '../../hooks/useIdeas'
import { mockSupabaseClient } from '../mocks/supabase'
import { useAppStore } from '../../store/appStore'
import type { Idea } from '../../types/database'

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
    CREATE_IDEA: 10,
    ADVANCE_IDEA_STAGE: 20,
  },
}))

describe('useIdeas Security', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAppStore.setState({ ideas: [], ideasLoading: false })
  })

  describe('Input Validation', () => {
    it('should reject idea title exceeding 255 characters', async () => {
      const { result } = renderHook(() => useIdeas('test-user-id'))
      const longTitle = 'a'.repeat(256)

      await act(async () => {
        const created = await result.current.createIdea({
          title: longTitle,
          description: 'Valid description',
        })
        expect(created).toBeNull()
      })

      expect(mockSupabaseClient.rpc).not.toHaveBeenCalled()
    })

    it('should reject idea description exceeding 5000 characters', async () => {
      const { result } = renderHook(() => useIdeas('test-user-id'))
      const longDescription = 'a'.repeat(5001)

      await act(async () => {
        const created = await result.current.createIdea({
          title: 'Valid Title',
          description: longDescription,
        })
        expect(created).toBeNull()
      })

      expect(mockSupabaseClient.rpc).not.toHaveBeenCalled()
    })

    it('should accept valid idea title and description', async () => {
      // Mock successful RPC call
      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: {
            id: 'new-idea-id',
            user_id: 'test-user-id',
            title: 'Valid Title',
            description: 'Valid Description',
            stage: 'Seed',
            linked_note_ids: [],
            linked_paper_ids: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        } as Idea,
        error: null
      })

      const { result } = renderHook(() => useIdeas('test-user-id'))

      await act(async () => {
        const created = await result.current.createIdea({
          title: 'Valid Title',
          description: 'Valid Description',
        })
        expect(created).not.toBeNull()
      })

      expect(mockSupabaseClient.rpc).toHaveBeenCalled()
    })

    it('should reject update with title exceeding 255 characters', async () => {
      const existingIdea: Idea = {
          id: 'idea-1',
          user_id: 'test-user-id',
          title: 'Original Title',
          description: 'Original Desc',
          stage: 'Seed',
          linked_note_ids: [],
          linked_paper_ids: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
      }
      useAppStore.setState({ ideas: [existingIdea] })

      const { result } = renderHook(() => useIdeas('test-user-id'))
      const longTitle = 'a'.repeat(256)

      await act(async () => {
        const success = await result.current.updateIdea('idea-1', {
          title: longTitle
        })
        expect(success).toBe(false)
      })

      expect(mockSupabaseClient.rpc).not.toHaveBeenCalled()
    })

    it('should reject update with description exceeding 5000 characters', async () => {
       const existingIdea: Idea = {
          id: 'idea-1',
          user_id: 'test-user-id',
          title: 'Original Title',
          description: 'Original Desc',
          stage: 'Seed',
          linked_note_ids: [],
          linked_paper_ids: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
      }
      useAppStore.setState({ ideas: [existingIdea] })

      const { result } = renderHook(() => useIdeas('test-user-id'))
      const longDescription = 'a'.repeat(5001)

      await act(async () => {
        const success = await result.current.updateIdea('idea-1', {
          description: longDescription
        })
        expect(success).toBe(false)
      })

      expect(mockSupabaseClient.rpc).not.toHaveBeenCalled()
    })
  })
})

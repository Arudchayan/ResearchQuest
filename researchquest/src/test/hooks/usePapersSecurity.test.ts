import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePapers } from '../../hooks/usePapers'
import { mockSupabaseClient, mockPaper } from '../mocks/supabase'
import { useAppStore } from '../../store/appStore'

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

// Helper to create a complete mock builder that supports chaining
const createMockBuilder = (overrides: any = {}) => {
  const builder: any = {
    ...overrides,
    then: ((onFulfilled?: (value: any) => any) => {
      const result = { data: null, error: null }
      return Promise.resolve(result).then(onFulfilled)
    }) as any,
  }

  // Define chaining methods that return the builder itself (if not overridden)
  if (!builder.select) builder.select = vi.fn().mockReturnValue(builder)
  if (!builder.insert) builder.insert = vi.fn().mockReturnValue(builder)
  if (!builder.update) builder.update = vi.fn().mockReturnValue(builder)
  if (!builder.eq) builder.eq = vi.fn().mockReturnValue(builder)
  if (!builder.single) builder.single = vi.fn().mockResolvedValue({ data: null, error: null })

  return builder
}

describe('usePapers Security', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAppStore.setState({ papers: [], papersLoading: false })
  })

  describe('Sanitization', () => {
    it('should strip invalid source_url (javascript:) in createPaper', async () => {
      const capturedPayloads: any[] = []

      mockSupabaseClient.from.mockImplementation((tableName: string) => {
        if (tableName === 'papers') {
            return createMockBuilder({
                insert: vi.fn().mockImplementation((payload) => {
                    capturedPayloads.push(payload)
                    return createMockBuilder({
                        select: vi.fn().mockReturnValue(createMockBuilder({
                            single: vi.fn().mockResolvedValue({ data: { ...mockPaper, ...payload, id: 'new-id' }, error: null })
                        }))
                    })
                })
            })
        }
        return createMockBuilder()
      })

      const { result } = renderHook(() => usePapers('test-user-id'))

      const maliciousPaper = {
        title: 'Malicious Paper',
        authors: ['Hacker'],
        source_url: 'javascript:alert(document.cookie)', // 🚨 Malicious URL
      }

      await act(async () => {
        await result.current.createPaper(maliciousPaper)
      })

      expect(capturedPayloads.length).toBe(1)
      expect(capturedPayloads[0].title).toBe('Malicious Paper')
      // source_url should be undefined or not present because it was stripped
      expect(capturedPayloads[0].source_url).toBeUndefined()
    })

    it('should allow valid source_url (https:) in createPaper', async () => {
      const capturedPayloads: any[] = []

      mockSupabaseClient.from.mockImplementation((tableName: string) => {
        if (tableName === 'papers') {
            return createMockBuilder({
                insert: vi.fn().mockImplementation((payload) => {
                    capturedPayloads.push(payload)
                    return createMockBuilder({
                        select: vi.fn().mockReturnValue(createMockBuilder({
                            single: vi.fn().mockResolvedValue({ data: { ...mockPaper, ...payload, id: 'new-id' }, error: null })
                        }))
                    })
                })
            })
        }
        return createMockBuilder()
      })

      const { result } = renderHook(() => usePapers('test-user-id'))

      const validPaper = {
        title: 'Safe Paper',
        authors: ['Scientist'],
        source_url: 'https://example.com/paper',
      }

      await act(async () => {
        await result.current.createPaper(validPaper)
      })

      expect(capturedPayloads.length).toBe(1)
      expect(capturedPayloads[0].source_url).toBe('https://example.com/paper')
    })

    it('should strip invalid source_url in updatePaper', async () => {
        const initialPaper = { ...mockPaper, id: 'paper-1' }
        useAppStore.setState({ papers: [initialPaper] })

        const capturedUpdates: any[] = []

        mockSupabaseClient.from.mockImplementation((tableName: string) => {
            if (tableName === 'papers') {
                return createMockBuilder({
                    update: vi.fn().mockImplementation((updates) => {
                        capturedUpdates.push(updates)
                        return createMockBuilder({
                            eq: vi.fn().mockReturnValue(createMockBuilder({
                                select: vi.fn().mockReturnValue(createMockBuilder({
                                    single: vi.fn().mockResolvedValue({ data: { ...initialPaper, ...updates }, error: null })
                                }))
                            }))
                        })
                    })
                })
            }
            return createMockBuilder()
        })

        const { result } = renderHook(() => usePapers('test-user-id'))

        await act(async () => {
            await result.current.updatePaper('paper-1', {
                source_url: 'javascript:alert(1)' // 🚨 Malicious Update
            })
        })

        expect(capturedUpdates.length).toBe(1)
        expect(capturedUpdates[0].source_url).toBeUndefined()
    })
  })
})

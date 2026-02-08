import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTopics } from '../../hooks/useTopics'
import { mockSupabaseClient } from '../mocks/supabase'
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
    CREATE_TOPIC: 10,
    COMPLETE_TOPIC_QUEST: 20,
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
  if (!builder.delete) builder.delete = vi.fn().mockReturnValue(builder)
  if (!builder.eq) builder.eq = vi.fn().mockReturnValue(builder)
  if (!builder.order) builder.order = vi.fn().mockReturnValue(builder)
  if (!builder.single) builder.single = vi.fn().mockResolvedValue({ data: null, error: null })
  if (!builder.maybeSingle) builder.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
  if (!builder.limit) builder.limit = vi.fn().mockReturnValue(builder)

  return builder
}

describe('useTopics Security', () => {
  const originalConsoleError = console.error
  let consoleErrorSpy: any

  beforeEach(() => {
    vi.clearAllMocks()
    useAppStore.setState({ topics: [] })
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  describe('Information Leakage', () => {
    it('should NOT log full error object with JSON.stringify on create topic failure', async () => {
      const sensitiveError = {
        message: 'Something went wrong',
        details: 'Internal database error',
        hint: 'Check your privilege',
        code: '23505',
        schema: 'public',
        table: 'topics',
        column: 'secret_column' // Sensitive info!
      }

      mockSupabaseClient.from.mockImplementation((tableName: string) => {
        if (tableName === 'topics') {
            return createMockBuilder({
                select: vi.fn().mockReturnValue(createMockBuilder({
                    eq: vi.fn().mockReturnValue(createMockBuilder({
                        order: vi.fn().mockReturnValue(createMockBuilder({
                            // Fetch topics initial call
                            then: ((onFulfilled: any) => Promise.resolve({ data: [], error: null }).then(onFulfilled)) as any
                        }))
                    }))
                })),
                insert: vi.fn().mockReturnValue(createMockBuilder({
                    single: vi.fn().mockResolvedValue({ data: null, error: sensitiveError })
                }))
            })
        }
        // Topic quests mocking to avoid unrelated errors
        if (tableName === 'topic_quests') {
             return createMockBuilder({
                select: vi.fn().mockReturnValue(createMockBuilder({
                    eq: vi.fn().mockReturnValue(createMockBuilder({
                        order: vi.fn().mockResolvedValue({ data: [], error: null })
                    }))
                }))
             })
        }
        return createMockBuilder()
      })

      const { result } = renderHook(() => useTopics('test-user-id'))

      // Wait for initial fetch
      await act(async () => {
        await Promise.resolve()
      })

      await act(async () => {
        await result.current.createTopic({ name: 'New Topic' })
      })

      // Check all calls to console.error
      const calls = consoleErrorSpy.mock.calls.flat()

      const foundSensitiveObj = calls.some((arg: any) => {
        if (typeof arg === 'object' && arg !== null) {
            return arg.column === 'secret_column'
        }
        return false
      })

      const foundStringifiedLeak = calls.some((arg: any) =>
        typeof arg === 'string' && arg.includes('secret_column')
      )

      expect(foundSensitiveObj || foundStringifiedLeak).toBe(false)
    })
  })

  describe('Authorization', () => {
    it('should include user_id filter when deleting a topic', async () => {
      const eqSpy = vi.fn()
      // Create a chain where delete returns itself, and eq returns itself
      const mockChain: any = {
        then: ((onFulfilled?: (value: any) => any) => {
             return Promise.resolve({ error: null }).then(onFulfilled)
        }) as any
      }
      mockChain.delete = vi.fn().mockReturnValue(mockChain)
      mockChain.eq = eqSpy.mockReturnValue(mockChain)

      mockSupabaseClient.from.mockImplementation((tableName: string) => {
        if (tableName === 'topics') {
             return createMockBuilder({
                 delete: vi.fn().mockReturnValue(mockChain),
                 select: vi.fn().mockReturnValue(createMockBuilder({
                    eq: vi.fn().mockReturnValue(createMockBuilder({
                        order: vi.fn().mockReturnValue(createMockBuilder({
                            then: ((onFulfilled: any) => Promise.resolve({ data: [], error: null }).then(onFulfilled)) as any
                        }))
                    }))
                 }))
             })
        }
        if (tableName === 'topic_quests') {
             return createMockBuilder({
                select: vi.fn().mockReturnValue(createMockBuilder({
                    eq: vi.fn().mockReturnValue(createMockBuilder({
                        order: vi.fn().mockResolvedValue({ data: [], error: null })
                    }))
                }))
             })
        }
        return createMockBuilder()
      })

      const { result } = renderHook(() => useTopics('test-user-id'))

      await act(async () => {
        await Promise.resolve()
      })

      await act(async () => {
        await result.current.deleteTopic('topic-123')
      })

      // We expect eq to be called with 'id', 'topic-123' AND 'user_id', 'test-user-id'
      expect(eqSpy).toHaveBeenCalledWith('user_id', 'test-user-id')
    })

    it('should include user_id filter when updating a topic', async () => {
      const eqSpy = vi.fn()
      const mockChain: any = {
        then: ((onFulfilled?: (value: any) => any) => {
             return Promise.resolve({ error: null }).then(onFulfilled)
        }) as any
      }
      mockChain.update = vi.fn().mockReturnValue(mockChain)
      mockChain.eq = eqSpy.mockReturnValue(mockChain)

      mockSupabaseClient.from.mockImplementation((tableName: string) => {
        if (tableName === 'topics') {
             return createMockBuilder({
                 update: vi.fn().mockReturnValue(mockChain),
                 select: vi.fn().mockReturnValue(createMockBuilder({
                    eq: vi.fn().mockReturnValue(createMockBuilder({
                        order: vi.fn().mockReturnValue(createMockBuilder({
                            then: ((onFulfilled: any) => Promise.resolve({ data: [], error: null }).then(onFulfilled)) as any
                        }))
                    }))
                 }))
             })
        }
        if (tableName === 'topic_quests') {
             return createMockBuilder({
                select: vi.fn().mockReturnValue(createMockBuilder({
                    eq: vi.fn().mockReturnValue(createMockBuilder({
                        order: vi.fn().mockResolvedValue({ data: [], error: null })
                    }))
                }))
             })
        }
        return createMockBuilder()
      })

      const { result } = renderHook(() => useTopics('test-user-id'))

      await act(async () => {
        await Promise.resolve()
      })

      await act(async () => {
        await result.current.updateTopic('topic-123', { name: 'Updated' })
      })

      expect(eqSpy).toHaveBeenCalledWith('user_id', 'test-user-id')
    })
  })
})

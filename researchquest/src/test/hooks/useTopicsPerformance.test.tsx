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
    then: ((onFulfilled?: (value: any) => any) => {
      const result = { data: null, error: null }
      return Promise.resolve(result).then(onFulfilled)
    }) as any,
    ...overrides,
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

describe('useTopics Performance', () => {
  let selectSpy: any

  beforeEach(() => {
    vi.clearAllMocks()
    useAppStore.setState({ topics: [] })

    // Default implementation for topics fetching
    selectSpy = vi.fn().mockReturnValue(createMockBuilder({
        eq: vi.fn().mockReturnValue(createMockBuilder({
            order: vi.fn().mockReturnValue(createMockBuilder({
                then: ((onFulfilled: any) => {
                  console.log('Resolving topics data in mock');
                  return Promise.resolve({
                    data: [{
                      id: 'topic-1',
                      user_id: 'test-user-id',
                      name: 'Test Topic',
                      created_at: '2023-01-01',
                      updated_at: '2023-01-01'
                    }],
                    error: null
                  }).then(onFulfilled)
                }) as any
            }))
        }))
    }))

    mockSupabaseClient.from.mockImplementation((tableName: string) => {
      if (tableName === 'topics') {
          return createMockBuilder({
              select: selectSpy
          })
      }
      if (tableName === 'topic_notes') {
          return createMockBuilder({
              select: vi.fn().mockReturnValue(createMockBuilder({
                  eq: vi.fn().mockReturnValue(createMockBuilder({
                    then: ((onFulfilled: any) => Promise.resolve({ data: [{ topic_id: 'topic-1' }], error: null }).then(onFulfilled)) as any
                  }))
              }))
          })
      }
      return createMockBuilder()
    })
  })

  it('should re-fetch topics on remount (showing inefficiency)', async () => {
    const { unmount } = renderHook(() => useTopics('test-user-id'))

    // Wait for initial fetch
    await act(async () => {
      await Promise.resolve()
    })

    expect(selectSpy).toHaveBeenCalledTimes(1)

    unmount()

    // Mount again
    renderHook(() => useTopics('test-user-id'))

    await act(async () => {
      await Promise.resolve()
    })

    // Expect it to be called ONCE (optimization)
    expect(selectSpy).toHaveBeenCalledTimes(1)
  })

  it('should cache entity links on remount (showing optimization)', async () => {
    const linkSelectSpy = vi.fn().mockReturnValue(createMockBuilder({
        eq: vi.fn().mockReturnValue(createMockBuilder({
          then: ((onFulfilled: any) => Promise.resolve({ data: [{ topic_id: 'topic-1' }], error: null }).then(onFulfilled)) as any
        }))
    }))

    mockSupabaseClient.from.mockImplementation((tableName: string) => {
      if (tableName === 'topics') {
          return createMockBuilder({
              select: selectSpy
          })
      }
      if (tableName === 'topic_notes') {
          return createMockBuilder({
              select: linkSelectSpy
          })
      }
      return createMockBuilder()
    })

    const { result, unmount } = renderHook(() => useTopics('test-user-id'))

    // Wait for initial fetch
    await act(async () => {
      await Promise.resolve()
    })

    // Call getTopicIdsForEntity
    await act(async () => {
      await result.current.getTopicIdsForEntity('note-1', 'note')
    })

    // Check specifically for topic_id selection (link fetching), ignoring user_id selection (detection)
    const linkFetchCalls = linkSelectSpy.mock.calls.filter((args: any[]) => args[0] === 'topic_id')
    expect(linkFetchCalls.length).toBe(1)

    unmount()

    // Mount again
    const { result: result2 } = renderHook(() => useTopics('test-user-id'))

    await act(async () => {
      await Promise.resolve()
    })

    // Call getTopicIdsForEntity again for same entity
    await act(async () => {
      await result2.current.getTopicIdsForEntity('note-1', 'note')
    })

    // Expect it to remain 1 call (optimization)
    const linkFetchCalls2 = linkSelectSpy.mock.calls.filter((args: any[]) => args[0] === 'topic_id')
    expect(linkFetchCalls2.length).toBe(1)
  })
})

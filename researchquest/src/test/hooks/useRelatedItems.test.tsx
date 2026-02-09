import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useAppStore } from '../../store/appStore'
import { useRelatedItems } from '../../hooks/useRelatedItems'
import { supabase } from '../../lib/supabase'

// Mock Supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getUser: vi.fn() }
  }
}))

describe('useRelatedItems', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAppStore.setState({
      notes: [],
      papers: [],
      ideas: [],
      user: { id: 'user-1' } as any
    })
  })

  const createBuilder = (data: any) => {
    const builder: any = {}
    builder.select = vi.fn().mockReturnValue(builder)
    builder.eq = vi.fn().mockReturnValue(builder)
    builder.neq = vi.fn().mockReturnValue(builder)
    builder.in = vi.fn().mockReturnValue(builder)
    builder.order = vi.fn().mockReturnValue(builder)
    builder.then = (resolve: any) => resolve({ data, error: null })
    return builder
  }

  it('REPRODUCTION: triggers network requests when store updates', async () => {
    // 1. Setup initial store
    useAppStore.setState({
      notes: [
        { id: 'note-1', title: 'Note 1', updated_at: '2023-01-01', user_id: 'user-1', markdown_body: '' } as any,
        { id: 'note-2', title: 'Related Note', updated_at: '2023-01-02', user_id: 'user-1', markdown_body: '' } as any
      ]
    })

    // 2. Mock Supabase to return related items
    const mockFrom = supabase.from as unknown as ReturnType<typeof vi.fn>
    mockFrom.mockImplementation((table: string) => {
      if (table === 'topic_notes') {
        // Return data that satisfies both "get topics" and "get related notes"
        // For the first query (topics for note-1), this provides 'topic-A'.
        // For the second query (related notes), this provides 'note-2' which is related to 'topic-A'.
        return createBuilder([
            { topic_id: 'topic-A', note_id: 'note-2' }
        ])
      }
      return createBuilder([])
    })

    // 3. Render hook
    const { result } = renderHook(() => useRelatedItems('note-1', 'note', 'user-1'))

    // 4. Wait for initial load
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Check initial related items
    expect(result.current.relatedItems).toHaveLength(1)
    expect(result.current.relatedItems[0].id).toBe('note-2')

    const initialCallCount = mockFrom.mock.calls.length
    expect(initialCallCount).toBeGreaterThan(0) // Should have called supabase

    // 5. Update store (simulate user typing in a DIFFERENT note or the same note)
    act(() => {
        useAppStore.setState({
            notes: [
                ...useAppStore.getState().notes,
                { id: 'note-3', title: 'New Note', updated_at: '2023-01-03', user_id: 'user-1', markdown_body: '' } as any
            ]
        })
    })

    // 6. Wait and check call count
    // In the CURRENT (buggy) implementation, this should trigger more calls.
    // In the FIXED implementation, this should NOT trigger more calls.

    // Since this is a reproduction test, we expect calls to INCREASE.
    // However, since I am Bolt and I need to fix it, I will write the assertion for the FIX,
    // run it, see it fail, then fix it.

    // Wait a bit for potential effects to run
    await new Promise(r => setTimeout(r, 100))

    // ASSERTION FOR OPTIMIZED BEHAVIOR
    expect(mockFrom.mock.calls.length).toBe(initialCallCount)

    // 7. Change title of note-2 in store
    act(() => {
        const notes = useAppStore.getState().notes.map(n => n.id === 'note-2' ? {...n, title: 'New Title'} : n)
        useAppStore.setState({ notes })
    })

    // 8. Verify that related item updated without new network calls
    await waitFor(() => {
        const item = result.current.relatedItems.find(i => i.id === 'note-2')
        expect(item?.title).toBe('New Title')
    })

    // Call count should STILL be the same
    expect(mockFrom.mock.calls.length).toBe(initialCallCount)
  })
})

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

  it('triggers network requests when store updates (should not happen with optimization)', async () => {
    // 1. Setup initial store
    useAppStore.setState({
      notes: [
        { id: 'note-1', title: 'Note 1', updated_at: '2023-01-01', user_id: 'user-1', markdown_body: '' } as any,
        { id: 'note-2', title: 'Related Note', updated_at: '2023-01-02', user_id: 'user-1', markdown_body: '' } as any
      ]
    })

    // 2. Mock Supabase to return related items
    const mockFrom = supabase.from as unknown as ReturnType<typeof vi.fn>
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      then: (resolve: any) => resolve({ data: [], error: null })
    })

    // 3. Render hook
    const { result } = renderHook(() => useRelatedItems('note-1', 'note', 'user-1'))

    // 4. Wait for initial load
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

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
    // In the FIXED implementation, this should NOT trigger more calls.
    await new Promise(r => setTimeout(r, 100))

    // ASSERTION FOR OPTIMIZED BEHAVIOR
    expect(mockFrom.mock.calls.length).toBe(initialCallCount)
  })

  it('does not fetch when enabled is false', async () => {
    const mockFrom = supabase.from as unknown as ReturnType<typeof vi.fn>
    mockFrom.mockClear()
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      then: (resolve: any) => resolve({ data: [], error: null })
    })

    const { result, rerender } = renderHook(
      ({ enabled }) => useRelatedItems('note-1', 'note', 'user-1', { enabled }),
      { initialProps: { enabled: false } }
    )

    // Should NOT fetch initially
    expect(mockFrom).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(false)

    // Update enabled to true
    rerender({ enabled: true })

    // Should fetch now
    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalled()
    })
  })
})

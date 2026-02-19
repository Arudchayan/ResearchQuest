import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAppStore } from '../../store/appStore'
import { useBacklinks } from '../../hooks/useBacklinks'
import { supabase } from '../../lib/supabase'

// Mock Supabase to track calls
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      contains: vi.fn().mockReturnThis(),
      then: vi.fn().mockImplementation((resolve) => resolve({ data: [], error: null })),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn(),
    })),
  }
}))

describe('useBacklinks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAppStore.setState({
      notes: [],
      ideas: [],
      notesLoading: false,
      ideasLoading: false,
    })
  })

  it('retrieves backlinks from store without network request', async () => {
    // 1. Setup store with linked items
    const targetEntityId = 'target-id'
    const linkingNote = {
      id: 'note-1',
      title: 'Linking Note',
      updated_at: '2023-01-01',
      linked_entity_ids: [targetEntityId], // Links to target
      markdown_body: 'Some content',
      user_id: 'user-1'
    }
    const otherNote = {
      id: 'note-2',
      title: 'Other Note',
      updated_at: '2023-01-02',
      linked_entity_ids: [],
      markdown_body: 'No link',
      user_id: 'user-1'
    }

    useAppStore.setState({
      notes: [linkingNote, otherNote] as any,
      ideas: []
    })

    // 2. Render hook
    const { result } = renderHook(() => useBacklinks(targetEntityId, 'note', 'user-1'))

    // 3. Assertions
    // The optimized hook should have loading=false immediately because data is in store
    expect(result.current.loading).toBe(false)

    // It should find the linking note
    expect(result.current.backlinks).toHaveLength(1)
    expect(result.current.backlinks[0].id).toBe('note-1')

    // CRITICAL: It should NOT call Supabase
    // Note: The current implementation DOES call Supabase, so we expect this to fail initially
    expect(supabase.from).not.toHaveBeenCalled()
  })
})

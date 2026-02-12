import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useRelatedItems } from '../../hooks/useRelatedItems'
import { supabase } from '../../lib/supabase'

// Mock Supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  }
}))

describe('useRelatedItems Performance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('verifies PARALLEL execution of related item fetches', async () => {
    let resolveNotes: (v: any) => void
    let resolvePapers: (v: any) => void
    let resolveIdeas: (v: any) => void

    const notesPromise = new Promise(r => { resolveNotes = r })
    const papersPromise = new Promise(r => { resolvePapers = r })
    const ideasPromise = new Promise(r => { resolveIdeas = r })

    let callCount = 0

    const mockFrom = supabase.from as unknown as ReturnType<typeof vi.fn>
    mockFrom.mockImplementation((table: string) => {
      callCount++
      const currentCallIndex = callCount

      const builder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
      }

      builder.then = (onFulfilled: any) => {
        // 1. Initial fetch (topics for current entity) - resolve immediately
        if (currentCallIndex === 1) {
            return Promise.resolve({ data: [{ topic_id: 't1' }], error: null }).then(onFulfilled)
        }

        // 2. Related fetches
        if (table === 'topic_notes') {
            return notesPromise.then(() => ({ data: [], error: null })).then(onFulfilled)
        }
        if (table === 'topic_papers') {
            return papersPromise.then(() => ({ data: [], error: null })).then(onFulfilled)
        }
        if (table === 'topic_ideas') {
            return ideasPromise.then(() => ({ data: [], error: null })).then(onFulfilled)
        }
        return Promise.resolve({ data: [], error: null }).then(onFulfilled)
      }

      return builder
    })

    // Render hook
    renderHook(() => useRelatedItems('note-1', 'note', 'user-1'))

    // Wait for ALL calls to be initiated.
    // Since we use Promise.all, all 3 related fetches should start immediately after the initial fetch resolves.

    // We expect 4 calls total:
    // 1. topic_notes (initial)
    // 2. topic_notes (related)
    // 3. topic_papers (related)
    // 4. topic_ideas (related)

    await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledTimes(4)
    })

    const calls = mockFrom.mock.calls.map(c => c[0])

    // Verify all tables were queried
    expect(calls).toContain('topic_notes')
    expect(calls).toContain('topic_papers')
    expect(calls).toContain('topic_ideas')

    // Verify specific parallel execution
    // (In sequential execution, we would be stuck at 2 calls waiting for notesPromise)

    // Cleanup
    resolveNotes!('done')
    resolvePapers!('done')
    resolveIdeas!('done')
  })
})

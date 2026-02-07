import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNotes } from '../../hooks/useNotes'
import { mockSupabaseClient, mockNote } from '../mocks/supabase'
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
    CREATE_NOTE: 10,
    UPDATE_NOTE: 5,
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
  if (!builder.single) builder.single = vi.fn().mockResolvedValue({ data: null, error: null })
  if (!builder.upsert) builder.upsert = vi.fn().mockReturnValue(builder)

  return builder
}

describe('useNotes Security', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAppStore.setState({ notes: [], notesLoading: false })
  })

  describe('Authorization', () => {
    it('should include user_id check in deleteNote', async () => {
      // Create a mock builder that returns itself on 'eq' so we can capture chained calls
      const mockBuilder = createMockBuilder()
      // We need to spy on the 'eq' method of this specific builder instance
      const eqSpy = vi.spyOn(mockBuilder, 'eq')
      // Ensure it returns itself for chaining
      eqSpy.mockReturnValue(mockBuilder)

      mockSupabaseClient.from.mockImplementation((tableName: string) => {
        if (tableName === 'notes') {
            return createMockBuilder({
                delete: vi.fn().mockReturnValue(mockBuilder)
            })
        }
        return createMockBuilder()
      })

      const { result } = renderHook(() => useNotes('test-user-id'))

      const noteToDelete = { ...mockNote, id: 'note-to-delete' }
      useAppStore.setState({ notes: [noteToDelete] })

      await act(async () => {
        await result.current.deleteNote('note-to-delete')
      })

      const calls = eqSpy.mock.calls

      const hasIdCheck = calls.some(call => call[0] === 'id' && call[1] === 'note-to-delete')
      const hasUserIdCheck = calls.some(call => call[0] === 'user_id' && call[1] === 'test-user-id')

      expect(hasIdCheck).toBe(true)
      expect(hasUserIdCheck).toBe(true) // This should fail currently
    })

    it('should include user_id check in updateNote', async () => {
        const mockBuilder = createMockBuilder()
        const eqSpy = vi.spyOn(mockBuilder, 'eq')
        eqSpy.mockReturnValue(mockBuilder)

        mockSupabaseClient.from.mockImplementation((tableName: string) => {
          if (tableName === 'notes') {
              return createMockBuilder({
                  update: vi.fn().mockReturnValue(mockBuilder)
              })
          }
          return createMockBuilder()
        })

        const { result } = renderHook(() => useNotes('test-user-id'))

        const noteToUpdate = { ...mockNote, id: 'note-to-update' }
        useAppStore.setState({ notes: [noteToUpdate] })

        await act(async () => {
          await result.current.updateNote('note-to-update', { title: 'New Title' })
        })

        const calls = eqSpy.mock.calls

        const hasIdCheck = calls.some(call => call[0] === 'id' && call[1] === 'note-to-update')
        const hasUserIdCheck = calls.some(call => call[0] === 'user_id' && call[1] === 'test-user-id')

        expect(hasIdCheck).toBe(true)
        expect(hasUserIdCheck).toBe(true) // This should fail currently
      })

      it('should enforce user_id in restoreNote payload', async () => {
        const capturedPayloads: any[] = []

        mockSupabaseClient.from.mockImplementation((tableName: string) => {
            if (tableName === 'notes') {
                return createMockBuilder({
                    upsert: vi.fn().mockImplementation((payload) => {
                        capturedPayloads.push(payload)
                        return createMockBuilder({
                            select: vi.fn().mockReturnValue(createMockBuilder({
                                single: vi.fn().mockResolvedValue({ data: { ...mockNote, ...payload }, error: null })
                            }))
                        })
                    })
                })
            }
            return createMockBuilder()
        })

        const { result } = renderHook(() => useNotes('test-user-id'))

        // Simulating a restore of a note that might have a different user_id or missing one
        const noteToRestore = { ...mockNote, id: 'restored-note', user_id: 'some-other-user' }

        await act(async () => {
            await result.current.restoreNote(noteToRestore)
        })

        expect(capturedPayloads.length).toBe(1)
        // Ideally, we want the payload to have overwritten user_id with the current user's ID
        expect(capturedPayloads[0].user_id).toBe('test-user-id')
      })
  })
})

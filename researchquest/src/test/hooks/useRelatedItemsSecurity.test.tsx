import { renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useRelatedItems } from '../../hooks/useRelatedItems'
import { supabase } from '../../lib/supabase'
import { useAppStore } from '../../store/appStore'

// Mock Supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

// Mock AppStore
vi.mock('../../store/appStore', () => ({
  useAppStore: vi.fn(),
}))

describe('useRelatedItems Security', () => {
  const originalConsoleError = console.error

  beforeEach(() => {
    vi.clearAllMocks()
    console.error = vi.fn()

    // Default store mock
    vi.mocked(useAppStore).mockReturnValue({
      user: { id: 'test-user-123' },
    } as any)
  })

  afterEach(() => {
    console.error = originalConsoleError
  })

  it('should NOT leak full error object to console.error when fetching fails', async () => {
    // Setup Supabase mock to throw a detailed error
    const sensitiveError = new Error('Database query failed')
    ;(sensitiveError as any).details = 'Connection to 192.168.1.5 failed'
    ;(sensitiveError as any).hint = 'Check pg_hba.conf'
    ;(sensitiveError as any).code = '53300'
    ;(sensitiveError as any).internalStack = 'at /secret/path/to/server.ts:50:1'

    vi.mocked(supabase.from).mockImplementation(() => {
      throw sensitiveError
    })

    renderHook(() => useRelatedItems('note-123', 'note', true))

    await waitFor(() => {
      expect(console.error).toHaveBeenCalled()
    })

    // Check all calls to console.error
    const errorCalls = vi.mocked(console.error).mock.calls

    // Verify the message string was logged
    expect(errorCalls.some(args =>
      args.some(arg => typeof arg === 'string' && arg.includes('Error fetching related items: Database query failed')) ||
      args.some(arg => typeof arg === 'string' && arg.includes('Database query failed'))
    )).toBe(true)

    // Ensure we didn't log the full object with sensitive data
    errorCalls.forEach(args => {
      args.forEach(arg => {
        // If an object is passed, it should NOT contain our sensitive fields
        if (typeof arg === 'object' && arg !== null) {
          expect(arg).not.toHaveProperty('internalStack')
          expect(arg).not.toHaveProperty('details')
          expect(arg).not.toHaveProperty('hint')
        }

        // If a string is passed (like JSON.stringify), it should NOT contain sensitive data
        if (typeof arg === 'string') {
          expect(arg).not.toContain('/secret/path/to/server.ts')
          expect(arg).not.toContain('192.168.1.5')
        }
      })
    })
  })
})

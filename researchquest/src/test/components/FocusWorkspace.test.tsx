import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { FocusWorkspace } from '../../components/focus/FocusWorkspace'
import { useAppStore } from '../../store/appStore'
import { awardXP } from '../../utils/gamification'
import { toast } from 'sonner'

// Mock hooks
vi.mock('../../hooks/useNotes', () => ({
  useNotes: () => ({
    notes: [{ id: 'note-1', title: 'My Note', markdown_body: 'Content', updated_at: new Date().toISOString() }],
    loading: false
  })
}))
vi.mock('../../hooks/usePapers', () => ({
  usePapers: () => ({ papers: [], loading: false })
}))
vi.mock('../../hooks/useTasks', () => ({
  useTasks: () => ({ tasks: [], loading: false })
}))
vi.mock('../../store/appStore', () => ({
  useAppStore: vi.fn()
}))
vi.mock('../../utils/gamification', () => ({
  XP_REWARDS: { FOCUS_SESSION_MINUTE: 2 },
  awardXP: vi.fn()
}))
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn()
  }
}))

// Mock UI components
vi.mock('../../components/ui/Skeleton', () => ({
  ListSkeleton: () => <div data-testid="list-skeleton" />,
  Skeleton: () => <div data-testid="skeleton" />
}))

describe('FocusWorkspace', () => {
  const userId = 'user-123'

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    // Mock store implementation
    const storeMock = (selector: any) => {
        // Return dummy setters
        return vi.fn()
    }
    (useAppStore as any).mockImplementation(storeMock)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders correctly', () => {
    render(<FocusWorkspace userId={userId} />)
    expect(screen.getByText(/Design an intentional deep work session/i)).toBeInTheDocument()
    expect(screen.getByText(/Start focus/i)).toBeInTheDocument()
  })

  it('awards XP upon session completion', async () => {
    render(<FocusWorkspace userId={userId} />)

    // Select the note from "Notes" suggestion group
    // The component renders an accordion for Notes.
    // It's likely collapsed or expanded.
    // The code says: collapsedGroups initial state { note: false } -> Expanded.

    // Find the note button and click it
    const noteButton = screen.getByText('My Note')
    fireEvent.click(noteButton)

    // Now "Start focus" should be enabled.
    const startButton = screen.getByText('Start focus')
    expect(startButton).not.toBeDisabled()

    // Set a custom duration to 1 minute for faster testing?
    // Actually, we use fake timers so duration doesn't matter for speed,
    // but calculation depends on it. Default is 25 min.

    // Click start
    fireEvent.click(startButton)

    // Advance timers by 25 minutes (plus a buffer)
    await act(async () => {
        vi.advanceTimersByTime(25 * 60 * 1000 + 1000)
    })

    // Expect awardXP to be called
    expect(awardXP).toHaveBeenCalledWith(userId, 50, 'complete_focus_session') // 25 min * 2 XP/min = 50 XP

    // Expect toast to be shown
    expect(toast.success).toHaveBeenCalledWith('Focus session complete!', expect.objectContaining({
        description: expect.stringContaining('50 XP')
    }))
  })
})

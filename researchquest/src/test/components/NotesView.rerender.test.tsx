import { render, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAppStore } from '../../store/appStore'
import { Profiler } from 'react'

// Mock dependencies
vi.mock('../../components/editor/MarkdownEditor', () => ({
  MarkdownEditor: () => <div>Editor</div>
}))
vi.mock('../../components/ui/ConfirmDialog', () => ({
  ConfirmDialog: () => null,
  useConfirmDialog: () => ({
    confirm: vi.fn(),
    isOpen: false,
    config: {}
  })
}))
vi.mock('../../hooks/useNotes', () => ({
  useNotes: () => ({
    notes: [],
    createNote: vi.fn(),
    deleteNote: vi.fn(),
    restoreNote: vi.fn(),
    loading: false
  })
}))

// Import after mocks
import { NotesView } from '../../components/notes/NotesView'

describe('NotesView Re-renders', () => {
  beforeEach(() => {
    useAppStore.setState({
      notes: [],
      selectedNote: null,
      notesLoading: false,
      isMobileSidebarOpen: false,
      papers: [],
      ideas: [],
      tasks: [],
      user: null
    })
  })

  it('should NOT re-render when unrelated store property changes', () => {
    let renderCount = 0
    const onRender = vi.fn((id, phase, actualDuration, baseDuration, startTime, commitTime) => {
      renderCount++
    })

    // Initial render
    render(
      <Profiler id="NotesView" onRender={onRender}>
        <NotesView />
      </Profiler>
    )

    // Capture initial render count
    const initialRenderCount = renderCount

    // Update unrelated property
    act(() => {
      useAppStore.setState({ isMobileSidebarOpen: true })
    })

    // Expect render count to NOT increase
    // Note: Profiler callback runs after commit. Act handles waiting for updates.
    expect(renderCount).toBe(initialRenderCount)
  })
})

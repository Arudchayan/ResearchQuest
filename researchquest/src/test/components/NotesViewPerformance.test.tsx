import { render, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotesView } from '../../components/notes/NotesView'
import { useAppStore } from '../../store/appStore'

// Mock NoteCard to track renders
const { MockNoteCard, noteCardRenderCounts } = vi.hoisted(() => {
  const noteCardRenderCounts: Record<string, number> = {}

  const MockNoteCard = vi.fn((props: any) => {
    const id = props.note.id
    noteCardRenderCounts[id] = (noteCardRenderCounts[id] || 0) + 1
    return (
      <div data-testid={`note-card-${id}`}>
        {props.note.title}
        <button onClick={() => props.onDelete(id)}>Delete</button>
      </div>
    )
  })

  return { MockNoteCard, noteCardRenderCounts }
})

// Define stable mocks
const { mockConfirm, mockCreateNote, mockDeleteNote, mockRestoreNote } = vi.hoisted(() => {
  return {
    mockConfirm: vi.fn(),
    mockCreateNote: vi.fn(),
    mockDeleteNote: vi.fn(),
    mockRestoreNote: vi.fn()
  }
})

// Mock the module
vi.mock('../../components/notes/NoteCard', async (importOriginal) => {
  const React = await import('react')
  // We use React.memo to simulate the real component behavior
  const MemoizedMock = React.memo(MockNoteCard)
  return {
    NoteCard: MemoizedMock
  }
})

// Mock other components to isolate test
vi.mock('../../components/editor/MarkdownEditor', () => ({
  MarkdownEditor: () => <div>Editor</div>
}))

vi.mock('../../components/ui/ConfirmDialog', () => ({
  ConfirmDialog: () => null,
  useConfirmDialog: () => ({
    confirm: mockConfirm,
    isOpen: false,
    config: {}
  })
}))

vi.mock('../../hooks/useNotes', () => ({
  useNotes: () => ({
    createNote: mockCreateNote,
    deleteNote: mockDeleteNote,
    restoreNote: mockRestoreNote,
    notesLoading: false
  })
}))

describe('NotesView Performance', () => {
  beforeEach(() => {
    // Reset render counts
    Object.keys(noteCardRenderCounts).forEach(key => delete noteCardRenderCounts[key])

    // Reset store
    useAppStore.setState({
      notes: [],
      selectedNote: null,
      user: { id: 'test-user', email: 'test@example.com' } as any
    })
  })

  it('should not re-render unrelated notes when one note is updated', () => {
    // 1. Setup initial state with 3 notes
    const initialNotes = [
      { id: '1', title: 'Note 1', markdown_body: 'Body 1', updated_at: '2023-01-01' },
      { id: '2', title: 'Note 2', markdown_body: 'Body 2', updated_at: '2023-01-02' },
      { id: '3', title: 'Note 3', markdown_body: 'Body 3', updated_at: '2023-01-03' }
    ] as any[]

    useAppStore.setState({ notes: initialNotes })

    // 2. Render the component
    render(<NotesView />)

    // Check initial render counts
    expect(noteCardRenderCounts['1']).toBe(1)
    expect(noteCardRenderCounts['2']).toBe(1)
    expect(noteCardRenderCounts['3']).toBe(1)

    // 3. Update ONE note in the store (simulating an edit)
    // We update Note 2. Note 1 and 3 remain unchanged referentially.
    const updatedNotes = initialNotes.map(n =>
      n.id === '2' ? { ...n, title: 'Note 2 Updated' } : n
    )

    act(() => {
      useAppStore.setState({ notes: updatedNotes })
    })

    // 4. Check render counts again
    // Note 2 should re-render because its prop `note` changed.
    expect(noteCardRenderCounts['2']).toBe(2)

    // Note 1 and 3 should NOT re-render if optimization works.
    // If they re-render, it means `onDelete` (or other props) changed.
    expect(noteCardRenderCounts['1']).toBe(1)
    expect(noteCardRenderCounts['3']).toBe(1)
  })
})

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NotesView } from '../../components/notes/NotesView'

// Define mock state with loading true
const { mockState } = vi.hoisted(() => {
    return {
        mockState: {
            notes: [],
            selectedNote: null,
            setSelectedNote: vi.fn(),
            user: { id: 'user1' },
            notesLoading: true, // Simulate loading state
        }
    }
})

vi.mock('../../store/appStore', () => {
    const useAppStore = (selector: any) => selector ? selector(mockState) : mockState
    useAppStore.getState = () => mockState
    return { useAppStore }
})

vi.mock('../../hooks/useNotes', () => ({
  useNotes: () => ({
    createNote: vi.fn(),
    deleteNote: vi.fn(),
    restoreNote: vi.fn(), // Needed as it is destructured
    notes: mockState.notes, // Provide notes
    loading: mockState.notesLoading // Provide loading state
  })
}))

// Mock other components used in NotesView to avoid rendering them fully
vi.mock('../editor/MarkdownEditor', () => ({ MarkdownEditor: () => <div>MarkdownEditor</div> }))
vi.mock('../ui/ConfirmDialog', () => ({
    ConfirmDialog: () => <div>ConfirmDialog</div>,
    useConfirmDialog: () => ({ confirm: vi.fn(), isOpen: false, config: {} })
}))
vi.mock('./NoteCard', () => ({ NoteCard: () => <div>NoteCard</div> }))

describe('NotesView Loading State', () => {
  it('renders loading skeletons when notesLoading is true', () => {
    render(<NotesView />)
    // Expect to find elements with role="status" (from Skeleton component)
    // We expect multiple skeletons
    const skeletons = screen.getAllByRole('status')
    expect(skeletons.length).toBeGreaterThan(0)
  })
})

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { NotesView } from '../../components/notes/NotesView'
import type { Note } from '../../types/database'
import { toast } from 'sonner'

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  },
}))

// Use vi.hoisted for variables used in mocks
const { mockNote, mockDeleteNote, mockCreateNote, mockSetSelectedNote, mockRestoreNote } = vi.hoisted(() => {
  return {
    mockNote: {
      id: 'test-note-1',
      user_id: 'test-user-id',
      title: 'Test Note',
      markdown_body: 'This is a test note.',
      tags: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Note,
    mockDeleteNote: vi.fn().mockResolvedValue(true),
    mockCreateNote: vi.fn(),
    mockSetSelectedNote: vi.fn(),
    mockRestoreNote: vi.fn(),
  }
})

vi.mock('../../hooks/useNotes', () => ({
  useNotes: () => ({
    notes: [mockNote],
    createNote: mockCreateNote,
    deleteNote: mockDeleteNote,
    restoreNote: mockRestoreNote,
    notesLoading: false,
  }),
}))

vi.mock('../../store/appStore', () => {
  const mockState = {
    notes: [mockNote],
    selectedNote: null,
    setSelectedNote: mockSetSelectedNote,
    user: { id: 'test-user-id' },
    notesLoading: false,
  }

  const useAppStore = () => mockState
  // @ts-expect-error - mock injection
  useAppStore.getState = () => mockState

  return { useAppStore }
})

// Mock the editor to avoid complex rendering
vi.mock('../editor/MarkdownEditor', () => ({
  MarkdownEditor: () => <div data-testid="markdown-editor">Editor</div>
}))

describe('NotesView Deletion UX', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDeleteNote.mockResolvedValue(true) // Ensure it returns true by default
  })

  it('shows confirmation dialog instead of native confirm when deleting a note', async () => {
    // Mock window.confirm to fail if called (we want to ensure it's NOT called)
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true)

    render(<NotesView />)

    // Find the delete button
    const deleteButton = screen.getByRole('button', { name: /Delete note/i })
    expect(deleteButton).toBeInTheDocument()

    // Click delete
    fireEvent.click(deleteButton)

    // Wait for dialog to appear
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toBeInTheDocument()
    expect(screen.getByText(/Are you sure you want to delete this note?/i)).toBeInTheDocument()

    // Ensure window.confirm was NOT called
    expect(confirmSpy).not.toHaveBeenCalled()

    // Find and click the confirm button (Delete)
    const confirmButton = screen.getByRole('button', { name: 'Delete' })
    fireEvent.click(confirmButton)

    // Verify deleteNote was called
    await waitFor(() => {
        expect(mockDeleteNote).toHaveBeenCalledWith(mockNote.id)
    })
  })

  it('cancels deletion when cancel is clicked', async () => {
    render(<NotesView />)

    const deleteButton = screen.getByRole('button', { name: /Delete note/i })
    fireEvent.click(deleteButton)

    await screen.findByRole('alertdialog')

    // Find cancel button (default text "Cancel")
    const cancelButton = screen.getByRole('button', { name: 'Cancel' })

    // Verify cancel button is focused (accessibility requirement for danger actions)
    expect(cancelButton).toHaveFocus()

    fireEvent.click(cancelButton)

    // Verify deleteNote was NOT called
    expect(mockDeleteNote).not.toHaveBeenCalled()

    // Verify dialog is closed
    await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })
  })

  it('shows success toast with undo action after deletion', async () => {
    render(<NotesView />)

    const deleteButton = screen.getByRole('button', { name: /Delete note/i })
    fireEvent.click(deleteButton)

    const confirmButton = await screen.findByRole('button', { name: 'Delete' })
    fireEvent.click(confirmButton)

    await waitFor(() => {
        expect(mockDeleteNote).toHaveBeenCalledWith(mockNote.id)
    })

    // Verify toast.success was called
    expect(toast.success).toHaveBeenCalledWith('Note deleted', expect.objectContaining({
      description: expect.stringContaining('Undo'),
      action: expect.objectContaining({
        label: 'Undo',
      }),
    }))
  })

  it('calls restoreNote when undo is clicked', async () => {
    render(<NotesView />)

    const deleteButton = screen.getByRole('button', { name: /Delete note/i })
    fireEvent.click(deleteButton)

    const confirmButton = await screen.findByRole('button', { name: 'Delete' })
    fireEvent.click(confirmButton)

    await waitFor(() => {
        expect(mockDeleteNote).toHaveBeenCalledWith(mockNote.id)
    })

    const toastCall = vi.mocked(toast.success).mock.calls[0]
    const toastOptions = toastCall[1] as any
    const undoAction = toastOptions.action

    await undoAction.onClick()

    expect(mockRestoreNote).toHaveBeenCalledWith(mockNote)
  })
})

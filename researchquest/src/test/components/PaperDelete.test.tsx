import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PaperDetailView } from '../../components/entities/PaperDetailView'
import type { Paper } from '../../types/database'

// Mock icons
vi.mock('lucide-react', () => ({
  BookOpen: () => <span>Icon</span>,
  Calendar: () => <span>Icon</span>,
  ExternalLink: () => <span>Icon</span>,
  Edit2: () => <span>EditIcon</span>,
  Save: () => <span>SaveIcon</span>,
  X: () => <span>XIcon</span>,
  Link: () => <span>LinkIcon</span>,
  Sparkles: () => <span>SparklesIcon</span>,
  Trash: () => <span>TrashIcon</span>,
  ChevronDown: () => <span>ChevronDownIcon</span>,
  Search: () => <span>SearchIcon</span>,
  Plus: () => <span>PlusIcon</span>,
  Loader2: () => <span>Loader2Icon</span>,
  AlertTriangle: () => <span>AlertIcon</span>,
}))

// Mock sub-components
vi.mock('../../components/topics/TopicSelector', () => ({
  TopicSelector: () => <div>TopicSelector</div>
}))

const mockPaper: Paper = {
  id: '1',
  title: 'Test Paper',
  authors: ['Author 1'],
  publication_date: '2023-01-01',
  user_id: 'user1',
  created_at: '2023-01-01',
  updated_at: '2023-01-01',
  abstract: 'Abstract',
  status: 'To Read',
  citation_count: 0
}

describe('PaperDetailView', () => {
  it('renders delete button when not editing', () => {
    const onDelete = vi.fn()
    const onUpdate = vi.fn()

    render(<PaperDetailView paper={mockPaper} onUpdate={onUpdate} onDelete={onDelete} />)

    expect(screen.getByTitle('Delete paper')).toBeInTheDocument()
  })

  it('calls onDelete when delete button is clicked and confirmed', async () => {
    const onDelete = vi.fn().mockResolvedValue(true)
    const onUpdate = vi.fn()

    render(<PaperDetailView paper={mockPaper} onUpdate={onUpdate} onDelete={onDelete} />)

    const deleteButton = screen.getByTitle('Delete paper')
    fireEvent.click(deleteButton)

    // Check dialog
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument()

    // Confirm
    const confirmButton = screen.getByRole('button', { name: 'Delete' })
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('1')
    })
  })

  it('does not call onDelete when delete button is clicked and cancelled', async () => {
    const onDelete = vi.fn()
    const onUpdate = vi.fn()

    render(<PaperDetailView paper={mockPaper} onUpdate={onUpdate} onDelete={onDelete} />)

    const deleteButton = screen.getByTitle('Delete paper')
    fireEvent.click(deleteButton)

    // Check dialog
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()

    // Cancel
    const cancelButton = screen.getByRole('button', { name: 'Cancel' })
    fireEvent.click(cancelButton)

    expect(onDelete).not.toHaveBeenCalled()
    // Dialog should be gone (or closing)
    await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })
  })

  it('does not render delete button if onDelete is not provided', () => {
    const onUpdate = vi.fn()
    render(<PaperDetailView paper={mockPaper} onUpdate={onUpdate} />)
    expect(screen.queryByTitle('Delete paper')).not.toBeInTheDocument()
  })
})

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
    const onDelete = vi.fn()
    const onUpdate = vi.fn()

    // Mock window.confirm
    vi.spyOn(window, 'confirm').mockImplementation(() => true)

    render(<PaperDetailView paper={mockPaper} onUpdate={onUpdate} onDelete={onDelete} />)

    const deleteButton = screen.getByTitle('Delete paper')
    fireEvent.click(deleteButton)

    expect(window.confirm).toHaveBeenCalled()
    expect(onDelete).toHaveBeenCalledWith('1')
  })

  it('does not call onDelete when delete button is clicked and cancelled', async () => {
    const onDelete = vi.fn()
    const onUpdate = vi.fn()

    // Mock window.confirm
    vi.spyOn(window, 'confirm').mockImplementation(() => false)

    render(<PaperDetailView paper={mockPaper} onUpdate={onUpdate} onDelete={onDelete} />)

    const deleteButton = screen.getByTitle('Delete paper')
    fireEvent.click(deleteButton)

    expect(window.confirm).toHaveBeenCalled()
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('does not render delete button if onDelete is not provided', () => {
    const onUpdate = vi.fn()
    render(<PaperDetailView paper={mockPaper} onUpdate={onUpdate} />)
    expect(screen.queryByTitle('Delete paper')).not.toBeInTheDocument()
  })
})

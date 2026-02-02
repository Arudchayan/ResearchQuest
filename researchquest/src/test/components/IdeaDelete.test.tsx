import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { IdeaDetailView } from '../../components/entities/IdeaDetailView'
import type { Idea } from '../../types/database'

// Mock icons
vi.mock('lucide-react', () => ({
  Lightbulb: () => <span>Icon</span>,
  Calendar: () => <span>Icon</span>,
  TrendingUp: () => <span>Icon</span>,
  Edit2: () => <span>EditIcon</span>,
  Save: () => <span>SaveIcon</span>,
  X: () => <span>XIcon</span>,
  Trash: () => <span>TrashIcon</span>,
  Loader2: () => <span>Loader2Icon</span>,
}))

// Mock sub-components
vi.mock('../../components/topics/TopicSelector', () => ({
  TopicSelector: () => <div>TopicSelector</div>
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

const mockIdea: Idea = {
  id: '1',
  user_id: 'user1',
  title: 'Test Idea',
  description: 'Description',
  stage: 'Seed',
  created_at: '2023-01-01',
  updated_at: '2023-01-01',
}

describe('IdeaDetailView', () => {
  it('renders delete button when not editing', () => {
    const onDelete = vi.fn()
    const onUpdate = vi.fn()

    render(<IdeaDetailView idea={mockIdea} onUpdate={onUpdate} onDelete={onDelete} />)

    expect(screen.getByTitle('Delete idea')).toBeInTheDocument()
  })

  it('calls onDelete when delete button is clicked and confirmed', async () => {
    const onDelete = vi.fn()
    const onUpdate = vi.fn()

    // Mock window.confirm
    vi.spyOn(window, 'confirm').mockImplementation(() => true)

    render(<IdeaDetailView idea={mockIdea} onUpdate={onUpdate} onDelete={onDelete} />)

    const deleteButton = screen.getByTitle('Delete idea')
    fireEvent.click(deleteButton)

    expect(window.confirm).toHaveBeenCalled()
    expect(onDelete).toHaveBeenCalledWith('1')
  })

  it('does not call onDelete when delete button is clicked and cancelled', async () => {
    const onDelete = vi.fn()
    const onUpdate = vi.fn()

    // Mock window.confirm
    vi.spyOn(window, 'confirm').mockImplementation(() => false)

    render(<IdeaDetailView idea={mockIdea} onUpdate={onUpdate} onDelete={onDelete} />)

    const deleteButton = screen.getByTitle('Delete idea')
    fireEvent.click(deleteButton)

    expect(window.confirm).toHaveBeenCalled()
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('does not render delete button if onDelete is not provided', () => {
    const onUpdate = vi.fn()
    render(<IdeaDetailView idea={mockIdea} onUpdate={onUpdate} />)
    expect(screen.queryByTitle('Delete idea')).not.toBeInTheDocument()
  })
})

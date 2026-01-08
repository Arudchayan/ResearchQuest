import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import { CommandPalette } from '../../components/layout/CommandPalette'
import { useAppStore } from '../../store/appStore'

// Mock dependencies
// No useNavigate mock needed anymore as we don't use it

vi.mock('../../hooks/useNotes', () => ({
  useNotes: () => ({ notes: [{ id: '1', title: 'Test Note', markdown_body: '' }] })
}))

vi.mock('../../hooks/usePapers', () => ({
  usePapers: () => ({ papers: [{ id: '1', title: 'Test Paper', authors: [] }] })
}))

vi.mock('../../hooks/useIdeas', () => ({
  useIdeas: () => ({ ideas: [{ id: '1', title: 'Test Idea' }] })
}))

describe('CommandPalette', () => {
  const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView

  beforeAll(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
  })

  afterAll(() => {
    window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView
  })

  beforeEach(() => {
    vi.clearAllMocks()
    useAppStore.setState({
      effectiveTheme: 'light',
      setTheme: vi.fn(),
      setCurrentView: vi.fn(),
      setSelectedNote: vi.fn(),
      setSelectedPaper: vi.fn(),
      setSelectedIdea: vi.fn(),
      user: { id: 'test-user' } as any
    })
  })

  it('is closed by default', () => {
    render(<CommandPalette />)
    expect(screen.queryByPlaceholderText('Type a command or search...')).not.toBeInTheDocument()
  })

  it('opens when Cmd+K is pressed', async () => {
    render(<CommandPalette />)

    fireEvent.keyDown(document, { key: 'k', metaKey: true })

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Type a command or search...')).toBeInTheDocument()
    })
  })

  it('renders navigation commands', async () => {
    render(<CommandPalette />)
    fireEvent.keyDown(document, { key: 'k', metaKey: true })

    await waitFor(() => {
      expect(screen.getByText('Go to Notes')).toBeInTheDocument()
      expect(screen.getByText('Go to Papers')).toBeInTheDocument()
    })
  })

  it('renders search results', async () => {
    render(<CommandPalette />)
    fireEvent.keyDown(document, { key: 'k', metaKey: true })

    await waitFor(() => {
      expect(screen.getByText('Test Note')).toBeInTheDocument()
      expect(screen.getByText('Test Paper')).toBeInTheDocument()
      expect(screen.getByText('Test Idea')).toBeInTheDocument()
    })
  })

  it('filters results when typing', async () => {
    render(<CommandPalette />)
    fireEvent.keyDown(document, { key: 'k', metaKey: true })

    await waitFor(() => {
      const input = screen.getByPlaceholderText('Type a command or search...')
      fireEvent.change(input, { target: { value: 'Test Note' } })
    })

    await waitFor(() => {
      expect(screen.getByText('Test Note')).toBeInTheDocument()
    })
  })
})

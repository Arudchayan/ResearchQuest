import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CommandMenu } from '../../components/layout/CommandMenu'
import { useAppStore } from '../../store/appStore'
import { useNotes } from '../../hooks/useNotes'
import { usePapers } from '../../hooks/usePapers'
import { useIdeas } from '../../hooks/useIdeas'

// Mock dependencies
vi.mock('../../store/appStore', () => ({
  useAppStore: vi.fn(),
}))

vi.mock('../../hooks/useNotes', () => ({
  useNotes: vi.fn(),
}))

vi.mock('../../hooks/usePapers', () => ({
  usePapers: vi.fn(),
}))

vi.mock('../../hooks/useIdeas', () => ({
  useIdeas: vi.fn(),
}))

// Mock Dialog to render content immediately (radix-ui dialogs are portalled and tricky to test without setup)
// However, cmdk uses standard radix dialog. We can often rely on standard testing-library queries if we wait.
// For simplicity in unit testing, we can check if it opens on keypress.

describe('CommandMenu', () => {
  const setCurrentView = vi.fn()
  const setSelectedNote = vi.fn()
  const setSelectedPaper = vi.fn()
  const setSelectedIdea = vi.fn()
  const setTheme = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    // Default mocks
    ;(useAppStore as any).mockReturnValue({
      currentView: 'notes',
      setCurrentView,
      theme: 'light',
      effectiveTheme: 'light',
      setTheme,
      setSelectedNote,
      setSelectedPaper,
      setSelectedIdea,
    })

    ;(useNotes as any).mockReturnValue({ notes: [{ id: '1', title: 'Test Note', markdown_body: 'body' }] })
    ;(usePapers as any).mockReturnValue({ papers: [] })
    ;(useIdeas as any).mockReturnValue({ ideas: [] })
  })

  it('is closed by default', () => {
    render(<CommandMenu />)
    expect(screen.queryByPlaceholderText('Type a command or search...')).not.toBeInTheDocument()
  })

  it('opens when Cmd+K is pressed', async () => {
    render(<CommandMenu />)

    fireEvent.keyDown(document, { key: 'k', metaKey: true })

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Type a command or search...')).toBeInTheDocument()
    })
  })

  it('renders navigation items when open', async () => {
    render(<CommandMenu />)
    fireEvent.keyDown(document, { key: 'k', metaKey: true })

    await waitFor(() => {
      expect(screen.getByText('Go to Notes')).toBeInTheDocument()
      expect(screen.getByText('Go to Papers')).toBeInTheDocument()
    })
  })

  it('navigates to Notes view when selected', async () => {
    render(<CommandMenu />)
    fireEvent.keyDown(document, { key: 'k', metaKey: true })

    await waitFor(() => {
      const item = screen.getByText('Go to Notes')
      fireEvent.click(item)
    })

    expect(setCurrentView).toHaveBeenCalledWith('notes')
  })

  it('toggles theme when selected', async () => {
    render(<CommandMenu />)
    fireEvent.keyDown(document, { key: 'k', metaKey: true })

    await waitFor(() => {
      const item = screen.getByText('Toggle Theme')
      fireEvent.click(item)
    })

    expect(setTheme).toHaveBeenCalledWith('dark')
  })

  it('searches and shows results', async () => {
    render(<CommandMenu />)
    fireEvent.keyDown(document, { key: 'k', metaKey: true })

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Type a command or search...')).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText('Type a command or search...')
    fireEvent.change(input, { target: { value: 'Test' } })

    await waitFor(() => {
      expect(screen.getByText('Test Note')).toBeInTheDocument()
    })
  })
})

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CommandPalette } from '../../components/layout/CommandPalette'
import { useAppStore } from '../../store/appStore'

// Mock dependencies
vi.mock('../../store/appStore')
vi.mock('lucide-react', () => ({
  FileText: () => <span data-testid="icon-note" />,
  BookOpen: () => <span data-testid="icon-paper" />,
  Lightbulb: () => <span data-testid="icon-idea" />,
  CheckSquare: () => <span data-testid="icon-task" />,
  Target: () => <span data-testid="icon-focus" />,
  Search: () => <span data-testid="icon-search" />,
  Sun: () => <span data-testid="icon-sun" />,
  Moon: () => <span data-testid="icon-moon" />,
  Laptop: () => <span data-testid="icon-laptop" />,
  ArrowRight: () => <span data-testid="icon-arrow-right" />,
}))

describe('CommandPalette', () => {
  const mockSetCurrentView = vi.fn()
  const mockSetSelectedNote = vi.fn()
  const mockSetSelectedPaper = vi.fn()
  const mockSetSelectedIdea = vi.fn()
  const mockSetTheme = vi.fn()

  const defaultStore = {
    notes: [],
    papers: [],
    ideas: [],
    theme: 'light',
    setCurrentView: mockSetCurrentView,
    setSelectedNote: mockSetSelectedNote,
    setSelectedPaper: mockSetSelectedPaper,
    setSelectedIdea: mockSetSelectedIdea,
    setTheme: mockSetTheme,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAppStore).mockReturnValue(defaultStore as any)

    // Reset history state mock
    Object.defineProperty(window, 'history', {
      value: { pushState: vi.fn() },
      writable: true
    })
  })

  it('is initially hidden', () => {
    render(<CommandPalette />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens when Cmd+K is pressed', async () => {
    render(<CommandPalette />)

    fireEvent.keyDown(document, { key: 'k', metaKey: true })

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()
  })

  it('opens when Ctrl+K is pressed', async () => {
    render(<CommandPalette />)

    fireEvent.keyDown(document, { key: 'k', ctrlKey: true })

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })

  it('displays navigation items', async () => {
    render(<CommandPalette />)
    fireEvent.keyDown(document, { key: 'k', metaKey: true })

    await waitFor(() => {
      expect(screen.getByText('Go to Notes')).toBeInTheDocument()
      expect(screen.getByText('Go to Papers')).toBeInTheDocument()
      expect(screen.getByText('Go to Ideas')).toBeInTheDocument()
    })
  })

  it('navigates to Notes view when selected', async () => {
    render(<CommandPalette />)
    fireEvent.keyDown(document, { key: 'k', metaKey: true })

    const notesItem = await screen.findByText('Go to Notes')
    fireEvent.click(notesItem)

    expect(mockSetCurrentView).toHaveBeenCalledWith('notes')
    expect(window.history.pushState).toHaveBeenCalledWith(null, '', '/')
  })

  it('displays and selects notes from store', async () => {
    vi.mocked(useAppStore).mockReturnValue({
      ...defaultStore,
      notes: [
        { id: '1', title: 'Test Note', markdown_body: 'Content', tags: [] }
      ]
    } as any)

    render(<CommandPalette />)
    fireEvent.keyDown(document, { key: 'k', metaKey: true })

    const noteItem = await screen.findByText('Test Note')
    fireEvent.click(noteItem)

    expect(mockSetSelectedNote).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }))
    expect(mockSetCurrentView).toHaveBeenCalledWith('notes')
    expect(window.history.pushState).toHaveBeenCalledWith(null, '', '/notes/1')
  })

  it('displays and selects papers from store', async () => {
    vi.mocked(useAppStore).mockReturnValue({
      ...defaultStore,
      papers: [
        { id: 'p1', title: 'Research Paper', authors: ['Author A'], status: 'To Read', publication_date: '2023-01-01' }
      ]
    } as any)

    render(<CommandPalette />)
    fireEvent.keyDown(document, { key: 'k', metaKey: true })

    const paperItem = await screen.findByText('Research Paper')
    fireEvent.click(paperItem)

    expect(mockSetSelectedPaper).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }))
    expect(mockSetCurrentView).toHaveBeenCalledWith('papers')
    expect(window.history.pushState).toHaveBeenCalledWith(null, '', '/papers/p1')
  })

  it('toggles theme correctly', async () => {
    render(<CommandPalette />)
    fireEvent.keyDown(document, { key: 'k', metaKey: true })

    const darkThemeItem = await screen.findByText('Dark Mode')
    fireEvent.click(darkThemeItem)

    expect(mockSetTheme).toHaveBeenCalledWith('dark')
  })
})

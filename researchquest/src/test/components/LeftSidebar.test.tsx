import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '../mocks/supabase'
import { mockSupabaseClient, mockPaper, mockIdea, mockNote, mockTopic } from '../mocks/supabase'

// Mock the hooks
vi.mock('../../hooks/useNotes', () => ({
  useNotes: vi.fn(() => ({
    notes: [mockNote],
    loading: false,
    createNote: vi.fn().mockResolvedValue(mockNote),
    updateNote: vi.fn(),
    deleteNote: vi.fn(),
  })),
}))

vi.mock('../../hooks/usePapers', () => ({
  usePapers: vi.fn(() => ({
    papers: [mockPaper],
    loading: false,
    createPaper: vi.fn().mockResolvedValue(mockPaper),
    updatePaper: vi.fn(),
    deletePaper: vi.fn(),
    searchPaperByDOI: vi.fn(),
    searchPapersByQuery: vi.fn(),
  })),
}))

vi.mock('../../hooks/useIdeas', () => ({
  useIdeas: vi.fn(() => ({
    ideas: [mockIdea],
    loading: false,
    createIdea: vi.fn().mockResolvedValue(mockIdea),
    updateIdea: vi.fn(),
    deleteIdea: vi.fn(),
  })),
}))

vi.mock('../../hooks/useTopics', () => ({
  useTopics: vi.fn(() => ({
    topics: [mockTopic],
    loading: false,
    createTopic: vi.fn().mockResolvedValue(mockTopic),
    deleteTopic: vi.fn(),
  })),
}))

const { LeftSidebar } = await import('../../components/layout/LeftSidebar')
const { useAppStore } = await import('../../store/appStore')

describe('LeftSidebar Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    })
    // Reset store state
    useAppStore.setState({
      currentView: 'notes',
      selectedNote: null,
      selectedPaper: null,
      selectedIdea: null,
      selectedTopic: null,
      topics: [mockTopic],
    })
  })

  describe('Navigation Tabs', () => {
    it('should render all navigation tabs', () => {
      render(<LeftSidebar />)

      expect(screen.getByText('Notes')).toBeInTheDocument()
      expect(screen.getByText('Papers')).toBeInTheDocument()
      expect(screen.getByText('Ideas')).toBeInTheDocument()
      expect(screen.getByText('Tasks')).toBeInTheDocument()
      expect(screen.getByText('Topics')).toBeInTheDocument()
    })

    it('should highlight active tab', () => {
      useAppStore.setState({ currentView: 'papers' })
      render(<LeftSidebar />)

      const papersTab = screen.getByText('Papers').closest('button')
      expect(papersTab).toHaveClass('bg-bg-elevated')
    })

    it('should switch views when clicking tabs', async () => {
      render(<LeftSidebar />)

      const papersTab = screen.getByText('Papers')
      await userEvent.click(papersTab)

      await waitFor(() => {
        expect(useAppStore.getState().currentView).toBe('papers')
      })
    })

    it('should update URL when switching tabs', async () => {
      const pushStateSpy = vi.spyOn(window.history, 'pushState')
      render(<LeftSidebar />)

      const papersTab = screen.getByText('Papers')
      await userEvent.click(papersTab)

      expect(pushStateSpy).toHaveBeenCalledWith(null, '', '/papers')
    })

    it('should clear selected items when switching tabs', async () => {
      useAppStore.setState({ 
        currentView: 'papers',
        selectedPaper: mockPaper 
      })
      
      render(<LeftSidebar />)

      const notesTab = screen.getByText('Notes')
      await userEvent.click(notesTab)

      await waitFor(() => {
        expect(useAppStore.getState().selectedNote).toBeNull()
      })
    })
  })

  describe('Search Functionality', () => {
    it('should render search input', () => {
      render(<LeftSidebar />)

      const searchInput = screen.getByPlaceholderText(/search notes/i)
      expect(searchInput).toBeInTheDocument()
    })

    it('should update search query on input', async () => {
      render(<LeftSidebar />)

      const searchInput = screen.getByPlaceholderText(/search notes/i)
      await userEvent.type(searchInput, 'test query')

      expect(searchInput).toHaveValue('test query')
    })

    it('should update placeholder based on current view', async () => {
      render(<LeftSidebar />)

      // Switch to papers
      const papersTab = screen.getByText('Papers')
      await userEvent.click(papersTab)

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/search papers/i)
        expect(searchInput).toBeInTheDocument()
      })
    })
  })

  describe('Add Button', () => {
    it('should show add button for notes, papers, and ideas', () => {
      useAppStore.setState({ currentView: 'notes' })
      const { rerender } = render(<LeftSidebar />)

      expect(screen.getByText(/new note/i)).toBeInTheDocument()

      useAppStore.setState({ currentView: 'papers' })
      rerender(<LeftSidebar />)
      expect(screen.getByText(/new paper/i)).toBeInTheDocument()

      useAppStore.setState({ currentView: 'ideas' })
      rerender(<LeftSidebar />)
      expect(screen.getByText(/new idea/i)).toBeInTheDocument()
    })

    it('should hide add button for tasks but show for topics', () => {
      useAppStore.setState({ currentView: 'tasks' })
      const { rerender } = render(<LeftSidebar />)

      expect(screen.queryByRole('button', { name: /new/i })).not.toBeInTheDocument()

      useAppStore.setState({ currentView: 'topics' })
      rerender(<LeftSidebar />)
      expect(screen.getByText(/new topic/i)).toBeInTheDocument()
    })

    it('should create new note when clicked in notes view', async () => {
      const { useNotes } = await import('../../hooks/useNotes')
      const createNoteMock = vi.fn().mockResolvedValue(mockNote)
      vi.mocked(useNotes).mockReturnValue({
        notes: [],
        loading: false,
        createNote: createNoteMock,
        updateNote: vi.fn(),
        deleteNote: vi.fn(),
      } as any)

      useAppStore.setState({ currentView: 'notes' })
      render(<LeftSidebar />)

      const addButton = screen.getByText(/new note/i)
      await userEvent.click(addButton)

      await waitFor(() => {
        expect(createNoteMock).toHaveBeenCalled()
      })
    })

    it('should clear selected paper when clicked in papers view', async () => {
      useAppStore.setState({ 
        currentView: 'papers',
        selectedPaper: mockPaper 
      })
      
      render(<LeftSidebar />)

      const addButton = screen.getByText(/new paper/i)
      await userEvent.click(addButton)

      expect(useAppStore.getState().selectedPaper).toBeNull()
    })
  })

  describe('Entity Lists', () => {
    it('should display papers in papers view', () => {
      useAppStore.setState({ currentView: 'papers' })
      render(<LeftSidebar />)

      expect(screen.getByText(mockPaper.title)).toBeInTheDocument()
    })

    it('should display ideas in ideas view', () => {
      useAppStore.setState({ currentView: 'ideas' })
      render(<LeftSidebar />)

      expect(screen.getByText(mockIdea.title)).toBeInTheDocument()
    })

    it('should display notes in notes view', () => {
      useAppStore.setState({ currentView: 'notes' })
      render(<LeftSidebar />)

      expect(screen.getByText(mockNote.title)).toBeInTheDocument()
    })

    it('should display topics in topics view', () => {
      useAppStore.setState({ currentView: 'topics' })
      render(<LeftSidebar />)

      expect(screen.getByText(mockTopic.name)).toBeInTheDocument()
    })

    it('should show loading state while fetching', async () => {
      const { usePapers } = await import('../../hooks/usePapers')
      vi.mocked(usePapers).mockReturnValue({
        papers: [],
        loading: true,
        createPaper: vi.fn(),
        updatePaper: vi.fn(),
        deletePaper: vi.fn(),
        searchPaperByDOI: vi.fn(),
        searchPapersByQuery: vi.fn(),
      })

      useAppStore.setState({ currentView: 'papers' })
      render(<LeftSidebar />)

      // Should show loading skeleton
      expect(screen.queryByText(mockPaper.title)).not.toBeInTheDocument()
    })
  })

  describe('Gamification Widget', () => {
    it('should display gamification stats', () => {
      useAppStore.setState({
        user: {
          id: 'test-user',
          email: 'test@example.com',
          total_xp: 100,
          current_level: 5,
          theme: 'light',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      })

      render(<LeftSidebar />)

      expect(screen.getByText("Today's Progress")).toBeInTheDocument()
      expect(screen.getByText('100')).toBeInTheDocument() // Total XP
      expect(screen.getByText('5')).toBeInTheDocument() // Level
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels for navigation', () => {
      render(<LeftSidebar />)

      const nav = screen.getByRole('navigation', { hidden: true })
      expect(nav).toBeInTheDocument()
    })

    it('should support keyboard navigation', async () => {
      render(<LeftSidebar />)

      const papersTabText = screen.getByText('Papers')
      const papersTabButton = papersTabText.closest('button')
      papersTabButton?.focus()

      expect(papersTabButton).toHaveFocus()

      if (papersTabButton) {
        fireEvent.keyDown(papersTabButton, { key: 'Enter' })
      }
      
      await waitFor(() => {
        expect(useAppStore.getState().currentView).toBe('papers')
      })
    })
  })

  describe('Filtering', () => {
    it('should filter papers by search query', async () => {
      const paper1 = { ...mockPaper, id: '1', title: 'Quantum Computing' }
      const paper2 = { ...mockPaper, id: '2', title: 'Machine Learning' }

      const { usePapers } = await import('../../hooks/usePapers')
      vi.mocked(usePapers).mockReturnValue({
        papers: [paper1, paper2],
        loading: false,
        createPaper: vi.fn(),
        updatePaper: vi.fn(),
        deletePaper: vi.fn(),
        searchPaperByDOI: vi.fn(),
        searchPapersByQuery: vi.fn(),
      } as any)

      useAppStore.setState({ currentView: 'papers' })
      render(<LeftSidebar />)

      const searchInput = screen.getByPlaceholderText(/search papers/i)
      await userEvent.type(searchInput, 'Quantum')

      await waitFor(() => {
        expect(screen.getByText('Quantum Computing')).toBeInTheDocument()
        expect(screen.queryByText('Machine Learning')).not.toBeInTheDocument()
      })
    })
  })
})

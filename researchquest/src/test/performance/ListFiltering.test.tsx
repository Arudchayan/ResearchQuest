import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { NotesView } from '../../components/notes/NotesView'
import { PapersView } from '../../components/papers/PapersView'
import { useAppStore } from '../../store/appStore'

// Mock dependencies
vi.mock('../../store/appStore', () => ({
  useAppStore: vi.fn(),
}))

vi.mock('../../hooks/useNotes', () => ({
  useNotes: vi.fn(() => ({
    createNote: vi.fn(),
    deleteNote: vi.fn(),
  })),
}))

vi.mock('../../hooks/usePapers', () => ({
  usePapers: vi.fn(() => ({
    createPaper: vi.fn(),
    updatePaper: vi.fn(),
    deletePaper: vi.fn(),
    restorePaper: vi.fn(),
    searchPaperByDOI: vi.fn(),
    searchPapersByQuery: vi.fn(),
  })),
}))

vi.mock('../../components/ui/ConfirmDialog', () => ({
  ConfirmDialog: () => null,
  useConfirmDialog: () => ({ confirm: vi.fn(), isOpen: false, config: {} }),
}))

// Mock NoteCard to render minimally
vi.mock('../../components/notes/NoteCard', () => ({
  NoteCard: ({ note }: any) => <div data-testid="note-card">{note.title}</div>
}))

// Mock PaperCard
vi.mock('../../components/papers/PaperCard', () => ({
  PaperCard: ({ paper }: any) => <div data-testid="paper-card">{paper.title}</div>
}))

// Mock PaperCardSkeleton
vi.mock('../../components/ui/Skeleton', () => ({
  PaperCardSkeleton: () => <div data-testid="paper-skeleton" />
}))

// Mock MarkdownEditor
vi.mock('../../components/editor/MarkdownEditor', () => ({
  MarkdownEditor: () => <div data-testid="markdown-editor">Editor</div>
}))

// Mock OnboardingGuide
vi.mock('../../components/layout/OnboardingGuide', () => ({
  OnboardingGuide: () => null
}))

describe('ListFiltering Performance', () => {
  const mockNotes = [
    { id: '1', title: 'Note 1', markdown_body: 'Body content ONE', updated_at: new Date().toISOString() },
    { id: '2', title: 'Note 2', markdown_body: 'Body content TWO', updated_at: new Date().toISOString() },
  ]

  const mockPapers = [
    { id: 'p1', title: 'Paper 1', authors: ['Author A'], updated_at: new Date().toISOString() },
    { id: 'p2', title: 'Paper 2', authors: ['Author B'], updated_at: new Date().toISOString() },
  ]

  beforeEach(() => {
    vi.clearAllMocks();
    (useAppStore as any).mockImplementation((selector: any) => {
        const state = {
            notes: mockNotes,
            papers: mockPapers,
            papersLoading: false,
            selectedNote: null,
            selectedPaper: null,
            setSelectedNote: vi.fn(),
            setSelectedPaper: vi.fn(),
            user: { id: 'test-user' }
        }
        return selector ? selector(state) : state
    });
    (useAppStore as any).getState = () => ({
        user: { id: 'test-user' },
        selectedNote: null,
        selectedPaper: null,
        notes: mockNotes,
        papers: mockPapers
    });
  })

  it('should verify optimization: filter is NOT called on notes when search query is empty', () => {
    const filterSpy = vi.spyOn(Array.prototype, 'filter')
    render(<NotesView />)
    const calledOnMockNotes = filterSpy.mock.instances.some(instance => instance === mockNotes)
    expect(calledOnMockNotes).toBe(false)
    filterSpy.mockRestore()
  })

  it('should verify optimization: filter is NOT called on papers when search query is empty', () => {
    const filterSpy = vi.spyOn(Array.prototype, 'filter')
    render(<PapersView />)
    const calledOnMockPapers = filterSpy.mock.instances.some(instance => instance === mockPapers)
    expect(calledOnMockPapers).toBe(false)
    filterSpy.mockRestore()
  })
})

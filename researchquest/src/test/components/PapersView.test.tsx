import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PapersView } from '../../components/papers/PapersView'
import { useAppStore } from '../../store/appStore'
import type { Paper } from '../../types/database'

// Mock usePapers
vi.mock('../../hooks/usePapers', () => ({
  usePapers: () => ({
    createPaper: vi.fn(),
    updatePaper: vi.fn(),
    searchPaperByDOI: vi.fn(),
    searchPapersByQuery: vi.fn(),
  }),
}))

describe('PapersView Component', () => {
  const mockPapers: Paper[] = [
    {
      id: '1',
      user_id: 'user1',
      title: 'A Paper',
      authors: ['Author A'],
      status: 'To Read',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-10T00:00:00Z',
      publication_date: '2020-01-01',
    },
    {
      id: '2',
      user_id: 'user1',
      title: 'B Paper',
      authors: ['Author B'],
      status: 'Read',
      created_at: '2023-01-05T00:00:00Z',
      updated_at: '2023-01-05T00:00:00Z',
      publication_date: '2022-01-01',
    },
    {
      id: '3',
      user_id: 'user1',
      title: 'C Paper',
      authors: ['Author C'],
      status: 'Reading',
      created_at: '2023-01-02T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z', // Oldest updated
      publication_date: '2021-01-01',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    useAppStore.setState({ papers: mockPapers, selectedPaper: null, user: { id: 'user1' } as any })
  })

  it('should render paper list', () => {
    render(<PapersView />)
    expect(screen.getByText('A Paper')).toBeInTheDocument()
    expect(screen.getByText('B Paper')).toBeInTheDocument()
    expect(screen.getByText('C Paper')).toBeInTheDocument()
  })

  it('should default to sort by Last Updated (Newest)', () => {
    render(<PapersView />)
    const papers = screen.getAllByText(/Paper/)
    // Filter to only title elements or assume the first occurrences are titles/cards
    // The previous test shows titles are present.
    // Let's rely on the order of elements in the document.
    // However, finding "A Paper" specifically might be tricky if it appears elsewhere.
    // In PapersView, the title is in an h3.

    // We can get all h3 elements
    const titles = screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent)
    // There might be "No papers found" h3 if list is empty, but here we have papers.
    // The first h3 is "Research Library" if I recall correctly? No, that's h1.
    // Wait, "Research Library" is h1.
    // "Paper Details" is h2 in the drawer.
    // "No papers found" is h3.
    // Paper title is h3.

    // Let's filter titles to match our papers
    const paperTitles = titles.filter(t => ['A Paper', 'B Paper', 'C Paper'].includes(t || ''))

    expect(paperTitles).toEqual(['A Paper', 'B Paper', 'C Paper'])
  })

  it('should sort by Last Updated (Oldest)', () => {
    render(<PapersView />)
    const sortSelect = screen.getByLabelText('Sort papers')
    fireEvent.change(sortSelect, { target: { value: 'updated_asc' } })

    const titles = screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent)
    const paperTitles = titles.filter(t => ['A Paper', 'B Paper', 'C Paper'].includes(t || ''))

    // C (Jan 1), B (Jan 5), A (Jan 10)
    expect(paperTitles).toEqual(['C Paper', 'B Paper', 'A Paper'])
  })

  it('should sort by Title (A-Z)', () => {
    render(<PapersView />)
    const sortSelect = screen.getByLabelText('Sort papers')
    fireEvent.change(sortSelect, { target: { value: 'title_asc' } })

    const titles = screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent)
    const paperTitles = titles.filter(t => ['A Paper', 'B Paper', 'C Paper'].includes(t || ''))

    expect(paperTitles).toEqual(['A Paper', 'B Paper', 'C Paper'])
  })

  it('should sort by Title (Z-A)', () => {
    render(<PapersView />)
    const sortSelect = screen.getByLabelText('Sort papers')
    fireEvent.change(sortSelect, { target: { value: 'title_desc' } })

    const titles = screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent)
    const paperTitles = titles.filter(t => ['A Paper', 'B Paper', 'C Paper'].includes(t || ''))

    expect(paperTitles).toEqual(['C Paper', 'B Paper', 'A Paper'])
  })

  it('should sort by Publication Year (Newest)', () => {
    render(<PapersView />)
    const sortSelect = screen.getByLabelText('Sort papers')
    fireEvent.change(sortSelect, { target: { value: 'year_desc' } })

    const titles = screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent)
    const paperTitles = titles.filter(t => ['A Paper', 'B Paper', 'C Paper'].includes(t || ''))

    // B (2022), C (2021), A (2020)
    expect(paperTitles).toEqual(['B Paper', 'C Paper', 'A Paper'])
  })
})

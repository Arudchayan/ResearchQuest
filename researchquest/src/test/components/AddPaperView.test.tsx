import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddPaperView } from '../../components/entities/AddPaperView'
import type { CrossrefPaper } from '../../types/database'

describe('AddPaperView Component', () => {
  const mockOnAdd = vi.fn()
  const mockSearchByDOI = vi.fn()
  const mockSearchByQuery = vi.fn()

  const mockCrossrefPaper: CrossrefPaper = {
    title: 'Test Paper from CrossRef',
    authors: ['Author One', 'Author Two'],
    doi: '10.1234/test.doi',
    sourceUrl: 'https://example.com/paper',
    abstract: 'This is a test abstract',
    publicationDate: '2024',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockOnAdd.mockResolvedValue({ id: 'new-paper-id', ...mockCrossrefPaper })
  })

  describe('Tab Navigation', () => {
    it('should render all tabs', () => {
      render(
        <AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        />
      )

      expect(screen.getByText('DOI Search')).toBeInTheDocument()
      expect(screen.getByText('Keyword Search')).toBeInTheDocument()
      expect(screen.getByText('Manual Entry')).toBeInTheDocument()
    })

    it('should switch between tabs', async () => {
      render(
        <AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        />
      )

      const keywordTab = screen.getByText('Keyword Search')
      await userEvent.click(keywordTab)

      expect(screen.getByPlaceholderText(/e.g., CRISPR gene editing/i)).toBeInTheDocument()

      const manualTab = screen.getByText('Manual Entry')
      await userEvent.click(manualTab)

      expect(screen.getByPlaceholderText(/Enter paper title/i)).toBeInTheDocument()
    })

    it('should clear errors when switching tabs', async () => {
      mockSearchByDOI.mockResolvedValue(null)

      render(
        <AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        />
      )

      // Trigger an error in DOI tab
      const doiInput = screen.getByPlaceholderText(/e.g., 10.1038/i)
      await userEvent.type(doiInput, '10.1234/notfound')
      
      const searchButtons = screen.getAllByRole('button', { name: /search/i })
      await userEvent.click(searchButtons[0])

      await waitFor(() => {
        expect(screen.getByText(/paper not found/i)).toBeInTheDocument()
      })

      // Switch tabs - error should clear
      const keywordTab = screen.getByText('Keyword Search')
      await userEvent.click(keywordTab)

      await waitFor(() => {
        expect(screen.queryByText(/paper not found/i)).not.toBeInTheDocument()
      })
    })
  })

  describe('DOI Search', () => {
    it('should search paper by DOI', async () => {
      mockSearchByDOI.mockResolvedValue(mockCrossrefPaper)

      render(
        <AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        />
      )

      const doiInput = screen.getByPlaceholderText(/e.g., 10.1038/i)
      await userEvent.type(doiInput, '10.1234/test.doi')

      const searchButton = screen.getByRole('button', { name: /search/i })
      await userEvent.click(searchButton)

      await waitFor(() => {
        expect(mockSearchByDOI).toHaveBeenCalledWith('10.1234/test.doi')
        expect(screen.getByText(mockCrossrefPaper.title)).toBeInTheDocument()
      })
    })

    it('should handle Enter key for DOI search', async () => {
      mockSearchByDOI.mockResolvedValue(mockCrossrefPaper)

      render(
        <AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        />
      )

      const doiInput = screen.getByPlaceholderText(/e.g., 10.1038/i)
      await userEvent.type(doiInput, '10.1234/test.doi{Enter}')

      await waitFor(() => {
        expect(mockSearchByDOI).toHaveBeenCalledWith('10.1234/test.doi')
      })
    })

    it('should add paper from DOI search result', async () => {
      mockSearchByDOI.mockResolvedValue(mockCrossrefPaper)

      render(
        <AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        />
      )

      const doiInput = screen.getByPlaceholderText(/e.g., 10.1038/i)
      await userEvent.type(doiInput, '10.1234/test.doi')

      const searchButton = screen.getByRole('button', { name: /search/i })
      await userEvent.click(searchButton)

      await waitFor(() => {
        expect(screen.getByText(mockCrossrefPaper.title)).toBeInTheDocument()
      })

      const addButton = screen.getByRole('button', { name: /add paper to library/i })
      await userEvent.click(addButton)

      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenCalledWith({
          title: mockCrossrefPaper.title,
          authors: mockCrossrefPaper.authors,
          doi: mockCrossrefPaper.doi,
          source_url: mockCrossrefPaper.sourceUrl,
          abstract: mockCrossrefPaper.abstract,
          publication_date: mockCrossrefPaper.publicationDate?.toString(),
        })
      })
    })

    it('should show success message after adding paper', async () => {
      mockSearchByDOI.mockResolvedValue(mockCrossrefPaper)

      render(
        <AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        />
      )

      const doiInput = screen.getByPlaceholderText(/e.g., 10.1038/i)
      await userEvent.type(doiInput, '10.1234/test.doi')

      const searchButton = screen.getByRole('button', { name: /search/i })
      await userEvent.click(searchButton)

      await waitFor(() => {
        expect(screen.getByText(mockCrossrefPaper.title)).toBeInTheDocument()
      })

      const addButton = screen.getByRole('button', { name: /add paper to library/i })
      await userEvent.click(addButton)

      await waitFor(() => {
        expect(screen.getByText(/paper added successfully/i)).toBeInTheDocument()
      })
    })

    it('should handle DOI search errors', async () => {
      mockSearchByDOI.mockResolvedValue(null)

      render(
        <AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        />
      )

      const doiInput = screen.getByPlaceholderText(/e.g., 10.1038/i)
      await userEvent.type(doiInput, '10.1234/notfound')

      const searchButton = screen.getByRole('button', { name: /search/i })
      await userEvent.click(searchButton)

      await waitFor(() => {
        expect(screen.getByText(/paper not found/i)).toBeInTheDocument()
      })
    })
  })

  describe('Keyword Search', () => {
    it('should search papers by keywords', async () => {
      const mockResults = [mockCrossrefPaper]
      mockSearchByQuery.mockResolvedValue(mockResults)

      render(
        <AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        />
      )

      const keywordTab = screen.getByText('Keyword Search')
      await userEvent.click(keywordTab)

      const searchInput = screen.getByPlaceholderText(/e.g., CRISPR gene editing/i)
      await userEvent.type(searchInput, 'quantum computing')

      const searchButton = screen.getByRole('button', { name: /search/i })
      await userEvent.click(searchButton)

      await waitFor(() => {
        expect(mockSearchByQuery).toHaveBeenCalledWith('quantum computing')
        expect(screen.getByText(mockCrossrefPaper.title)).toBeInTheDocument()
      })
    })

    it('should add paper from keyword search results', async () => {
      const mockResults = [mockCrossrefPaper]
      mockSearchByQuery.mockResolvedValue(mockResults)

      render(
        <AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        />
      )

      const keywordTab = screen.getByText('Keyword Search')
      await userEvent.click(keywordTab)

      const searchInput = screen.getByPlaceholderText(/e.g., CRISPR gene editing/i)
      await userEvent.type(searchInput, 'quantum computing')

      const searchButton = screen.getByRole('button', { name: /search/i })
      await userEvent.click(searchButton)

      await waitFor(() => {
        expect(screen.getByText(mockCrossrefPaper.title)).toBeInTheDocument()
      })

      const paperCard = screen.getByText(mockCrossrefPaper.title)
      await userEvent.click(paperCard)

      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenCalled()
      })
    })

    it('should handle empty search results', async () => {
      mockSearchByQuery.mockResolvedValue([])

      render(
        <AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        />
      )

      const keywordTab = screen.getByText('Keyword Search')
      await userEvent.click(keywordTab)

      const searchInput = screen.getByPlaceholderText(/e.g., CRISPR gene editing/i)
      await userEvent.type(searchInput, 'nonexistent query')

      const searchButton = screen.getByRole('button', { name: /search/i })
      await userEvent.click(searchButton)

      await waitFor(() => {
        expect(screen.getByText(/no papers found/i)).toBeInTheDocument()
      })
    })
  })

  describe('Manual Entry', () => {
    it('should add paper via manual entry', async () => {
      render(
        <AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        />
      )

      const manualTab = screen.getByText('Manual Entry')
      await userEvent.click(manualTab)

      const titleInput = screen.getByPlaceholderText(/enter paper title/i)
      await userEvent.type(titleInput, 'Manual Test Paper')

      const authorsInput = screen.getByPlaceholderText(/John Doe, Jane Smith/i)
      await userEvent.type(authorsInput, 'Author One, Author Two')

      const addButton = screen.getByRole('button', { name: /add paper/i })
      await userEvent.click(addButton)

      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenCalledWith({
          title: 'Manual Test Paper',
          authors: ['Author One', 'Author Two'],
          doi: undefined,
          source_url: undefined,
        })
      })
    })

    it('should require title for manual entry', async () => {
      render(
        <AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        />
      )

      const manualTab = screen.getByText('Manual Entry')
      await userEvent.click(manualTab)

      const addButton = screen.getByRole('button', { name: /add paper/i })
      expect(addButton).toBeDisabled()
    })

    it('should handle optional fields in manual entry', async () => {
      render(
        <AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        />
      )

      const manualTab = screen.getByText('Manual Entry')
      await userEvent.click(manualTab)

      const titleInput = screen.getByPlaceholderText(/enter paper title/i)
      await userEvent.type(titleInput, 'Manual Test Paper')

      const doiInput = screen.getByPlaceholderText('10.1038/nature12373')
      await userEvent.type(doiInput, '10.1234/manual.doi')

      const urlInput = screen.getByPlaceholderText('https://...')
      await userEvent.type(urlInput, 'https://example.com/manual')

      const addButton = screen.getByRole('button', { name: /add paper/i })
      await userEvent.click(addButton)

      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenCalledWith({
          title: 'Manual Test Paper',
          authors: [],
          doi: '10.1234/manual.doi',
          source_url: 'https://example.com/manual',
        })
      })
    })
  })

  describe('Loading States', () => {
    it('should show loading indicator during DOI search', async () => {
      let resolveSearch: (value: any) => void
      const searchPromise = new Promise((resolve) => {
        resolveSearch = resolve
      })
      mockSearchByDOI.mockReturnValue(searchPromise)

      render(
        <AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        />
      )

      const doiInput = screen.getByPlaceholderText(/e.g., 10.1038/i)
      await userEvent.type(doiInput, '10.1234/test.doi')

      const searchButton = screen.getByRole('button', { name: /search/i })
      await userEvent.click(searchButton)

      // Should show loading spinner
      expect(searchButton).toBeDisabled()

      resolveSearch!(mockCrossrefPaper)

      await waitFor(() => {
        expect(searchButton).not.toBeDisabled()
      })
    })

    it('should disable search button when input is empty', () => {
      render(
        <AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        />
      )

      const searchButton = screen.getByRole('button', { name: /search/i })
      expect(searchButton).toBeDisabled()
    })
  })

  describe('Paper Metadata Display', () => {
    it('should display paper abstract when available', async () => {
      mockSearchByDOI.mockResolvedValue(mockCrossrefPaper)

      render(
        <AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        />
      )

      const doiInput = screen.getByPlaceholderText(/e.g., 10.1038/i)
      await userEvent.type(doiInput, '10.1234/test.doi')

      const searchButton = screen.getByRole('button', { name: /search/i })
      await userEvent.click(searchButton)

      await waitFor(() => {
        expect(screen.getByText(mockCrossrefPaper.abstract!)).toBeInTheDocument()
      })
    })

    it('should display multiple authors correctly', async () => {
      mockSearchByDOI.mockResolvedValue(mockCrossrefPaper)

      render(
        <AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        />
      )

      const doiInput = screen.getByPlaceholderText(/e.g., 10.1038/i)
      await userEvent.type(doiInput, '10.1234/test.doi')

      const searchButton = screen.getByRole('button', { name: /search/i })
      await userEvent.click(searchButton)

      await waitFor(() => {
        expect(screen.getByText(/Author One, Author Two/)).toBeInTheDocument()
      })
    })

    it('should show "et al." for papers with many authors', async () => {
      const manyAuthorsPaper = {
        ...mockCrossrefPaper,
        authors: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7'],
      }
      mockSearchByDOI.mockResolvedValue(manyAuthorsPaper)

      render(
        <AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        />
      )

      const doiInput = screen.getByPlaceholderText(/e.g., 10.1038/i)
      await userEvent.type(doiInput, '10.1234/test.doi')

      const searchButton = screen.getByRole('button', { name: /search/i })
      await userEvent.click(searchButton)

      await waitFor(() => {
        expect(screen.getByText(/et al\./)).toBeInTheDocument()
      })
    })
  })
})

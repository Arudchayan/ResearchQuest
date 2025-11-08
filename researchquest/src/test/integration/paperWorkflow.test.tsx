import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../../App'
import { mockSupabaseClient, mockPaper } from '../mocks/supabase'
import type { CrossrefPaper } from '../../types/database'

/**
 * Integration Tests: Paper Workflow
 * 
 * These tests verify the complete user journey for working with papers,
 * from searching and adding to viewing and updating in the sidebar.
 */

describe('Paper Workflow Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock authenticated user
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
          },
        },
      },
      error: null,
    })

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
        },
      },
      error: null,
    })

    // Mock user profile
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'user_profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'test-user-id',
              email: 'test@example.com',
              total_xp: 100,
              current_level: 5,
            },
            error: null,
          }),
        }
      }
      if (table === 'papers') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }
    })
  })

  describe('Complete Paper Addition Flow', () => {
    it('should allow user to add paper via DOI and see it immediately in sidebar', async () => {
      const mockCrossrefPaper: CrossrefPaper = {
        title: 'Integration Test Paper',
        authors: ['Test Author'],
        doi: '10.1234/integration.test',
        sourceUrl: 'https://example.com',
        abstract: 'Integration test abstract',
        publicationDate: '2024',
      }

      // Mock CrossRef search
      mockSupabaseClient.functions.invoke.mockResolvedValue({
        data: { data: mockCrossrefPaper },
        error: null,
      })

      // Mock paper creation
      const createdPaper = {
        id: 'new-paper-id',
        user_id: 'test-user-id',
        title: mockCrossrefPaper.title,
        authors: mockCrossrefPaper.authors,
        doi: mockCrossrefPaper.doi,
        source_url: mockCrossrefPaper.sourceUrl,
        abstract: mockCrossrefPaper.abstract,
        status: 'To Read',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      let insertCalled = false
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'papers' && !insertCalled) {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: createdPaper, error: null }),
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      })

      render(<App />)

      // Wait for app to load
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
      })

      // Navigate to Papers view
      const papersTab = screen.getByText('Papers')
      await userEvent.click(papersTab)

      // Should show AddPaperView
      await waitFor(() => {
        expect(screen.getByText('Add Paper to Library')).toBeInTheDocument()
      })

      // Enter DOI
      const doiInput = screen.getByPlaceholderText(/e.g., 10.1038/i)
      await userEvent.type(doiInput, '10.1234/integration.test')

      // Search
      const searchButton = screen.getAllByRole('button', { name: /search/i })[0]
      await userEvent.click(searchButton)

      // Wait for results
      await waitFor(() => {
        expect(screen.getByText(mockCrossrefPaper.title)).toBeInTheDocument()
      })

      // Add paper
      const addButton = screen.getByRole('button', { name: /add paper to library/i })
      await userEvent.click(addButton)

      // Verify success message
      await waitFor(() => {
        expect(screen.getByText(/paper added successfully/i)).toBeInTheDocument()
      })

      // Verify paper appears in sidebar immediately (no refresh needed)
      await waitFor(() => {
        const sidebar = screen.getByText('Recent papers')
        expect(sidebar).toBeInTheDocument()
        // Paper should be visible in sidebar
        expect(screen.getByText(createdPaper.title)).toBeInTheDocument()
      })
    })

    it('should update paper status and reflect in sidebar immediately', async () => {
      const existingPaper = { ...mockPaper }

      // Mock existing papers
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'papers') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: [existingPaper], error: null }),
            update: vi.fn().mockReturnThis(),
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      })

      render(<App />)

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
      })

      // Navigate to Papers
      const papersTab = screen.getByText('Papers')
      await userEvent.click(papersTab)

      // Find paper in sidebar
      await waitFor(() => {
        expect(screen.getByText(existingPaper.title)).toBeInTheDocument()
      })

      // Find status dropdown
      const statusDropdown = screen.getByDisplayValue('To Read')
      
      // Change status
      await userEvent.selectOptions(statusDropdown, 'Read')

      // Verify status updated immediately (optimistic update)
      await waitFor(() => {
        expect(statusDropdown).toHaveValue('Read')
      })
    })
  })

  describe('Search and Filter in Sidebar', () => {
    it('should filter papers in sidebar based on search query', async () => {
      const paper1 = { ...mockPaper, id: '1', title: 'Quantum Computing Paper' }
      const paper2 = { ...mockPaper, id: '2', title: 'Machine Learning Study' }

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'papers') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: [paper1, paper2], error: null }),
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      })

      render(<App />)

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
      })

      // Navigate to Papers
      const papersTab = screen.getByText('Papers')
      await userEvent.click(papersTab)

      // Wait for papers to load
      await waitFor(() => {
        expect(screen.getByText(paper1.title)).toBeInTheDocument()
        expect(screen.getByText(paper2.title)).toBeInTheDocument()
      })

      // Search for "Quantum"
      const searchInput = screen.getByPlaceholderText(/search papers/i)
      await userEvent.type(searchInput, 'Quantum')

      // Should filter results
      await waitFor(() => {
        expect(screen.getByText(paper1.title)).toBeInTheDocument()
        expect(screen.queryByText(paper2.title)).not.toBeInTheDocument()
      })
    })
  })

  describe('Navigation Between Papers', () => {
    it('should navigate to paper detail view when clicking paper in sidebar', async () => {
      const paper = { ...mockPaper }

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'papers') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: [paper], error: null }),
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      })

      render(<App />)

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
      })

      // Navigate to Papers
      const papersTab = screen.getByText('Papers')
      await userEvent.click(papersTab)

      // Wait for paper in sidebar
      await waitFor(() => {
        expect(screen.getByText(paper.title)).toBeInTheDocument()
      })

      // Click paper in sidebar
      const paperCard = screen.getByText(paper.title).closest('div')
      await userEvent.click(paperCard!)

      // Should navigate to detail view
      await waitFor(() => {
        // URL should update
        expect(window.location.pathname).toBe(`/papers/${paper.id}`)
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle paper creation errors gracefully', async () => {
      const mockCrossrefPaper: CrossrefPaper = {
        title: 'Error Test Paper',
        authors: ['Test Author'],
        doi: '10.1234/error.test',
        sourceUrl: 'https://example.com',
      }

      mockSupabaseClient.functions.invoke.mockResolvedValue({
        data: { data: mockCrossrefPaper },
        error: null,
      })

      // Mock paper creation failure
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'papers') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ 
              data: null, 
              error: { message: 'Database error' } 
            }),
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      })

      render(<App />)

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
      })

      // Navigate to Papers
      const papersTab = screen.getByText('Papers')
      await userEvent.click(papersTab)

      // Enter DOI and search
      const doiInput = screen.getByPlaceholderText(/e.g., 10.1038/i)
      await userEvent.type(doiInput, '10.1234/error.test')

      const searchButton = screen.getAllByRole('button', { name: /search/i })[0]
      await userEvent.click(searchButton)

      await waitFor(() => {
        expect(screen.getByText(mockCrossrefPaper.title)).toBeInTheDocument()
      })

      // Try to add (should fail)
      const addButton = screen.getByRole('button', { name: /add paper to library/i })
      await userEvent.click(addButton)

      // Should show error message (via toast)
      // Paper should NOT appear in sidebar
      await waitFor(() => {
        const sidebar = screen.queryByText(mockCrossrefPaper.title)
        // Should only appear in main content, not sidebar
        expect(screen.getAllByText(mockCrossrefPaper.title).length).toBe(1)
      })
    })
  })
})

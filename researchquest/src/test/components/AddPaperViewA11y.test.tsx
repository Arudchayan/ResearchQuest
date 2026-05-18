import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddPaperView } from '../../components/entities/AddPaperView'
import type { CrossrefPaper } from '../../types/database'
import { useAppStore } from '../../store/appStore'
import { TooltipProvider } from '../../components/ui/tooltip'

describe('AddPaperView Accessibility', () => {
  const mockOnAdd = vi.fn()
  const mockSearchByDOI = vi.fn()
  const mockSearchByQuery = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    useAppStore.setState({ selectedPaper: null })
  })

  it('should have role="alert" for DOI search errors', async () => {
    mockSearchByDOI.mockResolvedValue(null)
    render(
      <TooltipProvider delayDuration={0}>
        <AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        />
      </TooltipProvider>
    )

    const doiInput = screen.getByPlaceholderText(/e.g., 10.1038/i)
    await userEvent.type(doiInput, '10.1234/notfound')

    const searchButton = screen.getByRole('button', { name: /^search$/i })
    await userEvent.click(searchButton)

    // Expect an alert role to contain the error message
    await waitFor(() => {
      const alert = screen.getByRole('alert')
      expect(alert).toHaveTextContent(/paper not found/i)
    })
  })

  it('should have role="status" for success messages', async () => {
    mockSearchByDOI.mockResolvedValue({
      title: 'Success Paper',
      authors: ['Author'],
      doi: '10.1234/success',
      sourceUrl: 'http://example.com',
      abstract: 'Abstract',
      publicationDate: '2023'
    })

    mockOnAdd.mockResolvedValue({ id: 'new-id', title: 'Success Paper' })

    render(
      <TooltipProvider delayDuration={0}>
        <AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        />
      </TooltipProvider>
    )

    const doiInput = screen.getByPlaceholderText(/e.g., 10.1038/i)
    await userEvent.type(doiInput, '10.1234/success')

    const searchButton = screen.getByRole('button', { name: /^search$/i })
    await userEvent.click(searchButton)

    await waitFor(() => {
      expect(screen.getByText('Success Paper')).toBeInTheDocument()
    })

    const addButton = screen.getByRole('button', { name: /add paper/i })
    await userEvent.click(addButton)

    // Expect a status role to contain the success message
    await waitFor(() => {
      const status = screen.getByRole('status')
      expect(status).toHaveTextContent(/paper added successfully/i)
    })
  })

  it('should use aria-hidden asterisk for required manual entry title', async () => {
    render(
      <TooltipProvider delayDuration={0}>
        <AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        />
      </TooltipProvider>
    )

    const manualTab = screen.getByText('Manual Entry')
    await userEvent.click(manualTab)

    // Check that the asterisk is hidden from screen readers
    const asterisk = screen.getByText('*')
    expect(asterisk).toHaveAttribute('aria-hidden', 'true')

    // Check that the input is marked as required
    const titleInput = screen.getByLabelText(/title/i)
    expect(titleInput).toBeRequired()
  })
})

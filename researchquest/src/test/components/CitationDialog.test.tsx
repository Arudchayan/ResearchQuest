import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect } from 'vitest'
import { CitationDialog } from '../../components/papers/CitationDialog'
import type { Paper } from '../../types/database'

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  }
}))

// Mock navigator.clipboard
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn(),
  },
  writable: true,
  configurable: true,
})

const mockPaper: Paper = {
  id: '1',
  user_id: 'user1',
  title: 'Test Paper',
  authors: ['Author One', 'Author Two'],
  publication_date: '2023',
  doi: '10.1000/xyz',
  status: 'To Read',
  created_at: '2023-01-01',
  updated_at: '2023-01-01'
}

describe('CitationDialog', () => {
  it('renders correctly and defaults to BibTeX', () => {
    render(<CitationDialog paper={mockPaper} isOpen={true} onOpenChange={() => {}} />)

    expect(screen.getByText('Cite Paper')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'BibTeX' })).toHaveAttribute('data-state', 'active')
    expect(screen.getByText(/@article{One2023Test/)).toBeInTheDocument()
  })

  it('switches tabs and updates citation format', async () => {
    const user = userEvent.setup()
    render(<CitationDialog paper={mockPaper} isOpen={true} onOpenChange={() => {}} />)

    // Switch to APA
    const apaTab = screen.getByRole('tab', { name: 'APA' })
    await user.click(apaTab)

    expect(apaTab).toHaveAttribute('data-state', 'active')
    expect(screen.getByText(/One, A. & Two, A. \(2023\). Test Paper./)).toBeInTheDocument()

    // Switch to MLA
    const mlaTab = screen.getByRole('tab', { name: 'MLA' })
    await user.click(mlaTab)

    expect(mlaTab).toHaveAttribute('data-state', 'active')
    expect(screen.getByText(/One, Author, and Author Two "Test Paper." 2023./)).toBeInTheDocument()
  })

  it('copies to clipboard', async () => {
    const user = userEvent.setup()

    // Re-mock clipboard to ensure it's a spy, as userEvent.setup might have overwritten it
    const writeTextMock = vi.fn()
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: writeTextMock,
      },
      writable: true,
      configurable: true,
    })

    render(<CitationDialog paper={mockPaper} isOpen={true} onOpenChange={() => {}} />)

    const copyBtn = screen.getByRole('button', { name: /Copy BibTeX/i })
    await user.click(copyBtn)

    expect(writeTextMock).toHaveBeenCalled()
  })
})

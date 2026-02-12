import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { DataManagementDialog } from '../../components/settings/DataManagementDialog'
import { useAppStore } from '../../store/appStore'

// Mock dependencies
const mockExportData = vi.fn()
vi.mock('../../utils/export', () => ({
  exportData: (data: any) => mockExportData(data)
}))

// Mock Supabase
const mockUpsert = vi.fn().mockResolvedValue({ error: null })
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      upsert: mockUpsert
    })
  }
}))

// Mock Sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn()
  }
}))

describe('DataManagementDialog', () => {
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    useAppStore.setState({
      user: { id: 'test-user' } as any,
      notes: [{ id: 'n1' }],
      papers: [],
      ideas: [],
      topics: []
    })
  })

  it('renders correctly when open', () => {
    render(<DataManagementDialog open={true} onClose={onClose} />)
    expect(screen.getByText('Data Management')).toBeInTheDocument()
    expect(screen.getByText('Export Data')).toBeInTheDocument()
    expect(screen.getByText('Import Data')).toBeInTheDocument()
  })

  it('calls exportData when Download is clicked', async () => {
    const user = userEvent.setup()
    render(<DataManagementDialog open={true} onClose={onClose} />)

    // Checkboxes are checked by default
    const downloadBtn = screen.getByText('Download Backup')
    await user.click(downloadBtn)

    expect(mockExportData).toHaveBeenCalled()
    expect(mockExportData.mock.calls[0][0].notes).toHaveLength(1)
    expect(onClose).toHaveBeenCalled()
  })

  it('switches to Import tab', async () => {
    const user = userEvent.setup()
    render(<DataManagementDialog open={true} onClose={onClose} />)

    const importTab = screen.getByText('Import Data')
    await user.click(importTab)

    await waitFor(() => {
      expect(screen.getByText('Upload Backup File')).toBeInTheDocument()
    })
  })
})

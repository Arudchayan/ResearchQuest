import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { describe, it, expect, vi } from 'vitest'

describe('ConfirmDialog Accessibility', () => {
  it('should focus cancel button by default for danger variant', async () => {
    const handleClose = vi.fn()
    const handleConfirm = vi.fn()

    render(
      <ConfirmDialog
        isOpen={true}
        onClose={handleClose}
        onConfirm={handleConfirm}
        title="Delete Item"
        message="Are you sure?"
        variant="danger"
        cancelText="Cancel"
        confirmText="Delete"
      />
    )

    // Wait for the dialog to be visible and focus to settle
    await waitFor(() => {
      expect(screen.getByText('Cancel')).toHaveFocus()
    })
  })

  it('should focus cancel button by default for warning variant', async () => {
    const handleClose = vi.fn()
    const handleConfirm = vi.fn()

    render(
      <ConfirmDialog
        isOpen={true}
        onClose={handleClose}
        onConfirm={handleConfirm}
        title="Warning"
        message="Be careful!"
        variant="warning"
        cancelText="Cancel"
        confirmText="Proceed"
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toHaveFocus()
    })
  })

  it('should focus confirm button by default for info variant', async () => {
    const handleClose = vi.fn()
    const handleConfirm = vi.fn()

    render(
      <ConfirmDialog
        isOpen={true}
        onClose={handleClose}
        onConfirm={handleConfirm}
        title="Info"
        message="Just so you know."
        variant="info"
        cancelText="Close"
        confirmText="OK"
      />
    )

    await waitFor(() => {
      expect(screen.getByText('OK')).toHaveFocus()
    })
  })

  it('should have correct ARIA roles', () => {
    const handleClose = vi.fn()
    const handleConfirm = vi.fn()

    render(
      <ConfirmDialog
        isOpen={true}
        onClose={handleClose}
        onConfirm={handleConfirm}
        title="Accessible Dialog"
        message="Description text"
        variant="info"
      />
    )

    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAttribute('aria-labelledby', 'dialog-title')
    expect(dialog).toHaveAttribute('aria-describedby', 'dialog-description')
  })
})

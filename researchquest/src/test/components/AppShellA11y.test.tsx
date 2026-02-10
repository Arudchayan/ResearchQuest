import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppShell } from '../../components/layout/v2/AppShell'
import { useAppStore } from '../../store/appStore'

// Mock dependencies
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: vi.fn(),
    },
  },
}))

vi.mock('../../utils/export', () => ({
  exportData: vi.fn(),
}))

vi.mock('../../utils/import', () => ({
  importData: vi.fn(),
}))

// Mock XPExplainer to avoid complex rendering and store dependencies
vi.mock('../../components/layout/XPExplainer', () => ({
  XPExplainer: () => <div data-testid="xp-explainer">XP Explainer Mock</div>,
}))

// Mock RightSidebar to avoid complexity
vi.mock('../../components/layout/RightSidebar', () => ({
  RightSidebar: () => <div data-testid="right-sidebar">Right Sidebar Mock</div>,
}))

describe('AppShell Accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAppStore.setState({
      currentView: 'notes',
      user: {
        id: 'test-user',
        email: 'test@example.com',
        total_xp: 100,
        current_level: 1,
        theme: 'light',
      } as any,
      isMobileSidebarOpen: false,
      isRightSidebarOpen: false,
    })
  })

  it('should render a skip to content link', () => {
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    )

    const skipLink = screen.getByRole('link', { name: /skip to content/i })
    expect(skipLink).toBeInTheDocument()
    expect(skipLink).toHaveAttribute('href', '#main-content')

    // Should be visually hidden initially (sr-only class)
    expect(skipLink).toHaveClass('sr-only')

    // Should become visible on focus (focus:not-sr-only)
    // We can't easily test pseudo-classes with simple jsdom matchers,
    // but we can check if the class is present in the class list string
    expect(skipLink.className).toContain('focus:not-sr-only')
  })

  it('should have a main content area with correct ID', () => {
    render(
      <AppShell>
        <div>Test Content</div>
      </AppShell>
    )

    const main = screen.getByRole('main')
    expect(main).toHaveAttribute('id', 'main-content')
    expect(main).toHaveAttribute('tabIndex', '-1')
  })

  it('should mark the current navigation item with aria-current="page"', () => {
    // Set current view to 'papers'
    useAppStore.setState({ currentView: 'papers' })

    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    )

    // AppShell renders two sidebars (mobile/desktop), so we get multiple buttons
    const papersButtons = screen.getAllByRole('button', { name: /papers/i })
    expect(papersButtons.length).toBeGreaterThan(0)
    papersButtons.forEach(button => {
      expect(button).toHaveAttribute('aria-current', 'page')
    })

    // Other buttons should not have aria-current="page"
    const notesButtons = screen.getAllByRole('button', { name: /notes/i })
    notesButtons.forEach(button => {
      expect(button).not.toHaveAttribute('aria-current', 'page')
    })
  })
})

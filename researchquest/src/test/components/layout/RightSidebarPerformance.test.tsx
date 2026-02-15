import { render } from '@testing-library/react'
import { RightSidebar } from '../../../components/layout/RightSidebar'
import { useAppStore } from '../../../store/appStore'
import { mockSupabaseClient } from '../../mocks/supabase'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock hooks
vi.mock('../../../hooks/useBacklinks', () => ({
  useBacklinks: () => ({ backlinks: [], loading: false })
}))
vi.mock('../../../hooks/useRelatedItems', () => ({
  useRelatedItems: () => ({ relatedItems: [], loading: false })
}))

describe('RightSidebar Performance', () => {
  beforeEach(() => {
    useAppStore.setState({
      user: { id: 'user-1' } as any,
      isRightSidebarOpen: false
    })
    vi.clearAllMocks()
  })

  it('does not fetch data when sidebar is closed', () => {
    useAppStore.setState({ isRightSidebarOpen: false })
    render(<RightSidebar />)

    // With current implementation (unoptimized), this will FAIL as it fetches
    // After optimization, this should PASS
    expect(mockSupabaseClient.from).not.toHaveBeenCalled()
    expect(mockSupabaseClient.channel).not.toHaveBeenCalled()
  })

  it('fetches data when sidebar is open', () => {
    useAppStore.setState({ isRightSidebarOpen: true })
    render(<RightSidebar />)

    expect(mockSupabaseClient.from).toHaveBeenCalled()
    expect(mockSupabaseClient.channel).toHaveBeenCalled()
  })
})

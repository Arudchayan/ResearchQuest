import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { IdeasBoard } from '../../components/ideas/IdeasBoard'

// Define mock state with loading true
const { mockState } = vi.hoisted(() => {
    return {
        mockState: {
            ideas: [],
            selectedIdea: null,
            setSelectedIdea: vi.fn(),
            user: { id: 'user1' },
            ideasLoading: true, // Simulate loading state
        }
    }
})

vi.mock('../../store/appStore', () => {
    const useAppStore = (selector: any) => selector ? selector(mockState) : mockState
    useAppStore.getState = () => mockState
    return { useAppStore }
})

vi.mock('../../hooks/useIdeas', () => ({
  useIdeas: () => ({
    createIdea: vi.fn(),
    updateIdea: vi.fn(),
    deleteIdea: vi.fn(),
    restoreIdea: vi.fn(),
  })
}))

// Mock other components used in IdeasBoard to avoid rendering them fully
vi.mock('../entities/IdeaDetailView', () => ({ IdeaDetailView: () => <div>IdeaDetailView</div> }))
vi.mock('../layout/OnboardingGuide', () => ({ OnboardingGuide: () => <div>OnboardingGuide</div> }))
vi.mock('../ui/ConfirmDialog', () => ({ ConfirmDialog: () => <div>ConfirmDialog</div> }))

// Mock dialog
vi.mock('@radix-ui/react-dialog', () => ({
    Root: ({ children }: any) => <div>{children}</div>,
    Portal: ({ children }: any) => <div>{children}</div>,
    Overlay: ({ children }: any) => <div>{children}</div>,
    Content: ({ children }: any) => <div>{children}</div>,
    Title: ({ children }: any) => <div>{children}</div>,
}))

describe('IdeasBoard Loading State', () => {
  it('renders loading skeletons when ideasLoading is true', () => {
    render(<IdeasBoard />)
    // Expect to find elements with role="status" (from Skeleton component)
    const skeletons = screen.getAllByRole('status')
    expect(skeletons.length).toBeGreaterThan(0)
  })
})

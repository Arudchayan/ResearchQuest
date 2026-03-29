import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaskManager } from '../../components/tasks/TaskManager'

// Mock Supabase client
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } } }),
    },
  },
}))

// Mock useTasks hook
vi.mock('../../hooks/useTasks', () => ({
  useTasks: () => ({
    tasks: [
        {
            id: '1',
            title: 'Test Task',
            completed: false,
            created_at: new Date().toISOString(),
            priority: 'medium',
            user_id: 'test-user',
        }
    ],
    loading: false,
    createTask: vi.fn(),
    updateTask: vi.fn(),
    completeTask: vi.fn(),
    deleteTask: vi.fn(),
  }),
}))

describe('TaskManager Search Clear Button', () => {
  it('shows clear button when typing and clears input on click', async () => {
    const user = userEvent.setup()
    render(<TaskManager />)

    const searchInput = screen.getByLabelText('Search tasks')

    // Type something
    await user.type(searchInput, 'Task')
    expect(searchInput).toHaveValue('Task')

    // Expect clear button to appear
    const clearButton = screen.getByLabelText('Clear search')
    expect(clearButton).toBeInTheDocument()

    // Click clear button
    await user.click(clearButton)

    // Expect input to be empty
    expect(searchInput).toHaveValue('')

    // Expect input to be focused
    expect(searchInput).toHaveFocus()

    // Expect clear button to be gone
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument()
  })
})

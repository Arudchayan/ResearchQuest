import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TaskManager } from '../../components/tasks/TaskManager'
import userEvent from '@testing-library/user-event'
import type { Task } from '../../types/database'

const { mockTask } = vi.hoisted(() => {
  return {
    mockTask: {
      id: 'test-task-1',
      user_id: 'test-user-id',
      title: 'Test Task',
      priority: 'high',
      completed: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Task,
  }
})

vi.mock('../../hooks/useTasks', () => ({
  useTasks: () => ({
    tasks: [mockTask],
    loading: false,
    createTask: vi.fn(),
    updateTask: vi.fn(),
    completeTask: vi.fn(),
    deleteTask: vi.fn(),
  }),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } } }),
    },
  },
}))

describe('TaskManager Search', () => {
  it('shows clear button when typing and clears input on click', async () => {
    const user = userEvent.setup()
    render(<TaskManager />)

    const searchInput = screen.getByPlaceholderText('Search tasks...')

    // Type something
    await user.type(searchInput, 'Test')
    expect(searchInput).toHaveValue('Test')

    // Expect clear button to appear
    // This is expected to fail until implemented
    const clearButton = await screen.findByLabelText('Clear search')
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

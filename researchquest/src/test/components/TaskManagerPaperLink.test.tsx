import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TaskManager } from '../../components/tasks/TaskManager'
import { useAppStore } from '../../store/appStore'

const { createTask, updateTask } = vi.hoisted(() => ({
  createTask: vi.fn().mockResolvedValue(undefined),
  updateTask: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../hooks/useTasks', () => ({
  useTasks: () => ({
    tasks: [
      {
        id: 'task-1',
        title: 'Linked Task',
        completed: false,
        created_at: new Date().toISOString(),
        priority: 'medium',
        user_id: 'test-user',
        paper_id: 'paper-1',
      },
    ],
    loading: false,
    createTask,
    updateTask,
    completeTask: vi.fn(),
    deleteTask: vi.fn(),
    restoreTask: vi.fn(),
  }),
}))

vi.mock('../../store/appStore', () => ({
  useAppStore: vi.fn(),
}))

const fakeState = {
  user: { id: 'test-user' },
  papers: [{ id: 'paper-1', title: 'Deep Learning Survey' }],
  dataSyncErrors: null,
  selectedTask: null,
}

describe('TaskManager paper link (PR19 item 79)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(useAppStore as any).mockImplementation((selector: any) =>
      selector(fakeState),
    )
  })

  it('surfaces the linked paper title on the task card', () => {
    render(<TaskManager />)
    expect(screen.getByText('Deep Learning Survey')).toBeInTheDocument()
  })

  it('passes paper_id through when creating a task with a linked paper', () => {
    render(<TaskManager />)

    fireEvent.click(screen.getAllByText('New Task')[0])
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Follow-up experiment' },
    })
    fireEvent.change(screen.getByLabelText('Linked paper (Optional)'), {
      target: { value: 'paper-1' },
    })
    fireEvent.click(screen.getByText('Create', { selector: 'button' }))

    expect(createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Follow-up experiment',
        paper_id: 'paper-1',
      }),
    )
  })

  it('omits paper_id when no paper is linked', () => {
    render(<TaskManager />)

    fireEvent.click(screen.getAllByText('New Task')[0])
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Unlinked chore' },
    })
    fireEvent.click(screen.getByText('Create', { selector: 'button' }))

    expect(createTask).toHaveBeenCalledWith(
      expect.not.objectContaining({ paper_id: expect.anything() }),
    )
  })
})

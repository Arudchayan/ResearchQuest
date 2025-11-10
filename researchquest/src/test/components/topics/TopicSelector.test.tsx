import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '../../mocks/supabase'

const useTopicsMock = vi.fn()

vi.mock('../../../hooks/useTopics', () => ({
  useTopics: useTopicsMock,
}))

const { TopicSelector } = await import('../../../components/topics/TopicSelector')
const { mockSupabaseClient } = await import('../../mocks/supabase')

describe('TopicSelector', () => {
  beforeEach(() => {
    useTopicsMock.mockReset()
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    })
  })

  it('loads existing topic links and displays them as chips', async () => {
    const attachMock = vi.fn().mockResolvedValue(true)
    const detachMock = vi.fn().mockResolvedValue(true)
    const getIdsMock = vi.fn().mockResolvedValue(['topic-1'])

    useTopicsMock.mockReturnValue({
      topics: [
        {
          id: 'topic-1',
          user_id: 'user-1',
          name: 'Data Cleaning',
          description: '',
          note_count: 0,
          paper_count: 0,
          idea_count: 0,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'topic-2',
          user_id: 'user-1',
          name: 'Modeling',
          description: '',
          note_count: 0,
          paper_count: 0,
          idea_count: 0,
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
      ],
      loading: false,
      attachTopicToEntity: attachMock,
      detachTopicFromEntity: detachMock,
      getTopicIdsForEntity: getIdsMock,
      createTopic: vi.fn(),
    })

    render(<TopicSelector entityId="note-1" entityType="note" />)

    await waitFor(() => {
      expect(getIdsMock).toHaveBeenCalledWith('note-1', 'note')
      expect(screen.getByText('Data Cleaning')).toBeInTheDocument()
    })

    const removeButton = screen.getByRole('button', { name: /remove data cleaning/i })
    await userEvent.click(removeButton)

    expect(detachMock).toHaveBeenCalledWith('topic-1', 'note-1', 'note')
  })

  it('allows selecting an available topic and creating a new one', async () => {
    const attachMock = vi.fn().mockResolvedValue(true)
    const createTopicMock = vi.fn().mockResolvedValue({
      id: 'topic-3',
      user_id: 'user-1',
      name: 'Visualization',
      description: null,
      note_count: 0,
      paper_count: 0,
      idea_count: 0,
      created_at: '2024-01-03T00:00:00Z',
      updated_at: '2024-01-03T00:00:00Z',
    })

    useTopicsMock.mockReturnValue({
      topics: [
        {
          id: 'topic-1',
          user_id: 'user-1',
          name: 'Data Cleaning',
          description: '',
          note_count: 0,
          paper_count: 0,
          idea_count: 0,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'topic-2',
          user_id: 'user-1',
          name: 'Modeling',
          description: '',
          note_count: 0,
          paper_count: 0,
          idea_count: 0,
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
      ],
      loading: false,
      attachTopicToEntity: attachMock,
      detachTopicFromEntity: vi.fn(),
      getTopicIdsForEntity: vi.fn().mockResolvedValue([]),
      createTopic: createTopicMock,
    })

    render(<TopicSelector entityId="note-1" entityType="note" />)

    const select = await screen.findByRole('combobox')
    await userEvent.selectOptions(select, 'topic-2')
    expect(attachMock).toHaveBeenCalledWith('topic-2', 'note-1', 'note')

    const input = screen.getByPlaceholderText('e.g. Literature Review')
    await userEvent.type(input, 'Visualization')
    const addButton = screen.getByRole('button', { name: /add/i })
    await userEvent.click(addButton)

    await waitFor(() => {
      expect(createTopicMock).toHaveBeenCalledWith({ name: 'Visualization' })
      expect(attachMock).toHaveBeenCalledWith('topic-3', 'note-1', 'note')
    })
  })
})

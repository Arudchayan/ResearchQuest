import { vi } from 'vitest'

export const mockSupabaseClient = {
  auth: {
    getSession: vi.fn().mockResolvedValue({
      data: { session: null },
      error: null,
    }),
    getUser: vi.fn().mockResolvedValue({
      data: { user: null },
      error: null,
    }),
    onAuthStateChange: vi.fn((callback) => {
      return {
        data: { subscription: { unsubscribe: vi.fn() } },
      }
    }),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  },
  from: vi.fn((table) => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
  channel: vi.fn((channelName) => ({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn((callback) => {
      if (typeof callback === 'function') {
        callback('SUBSCRIBED')
      }
      return {
        unsubscribe: vi.fn(),
      }
    }),
    unsubscribe: vi.fn(),
  })),
  functions: {
    invoke: vi.fn(),
  },
}

vi.mock('../../lib/supabase', () => ({
  supabase: mockSupabaseClient,
}))

export const mockPaper = {
  id: 'test-paper-id',
  user_id: 'test-user-id',
  title: 'Test Paper Title',
  authors: ['Author One', 'Author Two'],
  doi: '10.1234/test.doi',
  source_url: 'https://example.com/paper',
  abstract: 'This is a test abstract',
  status: 'To Read' as const,
  publication_date: '2024-01-01',
  notes: 'Test notes',
  tags: ['tag1', 'tag2'],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

export const mockIdea = {
  id: 'test-idea-id',
  user_id: 'test-user-id',
  title: 'Test Idea',
  description: 'Test idea description',
  stage: 'Seed' as const,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

export const mockNote = {
  id: 'test-note-id',
  user_id: 'test-user-id',
  title: 'Test Note',
  markdown_body: '# Test Note\n\nThis is a test note',
  tags: ['test'],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

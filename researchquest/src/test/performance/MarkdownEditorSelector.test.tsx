import { render } from '@testing-library/react'
import { vi, test, expect } from 'vitest'
import { MarkdownEditor } from '../../components/editor/MarkdownEditor'
import { useAppStore } from '../../store/appStore'

// Mock dependencies
vi.mock('../../store/appStore', () => ({
  useAppStore: vi.fn(),
}))

// Mock UIW CodeMirror to avoid complex rendering
vi.mock('@uiw/react-codemirror', () => ({
  default: () => <div data-testid="codemirror" />
}))

// Mock React Markdown
vi.mock('react-markdown', () => ({
  default: () => <div data-testid="markdown" />
}))

// Mock Supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } } })
    },
    from: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: {} })
    }))
  }
}))

// Mock TopicSelector - Fix path to match where it is imported from OR verify the module resolution
// Since we are in src/test/performance, the component is in src/components/topics/TopicSelector
vi.mock('../../components/topics/TopicSelector', () => ({
  TopicSelector: () => <div data-testid="topic-selector" />
}))

test('MarkdownEditor uses granular selector for store subscription', () => {
  const mockState = {
    selectedNote: { id: '1', title: 'Test', markdown_body: 'Body', tags: [] },
    setSelectedNote: vi.fn(),
    effectiveTheme: 'light'
  };

  // Mock implementation to return mockState whether selector is used or not
  (useAppStore as any).mockImplementation((selector: any) => {
    return selector ? selector(mockState) : mockState;
  });

  render(<MarkdownEditor />)

  // Assert that useAppStore was called with a function (the selector)
  // Initially this is expected to fail as useAppStore is called with 0 arguments
  expect(useAppStore).toHaveBeenCalledWith(expect.any(Function))
})

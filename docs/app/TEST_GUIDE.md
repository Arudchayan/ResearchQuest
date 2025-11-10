# Test Guide for ResearchQuest

## Overview

This project now includes comprehensive test coverage for the papers functionality and sidebar interactions. Tests are written using Vitest and React Testing Library.

## Running Tests

### Run all tests
```bash
pnpm test
```

### Run tests in watch mode (useful for development)
```bash
pnpm test
```

### Run tests once (CI mode)
```bash
pnpm test:run
```

### Run tests with UI
```bash
pnpm test:ui
```

### Run tests with coverage report
```bash
pnpm test:coverage
```

## Test Structure

```
src/test/
├── setup.ts                          # Test setup and global mocks
├── mocks/
│   └── supabase.ts                   # Supabase client mocks
├── hooks/
│   └── usePapers.test.ts            # Tests for usePapers hook
├── components/
│   ├── LeftSidebar.test.tsx         # Tests for sidebar functionality
│   └── AddPaperView.test.tsx        # Tests for paper addition UI
└── integration/
    └── paperWorkflow.test.tsx        # End-to-end workflow tests
```

## Test Coverage

### 1. Hook Tests (`usePapers.test.ts`)
Tests the core paper management logic:
- ✅ Paper loading and initialization
- ✅ Creating papers with optimistic updates
- ✅ Updating paper status
- ✅ Deleting papers with rollback on error
- ✅ Real-time subscription setup
- ✅ Avoiding duplicate papers from real-time events
- ✅ Searching papers by DOI
- ✅ Searching papers by keywords
- ✅ Error handling for all operations

### 2. Sidebar Component Tests (`LeftSidebar.test.tsx`)
Tests the sidebar UI and interactions:
- ✅ Navigation tab rendering and switching
- ✅ Search functionality and filtering
- ✅ Add button behavior for different views
- ✅ Entity list display (papers, ideas, notes)
- ✅ Loading states
- ✅ Gamification widget display
- ✅ Accessibility features
- ✅ Keyboard navigation

### 3. Add Paper View Tests (`AddPaperView.test.tsx`)
Tests the paper addition interface:
- ✅ Tab navigation (DOI, Keyword, Manual)
- ✅ DOI search functionality
- ✅ Keyword search with multiple results
- ✅ Manual entry form validation
- ✅ Success and error messages
- ✅ Loading states
- ✅ Paper metadata display
- ✅ Author formatting with "et al."

### 4. Integration Tests (`paperWorkflow.test.tsx`)
Tests complete user workflows:
- ✅ Full paper addition flow (search → add → appears in sidebar)
- ✅ Immediate UI updates without refresh
- ✅ Status updates with optimistic UI
- ✅ Search and filter in sidebar
- ✅ Navigation between papers
- ✅ Error handling and recovery

## Key Test Features

### Optimistic Updates Testing
Tests verify that UI updates immediately without waiting for server response:
```typescript
// After creating a paper, it should appear immediately
await result.current.createPaper(paperData)
await waitFor(() => {
  expect(result.current.papers).toHaveLength(1)
})
```

### Real-time Subscription Testing
Tests verify that real-time updates work correctly and avoid duplicates:
```typescript
// Should avoid duplicate papers from realtime when optimistic update exists
expect(result.current.papers.filter(p => p.id === newPaper.id)).toHaveLength(1)
```

### Error Recovery Testing
Tests verify that failed operations revert UI changes:
```typescript
// Should revert on error
const success = await result.current.deletePaper(mockPaper.id)
expect(success).toBe(false)
expect(result.current.papers).toHaveLength(1) // Still has the paper
```

## Writing New Tests

### Example: Testing a new feature
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

describe('MyFeature', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should do something', async () => {
    render(<MyComponent />)
    
    const button = screen.getByRole('button', { name: /click me/i })
    await userEvent.click(button)
    
    await waitFor(() => {
      expect(screen.getByText('Success!')).toBeInTheDocument()
    })
  })
})
```

## Best Practices

1. **Use `waitFor` for async updates**: Always use `waitFor` when testing async behavior
2. **Clear mocks between tests**: Use `beforeEach(() => vi.clearAllMocks())`
3. **Test user behavior, not implementation**: Use `userEvent` for realistic interactions
4. **Test error cases**: Always include tests for error scenarios
5. **Use descriptive test names**: Test names should describe the expected behavior

## Continuous Integration

Tests are designed to run in CI environments:
- No external dependencies required
- All Supabase calls are mocked
- Tests are isolated and don't affect each other
- Fast execution (all tests run in < 10 seconds)

## Debugging Tests

### Run specific test file
```bash
pnpm test usePapers
```

### Run specific test
```bash
pnpm test -t "should create a paper successfully"
```

### Debug with console output
```typescript
screen.debug() // Prints current DOM
console.log(result.current) // Inspect hook state
```

## Coverage Goals

Current coverage targets:
- Statements: > 80%
- Branches: > 75%
- Functions: > 80%
- Lines: > 80%

Run `pnpm test:coverage` to see detailed coverage report.

## Issues Fixed by Tests

These tests helped identify and fix:
1. ✅ Papers not appearing immediately after adding (fixed with optimistic updates)
2. ✅ Duplicate papers from real-time subscriptions (fixed with existence check)
3. ✅ Failed updates not reverting UI (fixed with proper error handling)
4. ✅ Race conditions in real-time updates (fixed with optimistic updates)

## Next Steps

To extend test coverage:
1. Add tests for Notes and Ideas functionality
2. Add tests for Task Manager
3. Add E2E tests with Playwright
4. Add visual regression tests
5. Add performance tests

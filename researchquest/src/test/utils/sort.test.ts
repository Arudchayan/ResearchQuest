import { describe, it, expect } from 'vitest'
import { sortByUpdatedAt } from '../../utils/sort'

describe('sortByUpdatedAt', () => {
  it('should sort items by updated_at descending', () => {
    const items = [
      { id: 1, updated_at: '2024-01-01T10:00:00Z' },
      { id: 2, updated_at: '2024-01-02T10:00:00Z' },
      { id: 3, updated_at: '2023-12-31T10:00:00Z' },
    ]
    const sorted = sortByUpdatedAt(items)
    expect(sorted).toEqual([
      { id: 2, updated_at: '2024-01-02T10:00:00Z' },
      { id: 1, updated_at: '2024-01-01T10:00:00Z' },
      { id: 3, updated_at: '2023-12-31T10:00:00Z' },
    ])
  })

  it('should handle null updated_at as oldest', () => {
    const items = [
      { id: 1, updated_at: null },
      { id: 2, updated_at: '2024-01-01T10:00:00Z' },
    ]
    const sorted = sortByUpdatedAt(items)
    expect(sorted).toEqual([
      { id: 2, updated_at: '2024-01-01T10:00:00Z' },
      { id: 1, updated_at: null },
    ])
  })

  it('should handle undefined updated_at as oldest', () => {
    const items = [
      { id: 1, updated_at: undefined },
      { id: 2, updated_at: '2024-01-01T10:00:00Z' },
    ]
    const sorted = sortByUpdatedAt(items)
    expect(sorted).toEqual([
      { id: 2, updated_at: '2024-01-01T10:00:00Z' },
      { id: 1, updated_at: undefined },
    ])
  })

  it('should handle mixed valid and invalid dates', () => {
    const items = [
      { id: 1, updated_at: 'invalid-date' }, // 'i' > '2', so this comes first in string sort
      { id: 2, updated_at: '2024-01-01T10:00:00Z' },
    ]
    const sorted = sortByUpdatedAt(items)
    expect(sorted).toEqual([
      { id: 1, updated_at: 'invalid-date' },
      { id: 2, updated_at: '2024-01-01T10:00:00Z' },
    ])
  })

  it('should not mutate original array', () => {
    const items = [
      { id: 1, updated_at: '2023-01-01T00:00:00Z' },
      { id: 2, updated_at: '2024-01-01T00:00:00Z' },
    ]
    const sorted = sortByUpdatedAt(items)
    expect(sorted).not.toBe(items)
    expect(items[0].id).toBe(1) // Original order preserved
  })
})

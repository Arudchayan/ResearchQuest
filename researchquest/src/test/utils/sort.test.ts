import { describe, it, expect } from 'vitest'
import { sortByUpdatedAt } from '../../utils/sort'

describe('sortByUpdatedAt', () => {
  it('sorts items by updated_at descending', () => {
    const items = [
      { id: 'a', updated_at: '2023-05-01T12:00:00Z' },
      { id: 'b', updated_at: '2024-01-10T08:30:00Z' },
      { id: 'c', updated_at: '2022-12-31T23:59:59Z' },
    ]

    const sorted = sortByUpdatedAt(items)

    expect(sorted.map(item => item.id)).toEqual(['b', 'a', 'c'])
  })

  it('treats missing or invalid dates as the oldest', () => {
    const items = [
      { id: 'valid', updated_at: '2024-06-15T10:00:00Z' },
      { id: 'missing', updated_at: null },
      { id: 'invalid', updated_at: 'not-a-date' },
      { id: 'undefined', updated_at: undefined },
    ]

    const sorted = sortByUpdatedAt(items)

    expect(sorted[0]?.id).toBe('valid')
    expect(sorted.slice(1).map(item => item.id).sort()).toEqual(['invalid', 'missing', 'undefined'])
  })

  it('does not mutate the original array', () => {
    const items = [
      { id: 'a', updated_at: '2023-05-01T12:00:00Z' },
      { id: 'b', updated_at: '2024-01-10T08:30:00Z' },
    ]

    const copy = [...items]
    sortByUpdatedAt(items)

    expect(items).toEqual(copy)
  })
})

import { describe, it, expect } from 'vitest'
import { countWords, estimateReadingTime } from '../../utils/text'

describe('text utils', () => {
  describe('countWords', () => {
    it('returns 0 for empty string', () => {
      expect(countWords('')).toBe(0)
    })

    it('returns 0 for whitespace only', () => {
      expect(countWords('   ')).toBe(0)
      expect(countWords('\n\t')).toBe(0)
    })

    it('counts single word', () => {
      expect(countWords('hello')).toBe(1)
      expect(countWords('  hello  ')).toBe(1)
    })

    it('counts multiple words', () => {
      expect(countWords('hello world')).toBe(2)
      expect(countWords('hello   world')).toBe(2)
      expect(countWords('one two three')).toBe(3)
    })

    it('handles newlines and tabs', () => {
      expect(countWords('hello\nworld')).toBe(2)
      expect(countWords('hello\tworld')).toBe(2)
      expect(countWords('one\ntwo\tthree')).toBe(3)
    })

    it('handles markdown syntax', () => {
      expect(countWords('# Heading')).toBe(2)
      expect(countWords('**bold** text')).toBe(2)
      expect(countWords('- list item')).toBe(3)
    })
  })

  describe('estimateReadingTime', () => {
    it('returns 0 min read for empty content', () => {
      expect(estimateReadingTime('')).toBe('0 min read')
    })

    it('returns 1 min read for small content', () => {
      expect(estimateReadingTime('word '.repeat(100))).toBe('1 min read') // 100 words
      expect(estimateReadingTime('word '.repeat(200))).toBe('1 min read') // 200 words
    })

    it('returns > 1 min read for large content', () => {
      expect(estimateReadingTime('word '.repeat(201))).toBe('2 min read')
      expect(estimateReadingTime('word '.repeat(401))).toBe('3 min read')
    })
  })
})

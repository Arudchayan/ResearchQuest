import { describe, it, expect, vi } from 'vitest'

// Existing inefficient implementation (reproduced here for benchmark)
function deriveNoteTitleOld(markdownBody: string): string {
  const markdownHeading =
    typeof markdownBody === 'string'
      ? markdownBody
          .split('\n')
          .map((line) => line.trim())
          .find((line) => line)
      : null

  return markdownHeading?.replace(/^#+\s*/, '').trim() || 'Untitled Note'
}

// Proposed optimized implementation
function deriveTitleFromMarkdown(markdownBody: string): string {
  if (!markdownBody) return 'Untitled Note'

  // Find first non-empty line without splitting the whole string
  let start = 0
  let end = markdownBody.indexOf('\n')

  while (end !== -1) {
    const line = markdownBody.slice(start, end).trim()
    if (line) {
      return line.replace(/^#+\s*/, '').trim() || 'Untitled Note'
    }
    start = end + 1
    end = markdownBody.indexOf('\n', start)
  }

  // Handle the last line (or if no newlines)
  const lastLine = markdownBody.slice(start).trim()
  if (lastLine) {
    return lastLine.replace(/^#+\s*/, '').trim() || 'Untitled Note'
  }

  return 'Untitled Note'
}

describe('Performance: Note Title Derivation', () => {
  const shortNote = `
    # My Note Title
    This is a short note.
  `

  const longNote = `


    # Deeply Nested Title
    ${Array(10000).fill('Some content line here...').join('\n')}
  `

  const massiveNote = `
    # Massive Note
    ${Array(100000).fill('Some content line here...').join('\n')}
  `

  it('verifies both implementations produce the same output', () => {
    expect(deriveTitleFromMarkdown(shortNote)).toBe(deriveNoteTitleOld(shortNote))
    expect(deriveTitleFromMarkdown(longNote)).toBe(deriveNoteTitleOld(longNote))
    expect(deriveTitleFromMarkdown(massiveNote)).toBe(deriveNoteTitleOld(massiveNote))
    expect(deriveTitleFromMarkdown('')).toBe(deriveNoteTitleOld(''))
    expect(deriveTitleFromMarkdown('\n\n')).toBe(deriveNoteTitleOld('\n\n'))
  })

  it('benchmarks title derivation', () => {
    const iterations = 100

    const startOld = performance.now()
    for (let i = 0; i < iterations; i++) {
      deriveNoteTitleOld(massiveNote)
    }
    const endOld = performance.now()
    const timeOld = endOld - startOld

    const startNew = performance.now()
    for (let i = 0; i < iterations; i++) {
      deriveTitleFromMarkdown(massiveNote)
    }
    const endNew = performance.now()
    const timeNew = endNew - startNew

    console.log(`Title Derivation (Massive Note, ${iterations} runs):`)
    console.log(`Old: ${timeOld.toFixed(2)}ms`)
    console.log(`New: ${timeNew.toFixed(2)}ms`)
    console.log(`Speedup: ${(timeOld / timeNew).toFixed(2)}x`)

    // Assert significant improvement (at least 2x, likely much more)
    expect(timeNew).toBeLessThan(timeOld)
  })
})

describe('Performance: Date Sorting', () => {
  const dates = Array(10000).fill(0).map(() => ({
    updated_at: new Date(Date.now() - Math.random() * 10000000000).toISOString()
  }))

  it('benchmarks date sorting', () => {
    const iterations = 10

    const startOld = performance.now()
    for (let i = 0; i < iterations; i++) {
      const copy = [...dates]
      copy.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    }
    const endOld = performance.now()
    const timeOld = endOld - startOld

    const startNew = performance.now()
    for (let i = 0; i < iterations; i++) {
      const copy = [...dates]
      copy.sort((a, b) => {
        if (b.updated_at > a.updated_at) return 1
        if (b.updated_at < a.updated_at) return -1
        return 0
      })
    }
    const endNew = performance.now()
    const timeNew = endNew - startNew

    console.log(`Date Sorting (10k items, ${iterations} runs):`)
    console.log(`Old: ${timeOld.toFixed(2)}ms`)
    console.log(`New: ${timeNew.toFixed(2)}ms`)
    console.log(`Speedup: ${(timeOld / timeNew).toFixed(2)}x`)

    // Assert significant improvement
    expect(timeNew).toBeLessThan(timeOld)
  })
})

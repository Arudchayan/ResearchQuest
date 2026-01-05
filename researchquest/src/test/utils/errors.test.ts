import { describe, it, expect } from 'vitest'
import { extractFunctionErrorMessage } from '../../utils/errors'

describe('extractFunctionErrorMessage', () => {
  const fallback = 'Fallback message'

  it('returns fallback when error is undefined', () => {
    expect(extractFunctionErrorMessage(undefined, fallback)).toBe(fallback)
  })

  it('prefers context body string', () => {
    const error = {
      context: {
        body: 'Body error message',
      },
    }

    expect(extractFunctionErrorMessage(error, fallback)).toBe('Body error message')
  })

  it('extracts nested response error details', () => {
    const error = {
      context: {
        response: {
          error: {
            message: 'Response error message',
          },
        },
      },
    }

    expect(extractFunctionErrorMessage(error, fallback)).toBe('Response error message')
  })

  it('extracts error details from error.error', () => {
    const error = {
      error: {
        details: 'Detail error message',
      },
    }

    expect(extractFunctionErrorMessage(error, fallback)).toBe('Detail error message')
  })

  it('falls back to error.message when candidates are empty', () => {
    const error = {
      context: {
        body: '   ',
      },
      message: 'Top-level error message',
    }

    expect(extractFunctionErrorMessage(error, fallback)).toBe('Top-level error message')
  })

  it('returns fallback when no message is available', () => {
    const error = {
      context: {
        response: {
          error: {
            message: '   ',
          },
        },
      },
      message: '   ',
    }

    expect(extractFunctionErrorMessage(error, fallback)).toBe(fallback)
  })
})

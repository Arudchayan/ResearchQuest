import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '../../store/appStore'

describe('toggleTheme (PR19 item 80)', () => {
  beforeEach(() => {
    useAppStore.setState({ theme: 'auto', effectiveTheme: 'light' })
  })

  it('flips the effective theme without leaving auto mode', () => {
    useAppStore.getState().toggleTheme()

    const state = useAppStore.getState()
    expect(state.theme).toBe('auto')
    expect(state.effectiveTheme).toBe('dark')

    state.toggleTheme()
    expect(useAppStore.getState().theme).toBe('auto')
    expect(useAppStore.getState().effectiveTheme).toBe('light')
  })

  it('flips explicit light/dark preferences as before', () => {
    useAppStore.setState({ theme: 'light', effectiveTheme: 'light' })
    useAppStore.getState().toggleTheme()
    expect(useAppStore.getState()).toMatchObject({ theme: 'dark', effectiveTheme: 'dark' })

    useAppStore.getState().toggleTheme()
    expect(useAppStore.getState()).toMatchObject({ theme: 'light', effectiveTheme: 'light' })
  })

  it('applies the flipped theme class to the document', () => {
    useAppStore.setState({ theme: 'auto', effectiveTheme: 'light' })
    useAppStore.getState().toggleTheme()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.classList.contains('light')).toBe(false)
  })
})

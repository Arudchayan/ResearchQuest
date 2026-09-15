import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '../../store/appStore'

describe('Zen Mode Store Logic', () => {
  beforeEach(() => {
    // Reset store state
    useAppStore.setState({
      isZenMode: false
    })
  })

  it('should default to false', () => {
    expect(useAppStore.getState().isZenMode).toBe(false)
  })

  it('should toggle zen mode', () => {
    const { toggleZenMode } = useAppStore.getState()

    toggleZenMode()
    expect(useAppStore.getState().isZenMode).toBe(true)

    toggleZenMode()
    expect(useAppStore.getState().isZenMode).toBe(false)
  })

  it('should persist the zen preference (partialize check)', () => {
      // PR19 item 80: the Zen preference persists across reloads alongside theme.
      // partialize: (state) => ({ theme: state.theme, isZenMode: state.isZenMode }),
      const partialize = (
        useAppStore as unknown as {
          persist: { getOptions: () => { partialize: (s: unknown) => unknown } };
        }
      ).persist.getOptions().partialize;

      expect(
        partialize({ theme: 'auto', isZenMode: true, currentView: 'tasks' }),
      ).toEqual({ theme: 'auto', isZenMode: true });
      expect(
        partialize({ theme: 'dark', isZenMode: false, currentView: 'tasks' }),
      ).toEqual({ theme: 'dark', isZenMode: false });
  })
})

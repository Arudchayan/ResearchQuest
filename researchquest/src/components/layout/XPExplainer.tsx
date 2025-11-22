import { useMemo } from 'react'
import { Sparkles, Trophy, X } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { XP_REWARDS, getXPForLevel, getLevelTitle } from '../../utils/gamification'

interface XPExplainerProps {
  open: boolean
  onClose: () => void
  currentLevel: number
  totalXP: number
}

function formatRewardLabel(key: string) {
  return key
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function XPExplainer({ open, onClose, currentLevel, totalXP }: XPExplainerProps) {
  const upcomingLevels = useMemo(() => {
    return Array.from({ length: 3 }).map((_, index) => {
      const level = currentLevel + index
      return {
        level,
        xpRequired: getXPForLevel(level),
        title: getLevelTitle(level),
      }
    })
  }, [currentLevel])

  const rewards = useMemo(() => {
    return Object.entries(XP_REWARDS)
      .map(([key, value]) => ({ key, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [])

  const xpIntoCurrentLevel = totalXP % 500
  const xpToNextLevel = getXPForLevel(currentLevel) - totalXP

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-[60] w-full max-w-3xl translate-x-[-50%] translate-y-[-50%] rounded-2xl bg-bg-surface shadow-2xl border border-border-subtle overflow-hidden outline-none animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
          <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-border-subtle bg-bg-elevated sticky top-0 z-10">
            <div className="space-y-1">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-primary-500 uppercase tracking-wide">
                <Sparkles className="w-4 h-4" aria-hidden="true" />
                Momentum guide
              </p>
              <Dialog.Title className="text-2xl font-semibold text-text-primary">
                How XP levels and rewards work
              </Dialog.Title>
              <Dialog.Description className="text-sm text-text-secondary max-w-xl">
                Track how close you are to your next level and discover the fastest ways to earn streak-protecting XP.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="p-2 rounded-full text-text-secondary hover:text-text-primary hover:bg-bg-base transition-colors"
                aria-label="Close XP explanation"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          <div className="px-6 py-6 space-y-6">
            <section className="grid gap-4 md:grid-cols-2">
              <div className="p-4 rounded-xl border border-border-subtle bg-bg-base">
                <h3 className="text-sm font-semibold text-text-primary mb-1">Current level snapshot</h3>
                <p className="text-caption text-text-secondary mb-4">
                  Level {currentLevel} · {xpIntoCurrentLevel} XP into the level · {xpToNextLevel > 0 ? `${xpToNextLevel} XP to level ${currentLevel + 1}` : 'Level up reached — enjoy your boost!'}
                </p>
                <ul className="space-y-2">
                  {upcomingLevels.map((snapshot) => (
                    <li key={snapshot.level} className="flex items-center justify-between gap-3 rounded-lg bg-bg-surface px-3 py-2 border border-border-subtle/60">
                      <div>
                        <p className="text-sm font-semibold text-text-primary">
                          Lvl {snapshot.level}: {snapshot.title}
                        </p>
                        <p className="text-caption text-text-tertiary">Total XP needed: {snapshot.xpRequired}</p>
                      </div>
                      <Trophy className="w-5 h-5 text-primary-500" aria-hidden="true" />
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 rounded-xl border border-border-subtle bg-bg-base">
                <h3 className="text-sm font-semibold text-text-primary mb-2">High-impact actions</h3>
                <p className="text-caption text-text-secondary mb-4">
                  These actions give the biggest momentum boosts. Stack them to level up faster.
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {rewards.map((reward) => (
                    <div key={reward.key} className="rounded-lg border border-border-subtle/60 bg-bg-surface px-3 py-2">
                      <p className="text-sm font-medium text-text-primary">{formatRewardLabel(reward.key)}</p>
                      <p className="text-caption text-primary-500 font-semibold">+{reward.value} XP</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="p-4 rounded-xl border border-border-subtle bg-bg-base">
              <h3 className="text-sm font-semibold text-text-primary mb-2">Tips for steady gains</h3>
              <ul className="list-disc pl-5 space-y-1 text-sm text-text-secondary">
                <li>Log a note or idea update after each focus sprint to convert insights into XP.</li>
                <li>Advance task stages before ending the day to protect streaks and unlock bonus XP.</li>
                <li>Link notes, papers, and ideas with topics to earn small bursts that add up quickly.</li>
              </ul>
            </section>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

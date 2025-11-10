import { Sun, Moon, Flame, User, Sparkles, Snowflake, Coffee } from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import { useGamificationStore } from '../../store/gamificationStore'

export function TopNav() {
  const { theme, setTheme, user, effectiveTheme } = useAppStore()
  const activeBoost = useGamificationStore((state) => state.activeBoost)
  const boostCountdown = useGamificationStore((state) => state.boostCountdown)
  const streakFreezeTokens = useGamificationStore((state) => state.streakFreezeTokens)
  const restDays = useGamificationStore((state) => state.restDays)
  
  const toggleTheme = () => {
    const newTheme = effectiveTheme === 'light' ? 'dark' : 'light'
    document.body.classList.add('theme-transitioning')
    setTheme(newTheme)
    setTimeout(() => {
      document.body.classList.remove('theme-transitioning')
    }, 300)
  }
  
  const xpProgress = user ? (user.total_xp % 500) / 500 * 100 : 0
  const currentLevel = user?.current_level || 1
  const xpInLevel = user ? user.total_xp % 500 : 0
  
  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-bg-surface/80 backdrop-blur-lg border-b border-border-subtle shadow-sm z-50">
      <div className="h-full px-4 sm:px-6 flex items-center justify-between">
        {/* Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary-500 rounded-md flex items-center justify-center text-white font-bold">
            RQ
          </div>
          <h1 className="text-lg font-semibold text-text-primary">ResearchQuest</h1>
        </div>
        
        {/* Center - XP Progress (hidden on mobile) */}
        <div className="hidden md:flex items-center gap-4">
          <div className="flex flex-col items-end gap-1">
            <span className="text-caption text-text-tertiary font-medium">
              Lvl {currentLevel} • {xpInLevel}/500 XP
            </span>
            <div className="w-48 h-2.5 bg-bg-elevated rounded-full overflow-hidden shadow-sm">
              <div 
                className="h-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all duration-600 ease-in-out"
                style={{ width: `${xpProgress}%` }}
              />
            </div>
          </div>
        </div>
        
        {/* Right - Streak & Theme Toggle */}
        <div className="flex items-center gap-3">
          {/* Streak Counter */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-success-bg border border-success rounded-full">
            <Flame className="w-4 h-4 text-success" />
            <span className="text-small font-semibold text-success">
              {user?.current_streak || 0} days
            </span>
          </div>

          {activeBoost && (
            <span className="hidden md:inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-200 text-caption font-semibold">
              <Sparkles className="w-3 h-3" />
              {activeBoost.label ?? 'Boost'}
              {boostCountdown && <span>{boostCountdown}</span>}
            </span>
          )}

          {(streakFreezeTokens > 0 || restDays > 0) && (
            <span className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-bg-elevated border border-border-subtle text-caption text-text-secondary">
              <Snowflake className="w-3 h-3 text-primary-400" />
              <span>{streakFreezeTokens} freeze</span>
              <Coffee className="w-3 h-3 text-success" />
              <span>{restDays} rest</span>
            </span>
          )}

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-bg-elevated transition-colors"
            aria-label={`Switch to ${effectiveTheme === 'light' ? 'dark' : 'light'} mode`}
          >
            {effectiveTheme === 'light' ? (
              <Moon className="w-5 h-5 text-text-secondary" />
            ) : (
              <Sun className="w-5 h-5 text-text-secondary" />
            )}
          </button>
          
          {/* User Avatar */}
          <button
            className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white hover:bg-primary-600 transition-colors"
            aria-label="User profile"
          >
            <User className="w-5 h-5" />
          </button>
        </div>
      </div>
    </nav>
  )
}

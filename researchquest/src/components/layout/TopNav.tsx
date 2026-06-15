import { useState } from "react";
import {
  Sun,
  Moon,
  Flame,
  User,
  Sparkles,
  Snowflake,
  Coffee,
  LogOut,
  HelpCircle,
} from "lucide-react";
import { useAppStore } from "../../store/appStore";
import { useShallow } from "zustand/react/shallow";
import { useGamificationStore } from "../../store/gamificationStore";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";
import { XPExplainer } from "./XPExplainer";
import { logger } from "../../utils/logger";

export function TopNav() {
  // Using useShallow to prevent TopNav from re-rendering when unrelated
  // properties (like selectedNote or papers) in the global appStore change.
  const { theme, setTheme, user, effectiveTheme } = useAppStore(
    useShallow((state) => ({
      theme: state.theme,
      setTheme: state.setTheme,
      user: state.user,
      effectiveTheme: state.effectiveTheme,
    }))
  );
  const activeBoost = useGamificationStore((state) => state.activeBoost);
  const boostCountdown = useGamificationStore((state) => state.boostCountdown);
  const streakFreezeTokens = useGamificationStore(
    (state) => state.streakFreezeTokens,
  );
  const restDays = useGamificationStore((state) => state.restDays);
  const [signingOut, setSigningOut] = useState(false);
  const [showXpGuide, setShowXpGuide] = useState(false);

  const toggleTheme = () => {
    const newTheme = effectiveTheme === "light" ? "dark" : "light";
    document.body.classList.add("theme-transitioning");
    setTheme(newTheme);
    setTimeout(() => {
      document.body.classList.remove("theme-transitioning");
    }, 300);
  };

  const handleSignOut = async () => {
    if (signingOut) return;

    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success("Signed out");
    } catch (error: any) {
      logger.error("Failed to sign out", error);
      toast.error(error?.message ?? "Could not sign out. Please try again.");
    } finally {
      setSigningOut(false);
    }
  };

  const xpProgress = user ? ((user.total_xp % 500) / 500) * 100 : 0;
  const currentLevel = user?.current_level || 1;
  const xpInLevel = user ? user.total_xp % 500 : 0;

  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-bg-surface/80 backdrop-blur-lg border-b border-border-subtle shadow-sm z-50 px-4 sm:px-6">
      <div className="h-full w-full flex items-center justify-between">
        {/* Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary-500 rounded-md flex items-center justify-center text-white font-bold">
            RQ
          </div>
          <h1 className="text-lg font-semibold text-text-primary">
            ResearchQuest
          </h1>
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
          <button
            type="button"
            onClick={() => setShowXpGuide(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-border-subtle text-caption text-text-secondary hover:text-text-primary hover:border-primary-400 transition-colors"
            aria-label="Learn how XP levels work"
          >
            <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
            XP guide
          </button>
        </div>

        {/* Mobile XP summary */}
        <div className="md:hidden flex items-center gap-2 text-caption text-text-secondary">
          <span className="font-semibold text-text-primary">
            Lvl {currentLevel}
          </span>
          <span>• {xpInLevel}/500 XP</span>
        </div>

        {/* Right - Streak & Theme Toggle */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
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
              {activeBoost.label ?? "Boost"}
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
            aria-label={`Switch to ${effectiveTheme === "light" ? "dark" : "light"} mode`}
          >
            {effectiveTheme === "light" ? (
              <Moon className="w-5 h-5 text-text-secondary" aria-hidden="true" />
            ) : (
              <Sun className="w-5 h-5 text-text-secondary" aria-hidden="true" />
            )}
          </button>

          {/* User Avatar */}
          <button
            className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white hover:bg-primary-600 transition-colors"
            aria-label="User profile"
          >
            <User className="w-5 h-5" aria-hidden="true" />
          </button>

          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="inline-flex items-center gap-2 px-2.5 sm:px-3 py-2 rounded-md border border-border-subtle text-small font-medium text-text-secondary hover:bg-bg-elevated hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 disabled:opacity-60"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">
              {signingOut ? "Signing out…" : "Sign out"}
            </span>
          </button>
        </div>
      </div>

      <XPExplainer
        open={showXpGuide}
        onClose={() => setShowXpGuide(false)}
        currentLevel={currentLevel}
        totalXP={user?.total_xp || 0}
      />
    </nav>
  );
}

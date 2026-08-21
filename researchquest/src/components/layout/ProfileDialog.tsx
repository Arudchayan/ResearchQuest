import { logger } from "../../utils/logger";
import { useEffect, useState, useMemo } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Trophy, X, Flame, Star, Medal, Award, Calendar } from "lucide-react";
import { useAppStore } from "../../store/appStore";
import { useShallow } from "zustand/react/shallow";
import { supabase } from "../../lib/supabase";
import {
  ACHIEVEMENTS,
  getLevelTitle,
  getXPForLevel,
} from "../../utils/gamification";
import type { Achievement } from "../../types/database";
import { Skeleton } from "../../components/ui/Skeleton";

interface ProfileDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ProfileDialog({ open, onClose }: ProfileDialogProps) {
  // Using a direct selector for a single property instead of subscribing to the entire store.
  // This prevents ProfileDialog from unnecessarily re-rendering on other state changes.
  const user = useAppStore((state) => state.user);

  const [earnedAchievements, setEarnedAchievements] = useState<Set<string>>(
    new Set(),
  );
  const [achievementDates, setAchievementDates] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && user) {
      fetchAchievements();
    }
  }, [open, user]);

  const fetchAchievements = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("research_achievements")
        .select("*")
        .eq("user_id", user.id);

      if (error) throw error;

      const earned = new Set<string>();
      const dates: Record<string, string> = {};

      data?.forEach((a: Achievement) => {
        earned.add(a.achievement_type);
        dates[a.achievement_type] = a.earned_at;
      });

      setEarnedAchievements(earned);
      setAchievementDates(dates);
    } catch (err) {
      logger.error("Failed to fetch achievements", err);
    } finally {
      setLoading(false);
    }
  };

  const currentLevel = user?.current_level || 1;
  const totalXP = user?.total_xp || 0;
  const xpForNextLevel = getXPForLevel(currentLevel);
  const xpInLevel = totalXP % 500; // Assuming 500 XP per level as per gamification.ts
  const progressPercent = Math.min(100, (xpInLevel / 500) * 100);

  const allAchievements = useMemo(() => {
    return Object.values(ACHIEVEMENTS);
  }, []);

  const AchievementsSkeleton = () => (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="p-4 rounded-xl border border-border-subtle bg-bg-base/50 space-y-3"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-lg flex-shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-12 w-full rounded-md" />
          <div className="flex justify-between pt-2">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </>
  );

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-[60] w-full max-w-4xl translate-x-[-50%] translate-y-[-50%] rounded-xl bg-bg-surface shadow-lg border border-border-subtle overflow-hidden outline-none animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-border-subtle bg-bg-elevated sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className="icon-tile h-10 w-10 rounded-full bg-gold-soft text-gold-strong">
                <Trophy className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <Dialog.Title className="text-xl font-bold text-text-primary">
                  Researcher Profile
                </Dialog.Title>
                <Dialog.Description className="text-sm text-text-secondary">
                  Your progress, stats, and badges
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                className="icon-btn"
                aria-label="Close profile"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          <div className="p-6 space-y-8">
            {/* Stats Section */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Level Card */}
              <div className="surface-card p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-text-secondary">
                    Current Rank
                  </span>
                  <Star className="w-4 h-4 text-gold fill-gold" aria-hidden="true" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-text-primary">
                    {getLevelTitle(currentLevel)}
                  </div>
                  <div className="text-sm text-text-tertiary">
                    Level {currentLevel}
                  </div>
                </div>
                <div className="mt-auto pt-2 space-y-1">
                  <div className="flex justify-between text-caption text-text-secondary">
                    <span>{xpInLevel} XP</span>
                    <span>500 XP</span>
                  </div>
                  <div
                    className="progress-track h-2 w-full"
                    role="progressbar"
                    aria-valuenow={xpInLevel}
                    aria-valuemin={0}
                    aria-valuemax={500}
                    aria-label="Level Progress"
                  >
                    <div
                      className="progress-fill"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Streak Card */}
              <div className="surface-card p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-text-secondary">
                    Consistency
                  </span>
                  <Flame className="w-4 h-4 text-coral fill-coral" aria-hidden="true" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-text-primary">
                    {user?.current_streak || 0} Days
                  </div>
                  <div className="text-sm text-text-tertiary">
                    Current Streak
                  </div>
                </div>
                <div className="mt-auto text-caption text-text-secondary">
                  Longest streak:{" "}
                  <span className="font-semibold">
                    {user?.longest_streak || 0}{" "}
                    {(user?.longest_streak || 0) === 1 ? "day" : "days"}
                  </span>
                </div>
              </div>

              {/* Total XP Card */}
              <div className="surface-card p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-text-secondary">
                    Lifetime Impact
                  </span>
                  <Award className="w-4 h-4 text-violet-strong" aria-hidden="true" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-text-primary">
                    {totalXP.toLocaleString()} XP
                  </div>
                  <div className="text-sm text-text-tertiary">
                    Total Experience
                  </div>
                </div>
                <div className="mt-auto text-caption text-text-secondary">
                  Keep creating to level up
                </div>
              </div>
            </section>

            {/* Achievements Section */}
            <section>
              <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                <Medal className="w-5 h-5 text-gold-strong" aria-hidden="true" />
                Achievements
                <span className="text-sm font-normal text-text-tertiary ml-2">
                  ({earnedAchievements.size} / {allAchievements.length}{" "}
                  unlocked)
                </span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                  <AchievementsSkeleton />
                ) : (
                  allAchievements.map((achievement) => {
                    const isUnlocked = earnedAchievements.has(achievement.type);
                    const earnedDate = achievementDates[achievement.type];

                    return (
                      <article
                        key={achievement.type}
                        aria-label={`${achievement.title} - ${isUnlocked ? "Unlocked" : "Locked"}`}
                        className={`surface-card relative p-4 transition-all duration-200 ${
                          isUnlocked
                            ? "bg-accent-soft border-border-moderate"
                            : "bg-bg-elevated border-border-subtle opacity-70 grayscale-[0.5]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div
                            className={`p-2 rounded-lg ${
                              isUnlocked
                                ? "bg-accent-soft text-accent-strong"
                                : "bg-bg-elevated text-text-tertiary"
                            }`}
                          >
                            <Medal className="w-5 h-5" aria-hidden="true" />
                          </div>
                          {isUnlocked && (
                            <span className="status-chip bg-success-bg text-success">
                              Unlocked
                            </span>
                          )}
                        </div>

                        <h4
                          className={`font-bold mb-1 ${isUnlocked ? "text-text-primary" : "text-text-secondary"}`}
                        >
                          {achievement.title}
                        </h4>
                        <p className="text-sm text-text-secondary mb-3 line-clamp-2">
                          {achievement.description}
                        </p>

                        <div className="flex items-center justify-between text-caption pt-3 border-t border-border-subtle/50">
                          <span
                            className={`font-semibold ${isUnlocked ? "text-accent-strong" : "text-text-tertiary"}`}
                          >
                            +{achievement.xp} XP
                          </span>
                          {isUnlocked && earnedDate && (
                            <span className="text-text-tertiary flex items-center gap-1">
                              <Calendar className="w-3 h-3" aria-hidden="true" />
                              {new Date(earnedDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

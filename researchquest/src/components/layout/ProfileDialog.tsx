import { logger } from "../../utils/logger";
import { useEffect, useState, useMemo } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Trophy, X, Medal, Calendar } from "lucide-react";
import { useAppStore } from "../../store/appStore";
import { supabase } from "../../lib/supabase";
import { ACHIEVEMENTS } from "../../utils/gamification";
import type { Achievement } from "../../types/database";
import { Skeleton } from "../../components/ui/Skeleton";

interface ProfileDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ProfileDialog({ open, onClose }: ProfileDialogProps) {
  // ⚡ PERFORMANCE OPTIMIZATION:
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

  // (XP/level/streak summaries live in the Sidebar and Dashboard only.)

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
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-overlay backdrop-blur-sm animate-in fade-in duration-fast" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[60] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-surface border border-border-subtle bg-bg-surface shadow-lg outline-none animate-in zoom-in-95 duration-fast">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border-subtle bg-bg-elevated px-4 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-primary-500 text-bg-surface shadow-sm">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <Dialog.Title className="text-xl font-bold text-text-primary">
                  Researcher profile
                </Dialog.Title>
                <Dialog.Description className="text-sm text-text-secondary">
                  Your badges and achievements
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                className="p-2 rounded-full text-text-secondary hover:text-text-primary hover:bg-bg-base transition-colors"
                aria-label="Close profile"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-6 p-4 sm:space-y-8 sm:p-6">
            {/* XP and streak live in the Sidebar and Dashboard only
                (PR17 dedupe); this dialog covers badges. */}

            {/* Achievements Section */}
            <section>
              <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                <Medal className="w-5 h-5 text-primary-500" />
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
                        className={`relative p-4 rounded-xl border transition-all duration-200 ${
                          isUnlocked
                        ? "bg-bg-surface border-border-moderate shadow-sm"
                            : "bg-bg-base/50 border-border-subtle opacity-70 grayscale-[0.5]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div
                            className={`p-2 rounded-lg ${
                              isUnlocked
                                ? "bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400"
                                : "bg-bg-elevated text-text-tertiary"
                            }`}
                          >
                            <Medal className="w-5 h-5" />
                          </div>
                          {isUnlocked && (
                            <span className="text-xs font-bold px-2 py-1 rounded-full bg-success-bg text-success border border-success/20">
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
                            className={`font-semibold ${isUnlocked ? "text-primary-500" : "text-text-tertiary"}`}
                          >
                            +{achievement.xp} XP
                          </span>
                          {isUnlocked && earnedDate && (
                            <span className="text-text-tertiary flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
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

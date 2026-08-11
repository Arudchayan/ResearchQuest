import {
  Sparkles,
  Snowflake,
  Coffee,
  Flame,
  Heart,
  FileText,
  Lightbulb,
  Link2,
  Hash,
  CalendarCheck,
  BookOpen,
} from "lucide-react";
import { useAppStore } from "../../store/appStore";
import { useState, useEffect, useMemo, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import { useGamificationStore } from "../../store/gamificationStore";
import { logger } from "../../utils/logger";
import { formatTimeUntil, formatDateLabel } from "../../utils/time";
import { useBacklinks } from "../../hooks/useBacklinks";
import { useRelatedItems } from "../../hooks/useRelatedItems";
import { useShallow } from "zustand/react/shallow";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { FeedsRail } from "../feeds/FeedsRail";

export function RightSidebar() {
  const {
    selectedNote,
    selectedPaper,
    selectedIdea,
    user,
    isRightSidebarOpen,
    setSelectedNote,
    setSelectedPaper,
    setSelectedIdea,
    setCurrentView,
  } = useAppStore(
    useShallow((state) => ({
      selectedNote: state.selectedNote,
      selectedPaper: state.selectedPaper,
      selectedIdea: state.selectedIdea,
      user: state.user,
      isRightSidebarOpen: state.isRightSidebarOpen,
      setSelectedNote: state.setSelectedNote,
      setSelectedPaper: state.setSelectedPaper,
      setSelectedIdea: state.setSelectedIdea,
      setCurrentView: state.setCurrentView,
    })),
  );
  const activeBoost = useGamificationStore((state) => state.activeBoost);
  const boostCountdown = useGamificationStore((state) => state.boostCountdown);
  const streakFreezeTokens = useGamificationStore(
    (state) => state.streakFreezeTokens,
  );
  const restDays = useGamificationStore((state) => state.restDays);
  const [todayXP, setTodayXP] = useState(0);
  const [weeklyPapers, setWeeklyPapers] = useState(0);
  const [activeIdeas, setActiveIdeas] = useState(0);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<
    { id: string; title: string; due_date: string }[]
  >([]);
  const realtimeChannelsRef = useRef<RealtimeChannel[]>([]);

  // Determine current entity
  const currentEntity = selectedNote || selectedPaper || selectedIdea;
  const currentEntityId = currentEntity?.id || null;
  const currentEntityType = selectedNote
    ? "note"
    : selectedPaper
      ? "paper"
      : selectedIdea
        ? "idea"
        : null;

  // Fetch backlinks and related items
  const { backlinks, loading: backlinksLoading } = useBacklinks(
    currentEntityId,
    currentEntityType,
    user?.id,
    { enabled: isRightSidebarOpen },
  );
  const { relatedItems, loading: relatedLoading } = useRelatedItems(
    currentEntityId,
    currentEntityType,
    user?.id,
    { enabled: isRightSidebarOpen },
  );

  useEffect(() => {
    let isMounted = true;

    const clearRealtimeChannels = () => {
      realtimeChannelsRef.current.forEach((channel) => {
        try {
          channel.unsubscribe();
        } catch (error) {
          logger.error("Failed to unsubscribe from Supabase channel", error);
        }
      });
      realtimeChannelsRef.current = [];
    };

    const fetchTodayXp = async (userId: string) => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("daily_logs")
        .select("xp_earned")
        .eq("user_id", userId)
        .eq("date", today)
        .maybeSingle();

      if (!isMounted) {
        return;
      }

      if (error) {
        logger.error("Failed to fetch today's XP:", error);
        return;
      }

      setTodayXP(data?.xp_earned ?? 0);
    };

    const fetchWeeklyPapers = async (userId: string) => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const { count, error } = await supabase
        .from("papers")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", weekAgo.toISOString());

      if (!isMounted) {
        return;
      }

      if (error) {
        logger.error("Failed to fetch weekly paper count:", error);
        return;
      }

      setWeeklyPapers(count ?? 0);
    };

    const fetchActiveIdeas = async (userId: string) => {
      const { count, error } = await supabase
        .from("ideas")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .in("stage", ["Seed", "Growing", "Blooming"]);

      if (!isMounted) {
        return;
      }

      if (error) {
        logger.error("Failed to fetch active ideas count:", error);
        return;
      }

      setActiveIdeas(count ?? 0);
    };

    const fetchUpcomingDeadlines = async (userId: string) => {
      const now = new Date();
      const horizon = new Date();
      horizon.setDate(now.getDate() + 7);

      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, due_date, completed")
        .eq("user_id", userId)
        .eq("completed", false)
        .not("due_date", "is", null)
        .gte("due_date", now.toISOString())
        .lte("due_date", horizon.toISOString())
        .order("due_date", { ascending: true })
        .limit(5);

      if (!isMounted) {
        return;
      }

      if (error) {
        logger.error("Failed to load upcoming deadlines:", error);
        return;
      }

      const tasks =
        (data as
          | { id: string; title: string; due_date: string | null }[]
          | null) ?? [];
      setUpcomingDeadlines(
        tasks
          .filter((item) => Boolean(item.due_date))
          .map((item) => ({
            id: item.id,
            title: item.title,
            due_date: item.due_date as string,
          })),
      );
    };

    const syncSnapshot = async (userId: string) => {
      await Promise.all([
        fetchTodayXp(userId),
        fetchWeeklyPapers(userId),
        fetchActiveIdeas(userId),
        fetchUpcomingDeadlines(userId),
      ]);
    };

    if (!user?.id) {
      setTodayXP(0);
      setWeeklyPapers(0);
      setActiveIdeas(0);
      setUpcomingDeadlines([]);
      clearRealtimeChannels();
      return () => {
        isMounted = false;
        clearRealtimeChannels();
      };
    }

    // Optimization: Skip fetching and subscriptions if sidebar is closed
    if (!isRightSidebarOpen) {
      return () => {
        isMounted = false;
        clearRealtimeChannels();
      };
    }

    const userId = user.id;

    void syncSnapshot(userId);

    clearRealtimeChannels();

    const summaryChannel = supabase
      .channel(`right_sidebar_summary_${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "daily_logs",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void fetchTodayXp(userId);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "papers",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void fetchWeeklyPapers(userId);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ideas",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void fetchActiveIdeas(userId);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void fetchUpcomingDeadlines(userId);
        },
      )
      .subscribe();

    realtimeChannelsRef.current = [summaryChannel];

    return () => {
      isMounted = false;
      clearRealtimeChannels();
    };
  }, [user?.id, isRightSidebarOpen]);

  const hasSelection = selectedNote || selectedPaper || selectedIdea;
  const nextDeadline = upcomingDeadlines[0];

  const handleNavigateToItem = (
    itemId: string,
    itemType: "note" | "paper" | "idea",
  ) => {
    const { notes, papers, ideas } = useAppStore.getState();

    if (itemType === "note") {
      setCurrentView("notes");
      const note = notes.find((item) => item.id === itemId);
      if (note) {
        setSelectedNote(note);
      }
      window.history.pushState(null, "", `/notes/${itemId}`);
    } else if (itemType === "paper") {
      setCurrentView("papers");
      const paper = papers.find((item) => item.id === itemId);
      if (paper) {
        setSelectedPaper(paper);
      }
      window.history.pushState(null, "", `/papers/${itemId}`);
    } else if (itemType === "idea") {
      setCurrentView("ideas");
      const idea = ideas.find((item) => item.id === itemId);
      if (idea) {
        setSelectedIdea(idea);
      }
      window.history.pushState(null, "", `/ideas/${itemId}`);
    }
  };

  const getItemIcon = (type: "note" | "paper" | "idea") => {
    switch (type) {
      case "note":
        return <FileText className="w-4 h-4" aria-hidden="true" />;
      case "paper":
        return <BookOpen className="w-4 h-4" aria-hidden="true" />;
      case "idea":
        return <Lightbulb className="w-4 h-4" aria-hidden="true" />;
    }
  };

  const getItemTypeLabel = (type: "note" | "paper" | "idea") => {
    switch (type) {
      case "note":
        return "Note";
      case "paper":
        return "Paper";
      case "idea":
        return "Idea";
    }
  };

  const gentleReminder = (() => {
    if (restDays > 0) {
      return `You still have ${restDays} rest day${restDays === 1 ? "" : "s"} to lean on. Listen to your energy and take one whenever you need it.`;
    }

    if (streakFreezeTokens > 0) {
      return `Freeze tokens are on standby to protect your streak if life gets busy.`;
    }

    if (activeBoost && boostCountdown) {
      return `Your ${activeBoost.label ?? "focus boost"} is active for another ${boostCountdown}. Enjoy the flow!`;
    }

    if (nextDeadline) {
      return `A tiny action toward "${nextDeadline.title}" counts. Choose the smallest next step and celebrate it.`;
    }

    return "Check in with yourself—resting, reflecting, or noodling on ideas all move the journey forward.";
  })();

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto">
      <div className="p-4 space-y-4">
        {!hasSelection && isRightSidebarOpen ? (
          <FeedsRail />
        ) : (
          <>
            {/* Backlinks Panel */}
            <div className="surface-card p-3.5">
              <div className="mb-2 flex items-center gap-2">
                <span className="icon-tile h-8 w-8 bg-violet-soft text-violet-strong">
                  <Link2 className="w-4 h-4" aria-hidden="true" />
                </span>
                <h3 className="text-small font-semibold text-text-primary">
                  Backlinks
                </h3>
                {backlinks.length > 0 && (
                  <span className="status-chip ml-auto bg-violet-soft text-violet-strong">
                    {backlinks.length}
                  </span>
                )}
              </div>
              <div className="sr-only" role="status" aria-live="polite">
                {!backlinksLoading && backlinks.length === 0 ? "No items link to this yet. Link from notes or ideas to create connections." : ""}
              </div>
              {backlinksLoading ? (
                <div className="text-caption text-text-tertiary">
                  Loading...
                </div>
              ) : backlinks.length === 0 ? (
                <div className="text-center py-6 text-text-tertiary">
                  <Link2 className="w-8 h-8 mx-auto mb-2 opacity-50" aria-hidden="true" />
                  <p className="text-small font-semibold text-text-secondary">No backlinks yet</p>
                  <p className="text-caption mt-1">Link from other items to create connections.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {backlinks.slice(0, 5).map((item) => (
                    <Tooltip key={item.id}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => handleNavigateToItem(item.id, item.type)}
                          aria-label={`Navigate to ${item.type} ${item.title}`}
                          className="w-full text-left p-2 rounded-lg bg-bg-elevated hover:bg-accent-soft border border-border-subtle hover:border-accent transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                        >
                          <div className="flex items-start gap-2">
                            <div className="text-accent-strong mt-0.5">
                              {getItemIcon(item.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-caption font-medium text-text-primary line-clamp-2">
                                {item.title}
                              </div>
                              <div className="text-xs text-text-tertiary mt-0.5">
                                {getItemTypeLabel(item.type)}
                              </div>
                            </div>
                          </div>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Navigate to {item.type} "{item.title}"</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                  {backlinks.length > 5 && (
                    <div className="text-xs text-text-tertiary text-center pt-1">
                      +{backlinks.length - 5} more
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Related Entities */}
            <div className="surface-card p-3.5">
              <div className="mb-2 flex items-center gap-2">
                <span className="icon-tile h-8 w-8 bg-blue-soft text-blue-strong">
                  <Hash className="w-4 h-4" aria-hidden="true" />
                </span>
                <h3 className="text-small font-semibold text-text-primary">
                  Related
                </h3>
                {relatedItems.length > 0 && (
                  <span className="status-chip ml-auto bg-blue-soft text-blue-strong">
                    {relatedItems.length}
                  </span>
                )}
              </div>
              <div className="sr-only" role="status" aria-live="polite">
                {!relatedLoading && relatedItems.length === 0 ? "No related items found. Add topics to discover connections." : ""}
              </div>
              {relatedLoading ? (
                <div className="text-caption text-text-tertiary">
                  Loading...
                </div>
              ) : relatedItems.length === 0 ? (
                <div className="text-center py-6 text-text-tertiary">
                  <Hash className="w-8 h-8 mx-auto mb-2 opacity-50" aria-hidden="true" />
                  <p className="text-small font-semibold text-text-secondary">No related items</p>
                  <p className="text-caption mt-1">Add topics to discover connections.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {relatedItems.slice(0, 5).map((item) => (
                    <Tooltip key={item.id}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => handleNavigateToItem(item.id, item.type)}
                          aria-label={`Navigate to ${item.type} ${item.title}`}
                          className="w-full text-left p-2 rounded-lg bg-bg-elevated hover:bg-accent-soft border border-border-subtle hover:border-accent transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                        >
                          <div className="flex items-start gap-2">
                            <div className="text-accent-strong mt-0.5">
                              {getItemIcon(item.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-caption font-medium text-text-primary line-clamp-2">
                                {item.title}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-text-tertiary">
                                  {getItemTypeLabel(item.type)}
                                </span>
                                <span className="text-xs text-accent-strong">
                                  {item.sharedTopics} topic
                                  {item.sharedTopics === 1 ? "" : "s"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Navigate to {item.type} "{item.title}"</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                  {relatedItems.length > 5 && (
                    <div className="text-xs text-text-tertiary text-center pt-1">
                      +{relatedItems.length - 5} more
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        <div className="pt-4 border-t border-border-subtle space-y-4">
          <div className="surface-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="icon-tile h-8 w-8 bg-gold-soft text-gold-strong">
                <Sparkles className="w-4 h-4" aria-hidden="true" />
              </span>
              <h3 className="section-kicker">
                Today's wins
              </h3>
            </div>
            <div className="space-y-2 text-caption text-text-secondary">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent-strong" aria-hidden="true" />
                <span>+{todayXP} XP collected today</span>
              </div>
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-gold" aria-hidden="true" />
                <span>
                  {user?.current_streak || 0} day streak · longest{" "}
                  {user?.longest_streak || 0} days
                </span>
              </div>
              <p className="text-text-tertiary">
                This week: {weeklyPapers} paper{weeklyPapers === 1 ? "" : "s"}{" "}
                touched · {activeIdeas} idea{activeIdeas === 1 ? "" : "s"}{" "}
                simmering
              </p>
            </div>
          </div>

          <div className="surface-card p-4">
            <div className="flex items-center gap-2">
              <span className="icon-tile h-8 w-8 bg-coral-soft text-coral-strong">
                <CalendarCheck className="w-4 h-4" aria-hidden="true" />
              </span>
              <h3 className="section-kicker">
                Upcoming focus
              </h3>
            </div>
            {upcomingDeadlines.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {upcomingDeadlines.slice(0, 3).map((deadline) => (
                  <li
                    key={deadline.id}
                    className="text-caption bg-bg-elevated rounded-lg p-2.5 border border-border-subtle"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-text-primary truncate">
                        {deadline.title}
                      </span>
                      <span className="text-text-tertiary">
                        {formatDateLabel(deadline.due_date)}
                      </span>
                    </div>
                    <div className="text-text-secondary mt-1">
                      Due in {formatTimeUntil(deadline.due_date)} · choose one
                      kind step forward.
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-caption text-text-secondary">
                No deadlines on the horizon this week. Follow your curiosity or
                take a restorative pause.
              </p>
            )}
          </div>

          <div className="surface-card p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="icon-tile h-8 w-8 bg-blue-soft text-blue-strong">
                <Snowflake className="w-4 h-4" aria-hidden="true" />
              </span>
              <h3 className="section-kicker">
                Energy tools
              </h3>
            </div>
            <div className="text-caption text-text-secondary space-y-1">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-accent-strong mt-0.5" aria-hidden="true" />
                <span>
                  {activeBoost
                    ? `${activeBoost.label ?? "Focus boost"} active${boostCountdown ? ` • ${boostCountdown} remaining` : ""}`
                    : "Boosts are resting. Activate one when you want an intentional sprint."}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Coffee className="w-4 h-4 text-success mt-0.5" />
                <span>
                  {streakFreezeTokens} freeze token
                  {streakFreezeTokens === 1 ? "" : "s"} · {restDays} rest day
                  {restDays === 1 ? "" : "s"} ready to deploy.
                </span>
              </div>
            </div>
          </div>

          <div className="surface-card p-4">
            <div className="flex items-start gap-3">
              <span className="icon-tile h-8 w-8 bg-coral-soft text-coral-strong">
                <Heart className="w-4 h-4" aria-hidden="true" />
              </span>
              <div>
                <h3 className="section-kicker">
                  Gentle reminder
                </h3>
                <p className="mt-2 text-caption text-text-secondary leading-relaxed">
                  {gentleReminder}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

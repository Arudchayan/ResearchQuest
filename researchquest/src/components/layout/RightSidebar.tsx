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
import { useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { useGamificationStore } from "../../store/gamificationStore";
import { logger } from "../../utils/logger";
import { formatTimeUntil, formatDateLabel } from "../../utils/time";
import { useBacklinks } from "../../hooks/useBacklinks";
import { useRelatedItems } from "../../hooks/useRelatedItems";
import { useShallow } from "zustand/react/shallow";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";

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
  const todayXP = useAppStore((state) => state.todayXP);
  const storePapers = useAppStore((state) => state.papers);
  const storeIdeas = useAppStore((state) => state.ideas);
  const storeTasks = useAppStore((state) => state.tasks);

  const weeklyPapers = useMemo(
    () => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return storePapers.filter(
        (p) => new Date(p.created_at) >= weekAgo,
      ).length;
    },
    [storePapers],
  );

  const activeIdeas = useMemo(
    () =>
      storeIdeas.filter((i) =>
        ["Seed", "Growing", "Blooming"].includes(i.stage),
      ).length,
    [storeIdeas],
  );

  const upcomingDeadlines = useMemo(() => {
    // ⚡ PERFORMANCE OPTIMIZATION:
    // Replaced chained .filter().sort().slice().map() with single-pass processing
    // and limited output collection to avoid intermediate array allocations.
    const now = new Date();
    const horizon = new Date();
    horizon.setDate(now.getDate() + 7);

    const filteredTasks = [];
    for (let i = 0; i < storeTasks.length; i++) {
      const t = storeTasks[i];
      if (!t.due_date) continue;
      if ("completed" in t && t.completed) continue;
      if ("status" in t && (t.status === "completed" || t.status === "done")) continue;
      const due = new Date(t.due_date);
      if (due >= now && due <= horizon) {
        filteredTasks.push(t);
      }
    }

    filteredTasks.sort(
      (a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime()
    );

    const results = [];
    for (let i = 0; i < filteredTasks.length; i++) {
      if (results.length === 5) break;
      const t = filteredTasks[i];
      results.push({
        id: t.id,
        title: t.title,
        due_date: t.due_date as string,
      });
    }
    return results;
  }, [storeTasks]);

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

  // No realtime subscriptions here — all data is read from the Zustand store
  // which is kept up to date by useDataSync (daily_logs, papers, ideas) and
  // useTasks (tasks).

  const hasSelection = selectedNote || selectedPaper || selectedIdea;
  const nextDeadline = upcomingDeadlines[0];

  const handleNavigateToItem = (
    itemId: string,
    itemType: "note" | "paper" | "idea",
  ) => {
    if (itemType === "note") {
      setCurrentView("notes");
      // We need to fetch the note first
      const fetchNote = async () => {
        try {
          const { data } = await supabase
            .from("notes")
            .select("*")
            .eq("id", itemId)
            .single();

          if (data) {
            setSelectedNote(data);
            window.history.pushState(null, "", `/notes/${itemId}`);
            window.dispatchEvent(new PopStateEvent("popstate"));
          }
        } catch (error) {
          logger.error("Error navigating to note:", error);
        }
      };
      void fetchNote();
    } else if (itemType === "paper") {
      setCurrentView("papers");
      const fetchPaper = async () => {
        try {
          const { data } = await supabase
            .from("papers")
            .select("*")
            .eq("id", itemId)
            .single();

          if (data) {
            setSelectedPaper(data);
            window.history.pushState(null, "", `/papers/${itemId}`);
            window.dispatchEvent(new PopStateEvent("popstate"));
          }
        } catch (error) {
          logger.error("Error navigating to paper:", error);
        }
      };
      void fetchPaper();
    } else if (itemType === "idea") {
      setCurrentView("ideas");
      const fetchIdea = async () => {
        try {
          const { data } = await supabase
            .from("ideas")
            .select("*")
            .eq("id", itemId)
            .single();

          if (data) {
            setSelectedIdea(data);
            window.history.pushState(null, "", `/ideas/${itemId}`);
            window.dispatchEvent(new PopStateEvent("popstate"));
          }
        } catch (error) {
          logger.error("Error navigating to idea:", error);
        }
      };
      void fetchIdea();
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
    <div className="flex h-full min-w-0 flex-1 flex-col overflow-y-auto">
      <div className="p-4 space-y-4">
        {!hasSelection ? (
          <div className="text-center py-8 text-text-tertiary">
            <p className="text-small">Select an item to see details</p>
          </div>
        ) : (
          <>
            {/* Backlinks Panel */}
            <div className="bg-bg-elevated rounded-lg border border-border-subtle p-3">
              <h3 className="text-small font-semibold text-text-primary mb-2 flex items-center gap-2">
                <Link2 className="w-4 h-4" />
                Backlinks
                {backlinks.length > 0 && (
                  <span className="ml-auto text-xs bg-primary-500/20 text-primary-600 dark:text-primary-400 px-2 py-0.5 rounded-full">
                    {backlinks.length}
                  </span>
                )}
              </h3>
              {backlinksLoading ? (
                <div className="text-caption text-text-tertiary">
                  Loading...
                </div>
              ) : backlinks.length === 0 ? (
                <div className="text-caption text-text-tertiary" role="status" aria-live="polite">
                  No items link to this yet. Link from notes or ideas to create
                  connections.
                </div>
              ) : (
                <div className="space-y-2">
                  {backlinks.slice(0, 5).map((item) => (
                    <Tooltip key={item.id}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => handleNavigateToItem(item.id, item.type)}
                          aria-label={`Navigate to ${item.type} ${item.title}`}
                          className="w-full text-left p-2 rounded-md bg-bg-base hover:bg-primary-500/10 border border-border-subtle hover:border-primary-400 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
                        >
                          <div className="flex items-start gap-2">
                            <div className="text-text-tertiary mt-0.5">
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
            <div className="bg-bg-elevated rounded-lg border border-border-subtle p-3">
              <h3 className="text-small font-semibold text-text-primary mb-2 flex items-center gap-2">
                <Hash className="w-4 h-4" />
                Related
                {relatedItems.length > 0 && (
                  <span className="ml-auto text-xs bg-primary-500/20 text-primary-600 dark:text-primary-400 px-2 py-0.5 rounded-full">
                    {relatedItems.length}
                  </span>
                )}
              </h3>
              {relatedLoading ? (
                <div className="text-caption text-text-tertiary">
                  Loading...
                </div>
              ) : relatedItems.length === 0 ? (
                <div className="text-caption text-text-tertiary" role="status" aria-live="polite">
                  No related items found. Add topics to discover connections.
                </div>
              ) : (
                <div className="space-y-2">
                  {relatedItems.slice(0, 5).map((item) => (
                    <Tooltip key={item.id}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => handleNavigateToItem(item.id, item.type)}
                          aria-label={`Navigate to ${item.type} ${item.title}`}
                          className="w-full text-left p-2 rounded-md bg-bg-base hover:bg-primary-500/10 border border-border-subtle hover:border-primary-400 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
                        >
                          <div className="flex items-start gap-2">
                            <div className="text-text-tertiary mt-0.5">
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
                                <span className="text-xs text-primary-600 dark:text-primary-400">
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
          <div className="p-4 bg-bg-elevated rounded-lg border border-border-subtle space-y-3">
            <div className="flex items-center gap-2 text-text-primary">
              <Sparkles className="w-4 h-4 text-primary-500" />
              <h3 className="text-small font-semibold uppercase tracking-wide">
                Today's wins
              </h3>
            </div>
            <div className="space-y-2 text-caption text-text-secondary">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary-500" />
                <span>+{todayXP} XP collected today</span>
              </div>
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-success" />
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

          <div className="p-4 bg-bg-elevated rounded-lg border border-border-subtle">
            <div className="flex items-center gap-2 text-text-primary">
              <CalendarCheck className="w-4 h-4 text-primary-500" />
              <h3 className="text-small font-semibold uppercase tracking-wide">
                Upcoming focus
              </h3>
            </div>
            {upcomingDeadlines.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {upcomingDeadlines.slice(0, 3).map((deadline) => (
                  <li
                    key={deadline.id}
                    className="text-caption bg-bg-base/60 rounded-md p-2 border border-border-subtle/60"
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

          <div className="p-4 bg-bg-elevated rounded-lg border border-border-subtle space-y-2">
            <div className="flex items-center gap-2 text-text-primary">
              <Snowflake className="w-4 h-4 text-primary-400" />
              <h3 className="text-small font-semibold uppercase tracking-wide">
                Energy tools
              </h3>
            </div>
            <div className="text-caption text-text-secondary space-y-1">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-primary-500 mt-0.5" />
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

          <div className="p-4 bg-bg-elevated rounded-lg border border-border-subtle">
            <div className="flex items-start gap-3 text-text-primary">
              <Heart className="w-5 h-5 text-primary-500 mt-0.5" />
              <div>
                <h3 className="text-small font-semibold uppercase tracking-wide">
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

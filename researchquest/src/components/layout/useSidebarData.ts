import { useState, useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import { logger } from "../../utils/logger";
import { useAppStore } from "../../store/appStore";
import { useGamificationStore } from "../../store/gamificationStore";

interface DeadlinePreview {
  id: string;
  title: string;
  due_date: string;
}

export function useSidebarData() {
  const setUserProfile = useAppStore((state) => state.setUser);
  const hydrateFromProfile = useGamificationStore(
    (state) => state.hydrateFromProfile,
  );

  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [todayXP, setTodayXP] = useState(0);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<DeadlinePreview[]>(
    [],
  );
  const realtimeChannelsRef = useRef<RealtimeChannel[]>([]);

  useEffect(() => {
    let isMounted = true;

    const clearRealtimeChannels = () => {
      realtimeChannelsRef.current.forEach((channel) => {
        try {
          channel.unsubscribe();
        } catch (unsubscribeError) {
          logger.error(
            "Failed to unsubscribe from Supabase channel",
            unsubscribeError instanceof Error ? unsubscribeError.message : "Unknown error",
          );
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

      if (data) {
        setTodayXP(data.xp_earned);
      } else {
        setTodayXP(0);
      }
    };

    const fetchUpcomingDeadlines = async (userId: string) => {
      const now = new Date();
      const horizon = new Date();
      horizon.setDate(now.getDate() + 7);

      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, due_date, status")
        .eq("user_id", userId)
        .neq("status", "completed")
        .neq("status", "done")
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

    const init = async () => {
      const { data, error } = await supabase.auth.getUser();

      if (!isMounted) {
        return;
      }

      if (error) {
        logger.error("Failed to get user:", error);
        return;
      }

      const user = data.user;
      setUserId(user?.id);

      if (!user?.id) {
        setTodayXP(0);
        setUpcomingDeadlines([]);
        return;
      }

      clearRealtimeChannels();
      await fetchTodayXp(user.id);
      await fetchUpcomingDeadlines(user.id);

      const profileChannel = supabase
        .channel("profile_changes")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "user_profiles",
            filter: `id=eq.${user.id}`,
          },
          (payload) => {
            setUserProfile(payload.new as any);
            hydrateFromProfile(payload.new as any);
          },
        )
        .subscribe();

      const logsChannel = supabase
        .channel("daily_logs_changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "daily_logs",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            void fetchTodayXp(user.id);
          },
        )
        .subscribe();

      const tasksChannel = supabase
        .channel("deadline_updates")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "tasks",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            void fetchUpcomingDeadlines(user.id);
          },
        )
        .subscribe();

      realtimeChannelsRef.current = [profileChannel, logsChannel, tasksChannel];
    };

    void init();

    return () => {
      isMounted = false;
      clearRealtimeChannels();
    };
  }, [setUserProfile, hydrateFromProfile]);

  return { userId, todayXP, upcomingDeadlines };
}

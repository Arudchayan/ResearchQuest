import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Achievement, DailyLog } from "../types/database";

export interface WeeklyMomentumPoint {
  day: string;
  label: string;
  xp: number;
  minutes: number;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function buildEmptyWeek(): WeeklyMomentumPoint[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return {
      day: date.toISOString().split("T")[0],
      label: DAY_LABELS[date.getDay()],
      xp: 0,
      minutes: 0,
    };
  });
}

export function useGamificationDashboard(userId: string | undefined) {
  const [weekly, setWeekly] = useState<WeeklyMomentumPoint[]>(buildEmptyWeek);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setWeekly(buildEmptyWeek());
      setAchievements([]);
      return;
    }

    setLoading(true);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    const [logsResult, achievementsResult] = await Promise.all([
      supabase
        .from("daily_logs")
        .select("date, xp_earned")
        .eq("user_id", userId)
        .gte("date", weekStart.toISOString().split("T")[0]),
      supabase
        .from("research_achievements")
        .select("id, achievement_type, title, description, xp_awarded, earned_at")
        .eq("user_id", userId)
        .order("earned_at", { ascending: false })
        .limit(4),
    ]);

    const logs = (logsResult.data ?? []) as Partial<DailyLog>[];
    const byDate = new Map<string, number>();
    logs.forEach((log) => {
      const date = String(log.date ?? "");
      byDate.set(date, (byDate.get(date) ?? 0) + Number(log.xp_earned ?? 0));
    });

    setWeekly(
      buildEmptyWeek().map((point) => ({
        ...point,
        xp: byDate.get(point.day) ?? 0,
      })),
    );
    setAchievements((achievementsResult.data ?? []) as Achievement[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { weekly, achievements, loading, refresh };
}

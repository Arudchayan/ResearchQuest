import { logger } from "../utils/logger";
import { create } from "zustand";
import { supabase } from "../lib/supabase";
import type { ActiveBoost, UserProfile } from "../types/database";

interface BoostConfig {
  type: string;
  label?: string;
  multiplier?: number;
  durationMinutes: number;
}

interface GamificationState {
  streakFreezeTokens: number;
  restDays: number;
  activeBoost: ActiveBoost | null;
  boostCountdown: string | null;
  hydrateFromProfile: (profile: Partial<UserProfile>) => void;
  activateBoost: (userId: string, config: BoostConfig) => Promise<void>;
  consumeFreeze: (userId: string) => Promise<boolean>;
  useRestDay: (userId: string) => Promise<boolean>;
  clearBoostLocally: () => void;
}

type CountdownHandle = ReturnType<typeof setInterval> | undefined;

const formatCountdown = (expiresAt: string | null): string | null => {
  if (!expiresAt) return null;

  const expires = new Date(expiresAt).getTime();
  const now = Date.now();
  const diff = expires - now;

  if (diff <= 0) {
    return null;
  }

  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  }

  return `${minutes.toString().padStart(2, "0")}m ${seconds.toString().padStart(2, "0")}s`;
};

export const useGamificationStore = create<GamificationState>((set, get) => {
  let countdownHandle: CountdownHandle;

  const stopCountdown = () => {
    if (countdownHandle) {
      clearInterval(countdownHandle);
      countdownHandle = undefined;
    }
  };

  const startCountdown = (expiresAt: string | null) => {
    if (typeof window === "undefined") {
      set({ boostCountdown: null });
      return;
    }

    stopCountdown();

    const update = () => {
      const countdown = formatCountdown(expiresAt);
      if (!countdown) {
        stopCountdown();
        set({ boostCountdown: null, activeBoost: null });
        return;
      }

      set({ boostCountdown: countdown });
    };

    update();
    countdownHandle = setInterval(update, 1000);
  };

  return {
    streakFreezeTokens: 0,
    restDays: 0,
    activeBoost: null,
    boostCountdown: null,
    hydrateFromProfile: (profile) => {
      const freezeTokens =
        profile.streak_freeze_tokens ?? get().streakFreezeTokens;
      const restDays = profile.rest_days ?? get().restDays;
      const activeBoost =
        (profile.active_boost as ActiveBoost | null | undefined) ?? null;

      set({
        streakFreezeTokens: freezeTokens,
        restDays,
        activeBoost,
      });

      const expiresAt = activeBoost?.expires_at ?? null;

      if (expiresAt) {
        startCountdown(expiresAt);
      } else {
        stopCountdown();
        set({ boostCountdown: null });
      }
    },
    activateBoost: async (userId, config) => {
      const expiresAt = new Date(
        Date.now() + config.durationMinutes * 60 * 1000,
      ).toISOString();
      const payload: ActiveBoost = {
        type: config.type,
        ...(config.label !== undefined && { label: config.label }),
        ...(config.multiplier !== undefined && { multiplier: config.multiplier }),
        expires_at: expiresAt,
      };

      const { error } = await supabase
        .from("user_profiles")
        .update({ active_boost: payload })
        .eq("id", userId);

      if (error) {
        logger.error(
          "Failed to activate boost:",
          error.message || "Unknown error",
        );
        return;
      }

      set({ activeBoost: payload });
      startCountdown(expiresAt);
    },
    consumeFreeze: async (userId) => {
      const currentTokens = get().streakFreezeTokens;
      if (currentTokens <= 0) {
        return false;
      }

      const { error } = await supabase
        .from("user_profiles")
        .update({ streak_freeze_tokens: currentTokens - 1 })
        .eq("id", userId);

      if (error) {
        logger.error(
          "Failed to consume streak freeze token:",
          error.message || "Unknown error",
        );
        return false;
      }

      set({ streakFreezeTokens: currentTokens - 1 });
      return true;
    },
    useRestDay: async (userId) => {
      const currentRestDays = get().restDays;
      if (currentRestDays <= 0) {
        return false;
      }

      const { error } = await supabase
        .from("user_profiles")
        .update({ rest_days: currentRestDays - 1 })
        .eq("id", userId);

      if (error) {
        logger.error(
          "Failed to consume rest day:",
          error.message || "Unknown error",
        );
        return false;
      }

      set({ restDays: currentRestDays - 1 });
      return true;
    },
    clearBoostLocally: () => {
      stopCountdown();
      set({ activeBoost: null, boostCountdown: null });
    },
  };
});

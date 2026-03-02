import { logger } from "./logger";

// --- Sound Utilities ---

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  return audioCtx;
}

/**
 * Initializes or resumes the AudioContext.
 * Call this function during a user interaction (e.g., button click) to ensure
 * audio can play later without a user gesture.
 */
export function warmupAudio(): void {
  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") {
      ctx
        .resume()
        .catch((e) => logger.error("Failed to resume audio context", e));
    }
  } catch (error) {
    logger.error("Failed to warm up audio", error);
  }
}

/**
 * Plays a pleasant "ding" sound using the Web Audio API.
 * No external assets required.
 */
export function playTimerCompleteSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) {
      logger.warn("AudioContext not supported");
      return;
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Connect nodes
    osc.connect(gain);
    gain.connect(ctx.destination);

    // Set oscillator parameters (Sine wave sweeping up slightly)
    osc.type = "sine";

    // C5 (523.25 Hz)
    const startTime = ctx.currentTime;
    osc.frequency.setValueAtTime(523.25, startTime);
    // Sweep to C6 (1046.5 Hz) quickly for a "ping" effect
    osc.frequency.exponentialRampToValueAtTime(1046.5, startTime + 0.1);

    // Set gain envelope (fade out)
    gain.gain.setValueAtTime(0.3, startTime); // Start at 30% volume
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 1.5); // Fade to near silence over 1.5s

    // Start and stop
    osc.start(startTime);
    osc.stop(startTime + 1.5);
  } catch (error) {
    logger.error("Failed to play timer completion sound", error);
  }
}

// --- Notification Utilities ---

/**
 * Requests permission to show browser notifications.
 * Returns the permission status ('granted', 'denied', or 'default').
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) {
    logger.warn("Notifications not supported");
    return "denied";
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    logger.error("Failed to request notification permission", error);
    return "denied";
  }
}

/**
 * Shows a browser notification if permission is granted.
 * @param title The title of the notification
 * @param options Additional options (body, icon, etc.)
 */
export function showTimerCompleteNotification(
  title: string,
  options?: NotificationOptions,
): void {
  if (!("Notification" in window)) {
    return;
  }

  if (Notification.permission === "granted") {
    try {
      // Create notification
      // We don't store the instance as we don't need to close it programmatically (system handles it)
      new Notification(title, {
        icon: "/favicon.svg", // Use app icon if available
        silent: true, // We play our own custom sound via Web Audio API
        ...options,
      });
    } catch (error) {
      logger.error("Failed to show notification", error);
    }
  } else {
    logger.warn("Notification permission not granted");
  }
}

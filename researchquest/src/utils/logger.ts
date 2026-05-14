/**
 * Sentinel Logger
 *
 * A secure logging utility that wraps console methods to prevent information leakage
 * in production environments.
 *
 * - In development (import.meta.env.DEV), it logs everything for debugging.
 * - In production, it suppresses debug logs (info, warn) and sanitizes error logs
 *   to only show the error message, preventing leakage of sensitive data or stack traces.
 */

export const logger = {
  /**
   * Log informational messages. No-op in production.
   */
  log: (...args: any[]) => {
    if (import.meta.env.DEV) {
      console.log(...args);
    }
  },

  /**
   * Log warning messages. No-op in production.
   */
  warn: (...args: any[]) => {
    if (import.meta.env.DEV) {
      console.warn(...args);
    }
  },

  /**
   * Log error messages.
   * In production, it only logs the error message string to prevent leaking sensitive details.
   * In development, it logs the full error object.
   */
  error: (message: string, error?: any) => {
    if (import.meta.env.DEV && process.env.NODE_ENV !== 'test') {
      console.error(`[RQ] ${message}`, error);
    } else {
      const errorMessage =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : typeof error === "object" && error !== null && "message" in error
              ? String(error.message)
              : undefined;

      if (errorMessage) {
        console.error(`[RQ] ${message}: ${errorMessage}`);
      } else {
        console.error(`[RQ] ${message}`);
      }
    }
  },
};

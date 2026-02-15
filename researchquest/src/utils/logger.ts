
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

const isDev = import.meta.env.DEV;

export const logger = {
  /**
   * Log informational messages. No-op in production.
   */
  log: (...args: any[]) => {
    if (isDev) {
      console.log(...args);
    }
  },

  /**
   * Log warning messages. No-op in production.
   */
  warn: (...args: any[]) => {
    if (isDev) {
      console.warn(...args);
    }
  },

  /**
   * Log error messages.
   * In production, it only logs the error message string to prevent leaking sensitive details.
   * In development, it logs the full error object.
   */
  error: (message: string, error?: any) => {
    if (isDev) {
      console.error(message, error);
    } else {
      // In production, sanitize the error object
      // Only log the message if available, otherwise just the initial message
      const errorMessage = error instanceof Error ? error.message :
                           (typeof error === 'string' ? error : undefined);

      if (errorMessage) {
        console.error(`${message}: ${errorMessage}`);
      } else {
        console.error(message);
      }
    }
  }
};

## 2024-04-23 - Prevent Information Leakage in useTasks
**Vulnerability:** Information Leakage in frontend error logging.
**Learning:** `src/hooks/useTasks.ts` was passing raw, potentially sensitive error objects directly to `logger.error`, which forwards them to `console.error` in DEV/test environments.
**Prevention:** Always sanitize error objects or pass only error strings (e.g., `error instanceof Error ? error.message : String(error)`) when logging sensitive operations to prevent accidental exposure of stack traces or database details.

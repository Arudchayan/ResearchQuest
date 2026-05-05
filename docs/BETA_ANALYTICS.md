# Beta Analytics & Error Visibility

## Approach

All application errors are routed through `src/utils/logger.ts`. The `logger.error()` function prefixes every error with `[RQ]` so errors are filterable in browser DevTools and any external log aggregator.

**Filter in DevTools console:** `[RQ]`

## Error Tagging Convention

```
[RQ] <human-readable context>: <error message>
```

Examples:
- `[RQ] Failed to fetch notes: network timeout`
- `[RQ] Failed to fetch tasks: permission denied`

## Covered Hooks

All six data hooks call `logger.error()` and therefore emit `[RQ]`-prefixed errors automatically:

| Hook | Resource |
|------|----------|
| `useDataSync.ts` | notes, papers, ideas, focus sessions |
| `useNotes.ts` | notes CRUD |
| `usePapers.ts` | papers CRUD |
| `useIdeas.ts` | ideas CRUD |
| `useTasks.ts` | tasks CRUD |
| `useTopics.ts` | topics CRUD |

## Production Behaviour

In production builds, `logger.error()` sanitizes stack traces and only emits the error message string — no raw objects or sensitive data. The `[RQ]` prefix is preserved in both dev and production.

## Future Work

- Wire `[RQ]` errors to an external service (Sentry, LogRocket) once beta traffic warrants it.
- Add a user-visible error reporting prompt for unhandled promise rejections.

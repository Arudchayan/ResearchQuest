# Task 21 — Fix inert HTML attribute TypeScript errors

## Problem
3 TypeScript errors in `src/components/layout/v2/AppShell.tsx` at lines 126, 166, 204:
```
Property 'inert' does not exist on type 'DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>'
```

## Root Cause
The `inert` HTML attribute is a standard global attribute supported by modern browsers, but it was missing from React's TypeScript type definitions for `HTMLAttributes<T>`.

## Fix
Created `src/inert.d.ts` with a module augmentation for `React.HTMLAttributes`:

```typescript
import 'react';

declare module 'react' {
  interface HTMLAttributes<T> {
    inert?: string;
  }
}
```

This uses TypeScript declaration merging to add the `inert` property globally to all HTML element attributes. No changes were made to `AppShell.tsx` — the `inert` attribute usage remains intact for accessibility purposes.

## Verification
- `pnpm exec tsc -b --noEmit` exits with code 0
- LSP diagnostics show no errors on either `AppShell.tsx` or `inert.d.ts`

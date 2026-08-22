# Task 12 — Strict TypeScript Incremental Allowlist Gate

## Summary

Created `tsconfig.strict.json` extending `tsconfig.app.json` with full strict mode, and wired a `typecheck:strict` script. The strict config uses an explicit `include` array so modules can be added incrementally — no project-wide flag-day required.

## Files Created

| File | Purpose |
|---|---|
| `researchquest/tsconfig.strict.json` | Strict TS config extending `tsconfig.app.json` |
| `researchquest/src/strict-gate/pass.ts` | Minimal canary that passes strict checks |
| `researchquest/src/strict-gate/fail.fixture.ts` | Fixture proving gate catches violations |

## Files Modified

| File | Change |
|---|---|
| `researchquest/package.json` | Added `"typecheck:strict"` script |

## Strict Config Flags Enabled

| Flag | Value |
|---|---|
| `strict` | `true` (enables all base strict flags) |
| `noImplicitAny` | `true` |
| `noImplicitReturns` | `true` |
| `noImplicitThis` | `true` |
| `noUncheckedIndexedAccess` | `true` |
| `exactOptionalPropertyTypes` | `true` |
| `noPropertyAccessFromIndexSignature` | `true` |
| `noUncheckedSideEffectImports` | `true` |

## Verification Results

### ✅ Strict gate passes (passing fixture)
```
$ pnpm exec tsc -p tsconfig.strict.json --noEmit
→ exit code 0
```

### ❌ Strict gate catches unsafe code (failing fixture)
```
src/strict-gate/fail.fixture.ts(5,29): error TS7006: Parameter 'x' implicitly has an 'any' type.
src/strict-gate/fail.fixture.ts(11,3): error TS2322: Type 'string | undefined' is not assignable to type 'string'.
  Type 'undefined' is not assignable to type 'string'.
src/strict-gate/fail.fixture.ts(19,3): error TS2322: Type 'string | undefined' is not assignable to type 'string'.
  Type 'undefined' is not assignable to type 'string'.
→ exit code 2
```

Three distinct violations caught:
1. **TS7006** — `noImplicitAny` catches untyped parameter `x`
2. **TS2322 (line 11)** — `noUncheckedIndexedAccess` catches `arr[0]` returning `string | undefined`
3. **TS2322 (line 19)** — `exactOptionalPropertyTypes` catches assigning optional `bag.name` to `string`

### ✅ Normal build unchanged
```
$ pnpm exec tsc -b --noEmit
→ exit code 0
```

No changes to `tsconfig.app.json`. The main `tsc -b` build is unaffected.

## Usage

To add a module to the strict gate:

```json
// tsconfig.strict.json
"include": [
  "src/strict-gate/pass.ts",
  "src/new-module/**/*.ts"
]
```

Then run:
```
pnpm run typecheck:strict
```

Fix any strict violations in the new module before committing. Existing code outside the include list is unaffected.

// This file intentionally violates strict TypeScript checks
// to prove the strict allowlist gate catches unsafe patterns.

// Violation 1: implicit any (noImplicitAny)
export function implicitAny(x) {
  return x + 1;
}

// Violation 2: unchecked indexed access (noUncheckedIndexedAccess)
export function uncheckedAccess(arr: string[]): string {
  return arr[0];
}

// Violation 3: exact optional property types (exactOptionalPropertyTypes)
interface OptionalBag {
  name?: string;
}
export function exactOptional(bag: OptionalBag): string {
  return bag.name;
}

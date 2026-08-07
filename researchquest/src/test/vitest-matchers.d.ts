/* eslint-disable @typescript-eslint/no-unused-vars */
// ---------------------------------------------------------------------------
// Bridge jest-dom matchers for strict-mode TypeScript + vitest v4
// ---------------------------------------------------------------------------
// With `noPropertyAccessFromIndexSignature` enabled, module-augmented
// matchers like `toBeInTheDocument` are invisible on `Assertion` because
// vitest v4's `Assertion` type uses an index signature internally.
//
// This file explicitly declares the matchers we use so strict builds pass.
// ---------------------------------------------------------------------------

/// <reference types="vitest/globals" />
import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";

declare module "vitest" {
  interface Assertion<T = any>
    extends TestingLibraryMatchers<string, void> {}
}

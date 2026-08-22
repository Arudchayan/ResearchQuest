/// <reference types="vitest/globals" />
// ---------------------------------------------------------------------------
// Bridge jest-dom matchers for strict-mode TypeScript + vitest v4
// ---------------------------------------------------------------------------
// With `noPropertyAccessFromIndexSignature` enabled, module-augmented
// matchers like `toBeInTheDocument` are invisible on `Assertion` because
// vitest v4's `Assertion` type uses an index signature internally.
//
// This file explicitly declares the matchers we use so strict builds pass.
// ---------------------------------------------------------------------------

declare module "vitest" {
  interface Assertion<T = any> {
    toBeInTheDocument(): void;
    toBeDisabled(): void;
    toBeEnabled(): void;
    toBeRequired(): void;
    toBeVisible(): void;
    toBeChecked(): void;
    toBeEmpty(): void;
    toBePartiallyChecked(): void;
    toBeInvalid(): void;
    toBeInTheDOM(container?: HTMLElement | SVGElement): void;
    toHaveAttribute(attr: string, value?: unknown): void;
    toHaveClass(...classNames: Array<string | RegExp>): void;
    toHaveFocus(): void;
    toHaveTextContent(
      text: string | RegExp,
      options?: { normalizeWhitespace: boolean },
    ): void;
    toHaveValue(value?: string | string[] | number | null): void;
    toHaveStyle(css: string | Record<string, unknown>): void;
    toHaveFormValues(expectedValues: Record<string, unknown>): void;
    toHaveAccessibleName(text?: string | RegExp): void;
    toHaveAccessibleDescription(text?: string | RegExp): void;
    toHaveErrorMessage(text?: string | RegExp): void;
  }
}

export {};

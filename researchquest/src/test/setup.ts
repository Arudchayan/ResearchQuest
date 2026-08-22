import { expect, afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import "./mocks/supabase";

expect.extend(matchers);

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any;

// jsdom in this vitest setup does not expose localStorage (only sessionStorage),
// which crashes zustand persist stores and components that read window.localStorage
// at mount time. Provide an in-memory Storage-compatible mock.
function createStorageMock() {
  let store: Record<string, string> = {};
  return {
    get length() {
      return Object.keys(store).length;
    },
    clear() {
      store = {};
    },
    getItem(key: string) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    key(index: number) {
      return Object.keys(store)[index] ?? null;
    },
    removeItem(key: string) {
      delete store[key];
    },
    setItem(key: string, value: string) {
      store[key] = String(value);
    },
  };
}

const localStorageMock = createStorageMock();
const sessionStorageMock = createStorageMock();

// Define storage mocks defensively: some installs/environments (e.g. pnpm with
// ignored build scripts, Node's experimental webstorage) expose undefined
// localStorage, which crashes zustand persist and components at mount time.
// Guard each defineProperty so a non-configurable built-in can never nuke the
// entire suite.
function defineStorage(name: "localStorage" | "sessionStorage", mock: unknown) {
  try {
    Object.defineProperty(globalThis, name, {
      writable: true,
      configurable: true,
      value: mock,
    });
  } catch {
    // non-configurable global (Node webstorage) — leave as-is
  }
  try {
    Object.defineProperty(window, name, {
      writable: true,
      configurable: true,
      value: mock,
    });
  } catch {
    // non-configurable window property — leave as-is
  }
}

defineStorage("localStorage", localStorageMock);
defineStorage("sessionStorage", sessionStorageMock);

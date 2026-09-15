/**
 * Read-through list cache (IndexedDB with in-memory fallback).
 *
 * Scope is deliberately narrow: list reads only. No write queue, no PWA
 * offline shell, no CRDT — lists render the cached snapshot immediately
 * while the caller revalidates, and a stale-read banner (see
 * `components/layout/StaleBanner.tsx`) appears only while stale data is
 * shown.
 *
 * - TTL: entries older than `LIST_CACHE_TTL_MS` are returned with
 *   `stale: true` so the UI can banner them, then overwritten on revalidate.
 * - Version key: `LIST_CACHE_VERSION` bumps invalidate old envelopes.
 * - Cache failures never throw to callers of the read/write helpers beyond
 *   a resolved null/no-op — a broken cache must not break list reads.
 */

export const LIST_CACHE_VERSION = "rq-list-cache/v1";
export const LIST_CACHE_TTL_MS = 5 * 60 * 1000;

export function cacheKeyForList(resource: string, userId: string): string {
  return `list:${resource}:${userId}`;
}

interface CacheEnvelope {
  version: string;
  fetchedAt: number;
  data: unknown[];
}

export interface CachedList<T> {
  data: T[];
  /** True when the entry is past TTL and shown pending revalidation. */
  stale: boolean;
}

// ---------------------------------------------------------------------------
// Storage backend: IndexedDB when available, in-memory otherwise (SSR,
// jsdom/vitest, private-mode failures all degrade gracefully).
// ---------------------------------------------------------------------------

const memoryStore = new Map<string, CacheEnvelope>();

function idbAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  } catch {
    return false;
  }
}

const DB_NAME = "rq-list-cache";
const STORE_NAME = "lists";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB open failed"));
  });
}

function idbRequest<T>(make: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        let settled = false;
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.oncomplete = () => db.close();
        tx.onabort = () => {
          db.close();
          if (!settled) {
            settled = true;
            reject(tx.error ?? new Error("IndexedDB transaction aborted"));
          }
        };
        tx.onerror = () => {
          db.close();
          if (!settled) {
            settled = true;
            reject(tx.error ?? new Error("IndexedDB transaction failed"));
          }
        };
        let request: IDBRequest<T>;
        try {
          request = make(tx.objectStore(STORE_NAME));
        } catch (error) {
          try {
            db.close();
          } catch {
            // ignore close errors
          }
          reject(error);
          return;
        }
        request.onsuccess = () => {
          settled = true;
          resolve(request.result);
        };
        request.onerror = () => {
          settled = true;
          reject(request.error ?? new Error("IndexedDB request failed"));
        };
      }),
  );
}

async function backendGet(key: string): Promise<CacheEnvelope | null> {
  if (!idbAvailable()) return memoryStore.get(key) ?? null;
  try {
    const value = await idbRequest<CacheEnvelope | undefined>((store) =>
      store.get(key),
    );
    return value ?? null;
  } catch {
    return memoryStore.get(key) ?? null;
  }
}

async function backendSet(key: string, envelope: CacheEnvelope): Promise<void> {
  memoryStore.set(key, envelope);
  if (!idbAvailable()) return;
  try {
    await idbRequest((store) => store.put(envelope, key));
  } catch {
    // Memory copy above is the fallback; never throw for cache writes.
  }
}

async function backendClear(): Promise<void> {
  memoryStore.clear();
  if (!idbAvailable()) return;
  try {
    await idbRequest((store) => store.clear());
  } catch {
    // Already cleared in memory; ignore.
  }
}

// ---------------------------------------------------------------------------
// Public read/write API.
// ---------------------------------------------------------------------------

export async function readListCache<T>(
  key: string,
  ttlMs: number = LIST_CACHE_TTL_MS,
): Promise<CachedList<T> | null> {
  let envelope: CacheEnvelope | null = null;
  try {
    envelope = await backendGet(key);
  } catch {
    return null;
  }
  if (!envelope || envelope.version !== LIST_CACHE_VERSION) return null;
  if (!Array.isArray(envelope.data)) return null;
  const age = Date.now() - envelope.fetchedAt;
  return { data: envelope.data as T[], stale: age > ttlMs };
}

export async function writeListCache<T>(
  key: string,
  data: T[],
): Promise<void> {
  try {
    await backendSet(key, {
      version: LIST_CACHE_VERSION,
      fetchedAt: Date.now(),
      data: [...data],
    });
  } catch {
    // Cache writes are best-effort.
  }
}

export async function clearListCache(): Promise<void> {
  try {
    await backendClear();
  } catch {
    // Best-effort.
  }
  clearAllStaleKeys();
}

// ---------------------------------------------------------------------------
// Stale-read signal for the banner. Module-level so any list hook can mark
// keys without prop drilling; the banner subscribes once at shell level.
// ---------------------------------------------------------------------------

let staleSnapshot: readonly string[] = [];
const staleListeners = new Set<() => void>();

function emitStaleChange(next: readonly string[]): void {
  staleSnapshot = next;
  staleListeners.forEach((listener) => listener());
}

export function subscribeStaleKeys(listener: () => void): () => void {
  staleListeners.add(listener);
  return () => {
    staleListeners.delete(listener);
  };
}

export function getStaleKeysSnapshot(): readonly string[] {
  return staleSnapshot;
}

export function markStaleKeys(key: string): void {
  if (staleSnapshot.includes(key)) return;
  emitStaleChange([...staleSnapshot, key]);
}

export function clearStaleKeys(key: string): void {
  if (!staleSnapshot.includes(key)) return;
  emitStaleChange(staleSnapshot.filter((entry) => entry !== key));
}

export function clearAllStaleKeys(): void {
  if (staleSnapshot.length === 0) return;
  emitStaleChange([]);
}

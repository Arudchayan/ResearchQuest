/** Shared API gateway utilities for ResearchQuest REST edge function. */

export const ALL_SCOPES = [
  "keys:read",
  "keys:write",
  "notes:read",
  "notes:write",
  "papers:read",
  "papers:write",
  "ideas:read",
  "ideas:write",
  "topics:read",
  "topics:write",
  "tasks:read",
  "tasks:write",
  "goals:read",
  "goals:write",
  "feeds:read",
  "feeds:write",
  "feeds:ingest",
] as const;

export type ApiScope = (typeof ALL_SCOPES)[number];

export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "CONFLICT"
  | "INTERNAL_ERROR"
  | "CONFIG_ERROR";

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

export function jsonResponse(
  body: unknown,
  status: number,
  headers: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

export function errorResponse(
  code: ErrorCode,
  message: string,
  status: number,
  headers: HeadersInit = {},
  details?: unknown,
): Response {
  const body: ApiErrorBody = {
    error: details === undefined ? { code, message } : { code, message, details },
  };
  return jsonResponse(body, status, headers);
}

/** Constant-time string comparison to mitigate timing attacks. */
export function secureCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  let mismatch = a.length === b.length ? 0 : 1;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const charA = i < a.length ? a.charCodeAt(i) : 0;
    const charB = i < b.length ? b.charCodeAt(i) : 0;
    mismatch |= charA ^ charB;
  }
  return mismatch === 0;
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generateApiKeySecret(): { rawKey: string; prefix: string } {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const secret = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const rawKey = `rq_${secret}`;
  const prefix = rawKey.slice(0, 11);
  return { rawKey, prefix };
}

export function hasScope(granted: string[], required: string): boolean {
  if (granted.includes("*") || granted.includes("*:*")) return true;
  if (granted.includes(required)) return true;
  const [resource] = required.split(":");
  if (resource && granted.includes(`${resource}:*`)) return true;
  return false;
}

export function parseBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  return match?.[1]?.trim() || null;
}

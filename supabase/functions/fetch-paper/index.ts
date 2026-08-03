/**
 * Production fetch-paper: resolves a DOI via the Crossref public API and returns
 * title, authors, abstract, publication year, container (journal), DOI, and URLs.
 * Non-DOI identifiers are not implemented; extend before calling this production-ready for broader search.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APP_USER_AGENT = "ResearchQuest/1.0 (mailto:research@researchquest.app)";
const DEFAULT_TIMEOUT_MS = 8000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_DEV_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
  "http://127.0.0.1:4173",
];

interface CrossrefAuthor {
  given?: string;
  family?: string;
}

interface CrossrefWork {
  DOI?: string;
  title?: string[];
  author?: CrossrefAuthor[];
  abstract?: string;
  published?: {
    "date-parts"?: number[][];
  };
  URL?: string;
  "container-title"?: string[];
  publisher?: string;
  type?: string;
}

interface RateLimitBucket {
  timestamps: number[];
}

interface RateLimitResult {
  allowed: boolean;
  resetAt: number;
}

const rateLimitBuckets = new Map<string, RateLimitBucket>();

function parseAllowedOrigins(): string[] {
  const configured = Deno.env.get("ALLOWED_ORIGINS");
  if (!configured || !configured.trim()) {
    return DEFAULT_DEV_ALLOWED_ORIGINS;
  }
  return configured
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

function buildCorsHeaders(req: Request): HeadersInit {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
  const origin = req.headers.get("Origin");
  const allowed = parseAllowedOrigins();

  const allowlist = allowed.length > 0 ? allowed : DEFAULT_DEV_ALLOWED_ORIGINS;
  if (origin && allowlist.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  } else {
    headers["Access-Control-Allow-Origin"] = allowlist[0];
  }

  return headers;
}

function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    console.error(`[FATAL] Required environment variable "${name}" is not set.`);
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function formatCrossrefWork(work: CrossrefWork) {
  return {
    doi: work?.DOI || "",
    title: work?.title?.[0] || "Untitled",
    authors:
      work?.author?.map((author) =>
        `${author?.given || ""} ${author?.family || ""}`.trim(),
      ) || [],
    abstract: work?.abstract || "",
    publicationDate: work?.published?.["date-parts"]?.[0]?.[0] || null,
    sourceUrl: work?.URL || (work?.DOI ? `https://doi.org/${work.DOI}` : ""),
    containerTitle: work?.["container-title"]?.[0] || "",
    publisher: work?.publisher || "",
    type: work?.type || "article",
  };
}

function jsonResponse(body: unknown, status: number, corsHeaders: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function checkRateLimit(userId: string): RateLimitResult {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const key = `fetch-paper:${userId}`;
  const bucket = rateLimitBuckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((timestamp) =>
    timestamp > windowStart
  );

  if (bucket.timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    rateLimitBuckets.set(key, bucket);
    return {
      allowed: false,
      resetAt: (bucket.timestamps[0] ?? now) + RATE_LIMIT_WINDOW_MS,
    };
  }

  bucket.timestamps.push(now);
  rateLimitBuckets.set(key, bucket);
  return { allowed: true, resetAt: now + RATE_LIMIT_WINDOW_MS };
}

function retryAfterSeconds(resetAt: number): string {
  return String(Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)));
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(
        { error: { code: "UNAUTHORIZED", message: "Missing Authorization header" } },
        401,
        corsHeaders,
      );
    }

    const supabaseClient = createClient(
      getRequiredEnv("SUPABASE_URL"),
      getRequiredEnv("SUPABASE_ANON_KEY"),
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return jsonResponse(
        { error: { code: "UNAUTHORIZED", message: "Invalid or expired token" } },
        401,
        corsHeaders,
      );
    }

    const rateLimit = checkRateLimit(user.id);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          error: { code: "RATE_LIMITED", message: "Too many requests" },
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": retryAfterSeconds(rateLimit.resetAt),
          },
        },
      );
    }

    const { doi, query, rows, sort, order } = await req.json();

    if ((doi && typeof doi === 'string' && doi.length > 2000) || (query && typeof query === 'string' && query.length > 2000)) {
      return jsonResponse(
        { error: { code: "INVALID_REQUEST", message: "Input exceeds maximum allowed length" } },
        400,
        corsHeaders,
      );
    }

    if (doi) {
      const crossrefUrl = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
      const response = await fetchWithTimeout(crossrefUrl, {
        headers: {
          Accept: "application/json",
          "User-Agent": APP_USER_AGENT,
        },
      });

      if (!response.ok) {
        return jsonResponse(
          { error: { code: "NOT_FOUND", message: "Paper not found" } },
          404,
          corsHeaders,
        );
      }

      const data = await response.json();
      return jsonResponse({ data: formatCrossrefWork(data?.message) }, 200, corsHeaders);
    }

    if (query) {
      const params = new URLSearchParams();
      params.set("query", query);

      const parsedRows = Number(rows);
      params.set(
        "rows",
        Number.isNaN(parsedRows)
          ? "10"
          : Math.min(Math.max(parsedRows, 1), 100).toString(),
      );

      const allowedSorts = new Set([
        "score",
        "published",
        "created",
        "updated",
        "indexed",
      ]);
      const allowedOrders = new Set(["asc", "desc"]);

      if (typeof sort === "string" && allowedSorts.has(sort)) {
        params.set("sort", sort);

        const normalizedOrder = typeof order === "string" ? order.toLowerCase() : "";
        if (allowedOrders.has(normalizedOrder)) {
          params.set("order", normalizedOrder);
        }
      }

      const crossrefUrl = `https://api.crossref.org/works?${params.toString()}`;
      const response = await fetchWithTimeout(crossrefUrl, {
        headers: {
          Accept: "application/json",
          "User-Agent": APP_USER_AGENT,
        },
      });

      if (!response.ok) {
        return jsonResponse(
          { error: { code: "SEARCH_FAILED", message: "Search failed" } },
          502,
          corsHeaders,
        );
      }

      const data = await response.json();
      const papers = Array.isArray(data?.message?.items)
        ? data.message.items.map(formatCrossrefWork)
        : [];

      return jsonResponse({ data: papers }, 200, corsHeaders);
    }

    return jsonResponse(
      { error: { code: "INVALID_REQUEST", message: "Must provide doi or query" } },
      400,
      corsHeaders,
    );
  } catch (_error) {
    return jsonResponse(
      {
        error: {
          code: "FUNCTION_ERROR",
          message: "An unexpected error occurred during paper fetch.",
        },
      },
      500,
      corsHeaders,
    );
  }
});

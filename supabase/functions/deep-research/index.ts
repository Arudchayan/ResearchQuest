import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface SemanticPaper {
  paperId: string;
  title: string;
  abstract: string | null;
  year: number | null;
  citationCount: number | null;
  authors: Array<{ name: string }>;
  fieldsOfStudy: string[] | null;
  externalIds: Record<string, string> | null;
}

interface DeepResearchResult {
  query: string;
  reasoningSteps: string[];
  summary: string;
  suggestedKeywords: string[];
  timestamp: string;
  papers?: Array<{
    title: string;
    year: number | null;
    citationCount: number | null;
    authors: string[];
    abstract: string | null;
  }>;
}

interface AISynthesisResult {
  summary: string;
  keywords: string[];
}

const APP_USER_AGENT = "ResearchQuest/1.0 (mailto:research@researchquest.app)";
const RATE_LIMIT_MAX_REQUESTS = 10;
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
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

function jsonResponse(body: unknown, status: number, corsHeaders: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function checkRateLimit(userId: string): RateLimitResult {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const key = `deep-research:${userId}`;
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

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 12000,
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function searchSemanticScholar(query: string): Promise<SemanticPaper[]> {
  const fields = "title,abstract,year,citationCount,authors,fieldsOfStudy,externalIds";
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&fields=${fields}&limit=8`;

  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": APP_USER_AGENT,
  };
  const apiKey = Deno.env.get("SEMANTIC_SCHOLAR_API_KEY");
  if (apiKey) headers["x-api-key"] = apiKey;

  const response = await fetchWithTimeout(url, { headers });
  if (!response.ok) {
    console.error(`[RQ] Semantic Scholar returned ${response.status}`);
    return [];
  }
  const data = await response.json();
  return Array.isArray(data?.data) ? data.data : [];
}

function buildPaperContext(papers: SemanticPaper[]): string {
  return papers
    .slice(0, 6)
    .map((p, i) => {
      const authors = p.authors?.slice(0, 2).map((a) => a.name).join(", ") || "Unknown";
      const abstract = p.abstract
        ? p.abstract.slice(0, 300) + (p.abstract.length > 300 ? "..." : "")
        : "No abstract available.";
      return `${i + 1}. "${p.title}" (${p.year ?? "n.d."}) by ${authors}\n   Abstract: ${abstract}`;
    })
    .join("\n\n");
}

function parseAIJson(content: string): AISynthesisResult | null {
  try {
    const clean = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(clean);
    if (typeof parsed.summary === "string" && Array.isArray(parsed.keywords)) {
      return { summary: parsed.summary, keywords: parsed.keywords };
    }
    return null;
  } catch {
    return null;
  }
}

const AI_PROMPT_SUFFIX = `\n\nRespond ONLY with JSON: {"summary": "...", "keywords": ["keyword1", "keyword2", ...]}`;

async function synthesiseWithOpenAI(
  query: string,
  papers: SemanticPaper[],
  apiKey: string,
): Promise<AISynthesisResult | null> {
  const prompt =
    `You are a research assistant. Based on these papers for the query "${query}", write a concise 3-4 sentence research landscape summary covering the current state, key themes, and notable gaps. Also provide 6-8 specific search keywords.\n\nPapers:\n${buildPaperContext(papers)}` +
    AI_PROMPT_SUFFIX;

  try {
    const response = await fetchWithTimeout(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.3,
          max_tokens: 600,
        }),
      },
      15000,
    );
    if (!response.ok) return null;
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      console.error("[ERROR] OpenRouter response missing content:", JSON.stringify(data));
      return null;
    }
    return parseAIJson(content);
  } catch {
    return null;
  }
}

function extractKeywords(query: string, papers: SemanticPaper[]): string[] {
  const seen = new Set<string>();
  const add = (w: string) => seen.add(w.toLowerCase());

  query.split(/\s+/).filter((w) => w.length >= 4).forEach(add);
  papers.forEach((p) => p.fieldsOfStudy?.forEach(add));
  papers.slice(0, 4).forEach((p) =>
    p.title.split(/\s+/).forEach((w) => {
      const clean = w.replace(/[^a-zA-Z]/g, "");
      if (clean.length >= 5 && /^[A-Z]/.test(clean)) add(clean);
    })
  );

  return Array.from(seen).slice(0, 8);
}

function buildFallbackSummary(query: string, papers: SemanticPaper[]): string {
  if (papers.length === 0) {
    return `No papers found on Semantic Scholar for "${query}". Try rephrasing with more specific terminology.`;
  }

  const topPaper = papers.reduce(
    (best, p) => ((p.citationCount ?? 0) > (best.citationCount ?? 0) ? p : best),
    papers[0],
  );
  const fields = [...new Set(papers.flatMap((p) => p.fieldsOfStudy ?? []))].slice(0, 4).join(", ");
  const years = papers.map((p) => p.year).filter(Boolean) as number[];
  const yearRange = years.length ? ` (${Math.min(...years)}-${Math.max(...years)})` : "";
  const snippet = topPaper.abstract
    ? " " + topPaper.abstract.slice(0, 200).replace(/\n/g, " ") + "..."
    : "";

  return (
    `Semantic Scholar returned ${papers.length} papers for "${query}"${yearRange}. ` +
    `The most-cited work is "${topPaper.title}" by ${topPaper.authors?.[0]?.name ?? "unknown authors"} ` +
    `(${topPaper.citationCount ?? 0} citations).` +
    (fields ? ` Research spans: ${fields}.` : "") +
    snippet
  );
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

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
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

    const { query } = await req.json();
    if (!query || typeof query !== "string" || query.trim() === "") {
      return jsonResponse(
        { error: { code: "INVALID_REQUEST", message: "Query is required and must be a non-empty string" } },
        400,
        corsHeaders,
      );
    }
    if (query.length > 2000) {
      return jsonResponse(
        { error: { code: "INVALID_REQUEST", message: "Query exceeds maximum allowed length" } },
        400,
        corsHeaders,
      );
    }

    const trimmedQuery = query.trim();
    const reasoningSteps: string[] = [];

    reasoningSteps.push(`Searching Semantic Scholar for papers on "${trimmedQuery}"`);
    const papers = await searchSemanticScholar(trimmedQuery);

    if (papers.length === 0) {
      reasoningSteps.push("No papers found — query may be too specific or a network error occurred");
    } else {
      const uniqueFields = [...new Set(papers.flatMap((p) => p.fieldsOfStudy ?? []))].length;
      reasoningSteps.push(`Found ${papers.length} papers across ${uniqueFields} research field(s)`);

      const topPaper = papers.reduce(
        (best, p) => ((p.citationCount ?? 0) > (best.citationCount ?? 0) ? p : best),
        papers[0],
      );
      reasoningSteps.push(
        `Most cited: "${topPaper.title}"${topPaper.year ? ` (${topPaper.year})` : ""} — ${topPaper.citationCount ?? 0} citations`,
      );

      const recentCount = papers.filter((p) => p.year && p.year >= 2020).length;
      if (recentCount > 0) {
        reasoningSteps.push(`${recentCount} paper(s) published since 2020 — field is actively researched`);
      }
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    let aiResult: AISynthesisResult | null = null;

    if (papers.length > 0 && openaiKey) {
      reasoningSteps.push("Synthesising research landscape with OpenAI");
      aiResult = await synthesiseWithOpenAI(trimmedQuery, papers, openaiKey);
    }

    if (aiResult) {
      reasoningSteps.push("AI synthesis complete — summary and keywords generated from paper abstracts");
    } else if (papers.length > 0 && openaiKey) {
      reasoningSteps.push("AI synthesis unavailable — using metadata-based synthesis");
    }

    const summary = aiResult ? aiResult.summary : buildFallbackSummary(trimmedQuery, papers);
    const suggestedKeywords = aiResult ? aiResult.keywords : extractKeywords(trimmedQuery, papers);

    if (!aiResult && papers.length > 0) {
      reasoningSteps.push("Extracted keywords from paper titles, fields of study, and query terms");
    }

    const result: DeepResearchResult = {
      query: trimmedQuery,
      reasoningSteps,
      summary,
      suggestedKeywords,
      timestamp: new Date().toISOString(),
      papers: papers.slice(0, 5).map((p) => ({
        title: p.title,
        year: p.year,
        citationCount: p.citationCount,
        authors: p.authors?.slice(0, 3).map((a) => a.name) ?? [],
        abstract: p.abstract ? p.abstract.slice(0, 400) : null,
      })),
    };

    return jsonResponse({ data: result }, 200, corsHeaders);
  } catch (_error) {
    console.error("[RQ] deep-research unexpected error:", _error);
    return jsonResponse(
      { error: { code: "FUNCTION_ERROR", message: "An unexpected error occurred during deep research processing." } },
      500,
      corsHeaders,
    );
  }
});
/**
 * Production fetch-paper: resolves a DOI via the Crossref public API and returns
 * title, authors, abstract, publication year, container (journal), DOI, and URLs.
 * Non-DOI identifiers are not implemented; extend before calling this production-ready for broader search.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APP_USER_AGENT = "ResearchQuest/1.0 (mailto:research@researchquest.app)";
const DEFAULT_TIMEOUT_MS = 8000;

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

function formatCrossrefWork(work: any) {
  return {
    doi: work?.DOI || "",
    title: work?.title?.[0] || "Untitled",
    authors:
      work?.author?.map((author: any) =>
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

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };

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
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
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

    const { doi, query, rows, sort, order } = await req.json();

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

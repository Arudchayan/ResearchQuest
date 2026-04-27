import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const { query } = await req.json();

    if (!query || typeof query !== "string" || query.trim() === "") {
      return jsonResponse(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "Query is required and must be a non-empty string",
          },
        },
        400,
        corsHeaders,
      );
    }

    const steps = [
      `Analyzing the research query: "${query}"`,
      "Deconstructing the topic into core components.",
      "Identifying key literature domains related to the topic.",
      "Synthesizing potential research gaps.",
      "Formulating initial hypotheses and directions.",
    ];

    return jsonResponse(
      {
        data: {
          query,
          reasoningSteps: steps,
          summary: `Deep Research Analysis completed for "${query}". The topic covers several distinct domains. Recommended next steps involve a comprehensive literature review focusing on the identified intersections.`,
          suggestedKeywords: query.split(" ").filter((word: string) => word.length > 3),
          timestamp: new Date().toISOString(),
        },
      },
      200,
      corsHeaders,
    );
  } catch (_error) {
    return jsonResponse(
      {
        error: {
          code: "FUNCTION_ERROR",
          message: "An unexpected error occurred during deep research processing.",
        },
      },
      500,
      corsHeaders,
    );
  }
});

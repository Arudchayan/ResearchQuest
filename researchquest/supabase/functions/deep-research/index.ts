import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    // 🛡️ Sentinel: Add Authentication Check
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Missing Authorization header' } }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser()

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const { query, mode } = body

    if (!query || typeof query !== 'string' || query.trim() === '') {
       return new Response(
        JSON.stringify({ error: { code: 'INVALID_REQUEST', message: 'Query is required and must be a non-empty string' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // AI Reasoning engine simulation
    // This mocks a reasoning process.
    const steps = [
      `Analyzing the research query: "${query}"`,
      `Deconstructing the topic into core components.`,
      `Identifying key literature domains related to the topic.`,
      `Synthesizing potential research gaps.`,
      `Formulating initial hypotheses and directions.`
    ];

    const result = {
      query,
      reasoningSteps: steps,
      summary: `Deep Research Analysis completed for "${query}". The topic covers several distinct domains. Recommended next steps involve a comprehensive literature review focusing on the identified intersections.`,
      suggestedKeywords: query.split(' ').filter(w => w.length > 3),
      timestamp: new Date().toISOString()
    }

    return new Response(
      JSON.stringify({ data: result }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    // Fail securely without exposing stack trace or internal details
    return new Response(
      JSON.stringify({
        error: {
          code: 'FUNCTION_ERROR',
          message: 'An unexpected error occurred during deep research processing.',
        },
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
const APP_USER_AGENT = 'ResearchQuest/1.0 (mailto:research@researchquest.app)'

function reconstructOpenAlexAbstract(index: Record<string, number[]>) {
  const positions = Object.values(index).flat()
  if (positions.length === 0) return ''
  const maxIndex = Math.max(...positions)
  const words: string[] = new Array(maxIndex + 1)
  for (const [word, indexes] of Object.entries(index)) {
    for (const pos of indexes) {
      words[pos] = word
    }
  }
  return words.filter(Boolean).join(' ')
}

function formatCrossrefWork(work: any) {
  return {
    doi: work?.DOI || '',
    title: work?.title?.[0] || 'Untitled',
    authors:
      work?.author?.map((a: any) => `${a?.given || ''} ${a?.family || ''}`.trim()).filter(Boolean) || [],
    abstract: work?.abstract || '',
    publicationDate: work?.published?.['date-parts']?.[0]?.[0] || null,
    sourceUrl: work?.DOI ? `https://doi.org/${work.DOI}` : '',
    containerTitle: work?.['container-title']?.[0] || '',
    publisher: work?.publisher || '',
    type: work?.type || 'article',
  }
}

function formatOpenAlexWork(work: any) {
  const doi = work?.doi ? work.doi.replace('https://doi.org/', '') : ''
  const abstract = work?.abstract
    ? work.abstract
    : work?.abstract_inverted_index
    ? reconstructOpenAlexAbstract(work.abstract_inverted_index)
    : ''

  return {
    doi,
    title: work?.display_name || 'Untitled',
    authors: Array.isArray(work?.authorships)
      ? work.authorships
          .map((auth: any) => auth?.author?.display_name)
          .filter((name: string | undefined): name is string => Boolean(name))
      : [],
    abstract,
    publicationDate: work?.publication_year || null,
    sourceUrl: work?.doi || work?.id || '',
    containerTitle: work?.host_venue?.display_name || '',
    publisher: work?.primary_location?.source?.display_name || '',
    type: work?.type || 'article',
  }
}

async function safeParseJson(response: Response) {
  try {
    return await response.json()
  } catch (_err) {
    return null
  }
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

async function fetchCrossrefByDoi(doi: string) {
  const url = `https://api.crossref.org/works/${encodeURIComponent(doi)}?mailto=research@researchquest.app`
  const response = await fetchWithTimeout(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': APP_USER_AGENT,
    },
  })

  if (!response.ok) {
    const body = await safeParseJson(response)
    return { ok: false as const, status: response.status, body }
  }

  const data = await response.json()
  return { ok: true as const, work: formatCrossrefWork(data?.message) }
}

async function fetchCrossrefByQuery(query: string) {
  const url = `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(query)}&rows=10&mailto=research@researchquest.app`
  const response = await fetchWithTimeout(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': APP_USER_AGENT,
    },
  })

  if (!response.ok) {
    const body = await safeParseJson(response)
    return { ok: false as const, status: response.status, body }
  }

  const data = await response.json()
  const items = Array.isArray(data?.message?.items) ? data.message.items.map(formatCrossrefWork) : []
  return { ok: true as const, items }
}

async function fetchOpenAlexByDoi(doi: string) {
  const url = `https://api.openalex.org/works/https://doi.org/${encodeURIComponent(doi)}`
  const response = await fetchWithTimeout(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': APP_USER_AGENT,
    },
  })

  if (!response.ok) {
    return null
  }

  const data = await response.json()
  return formatOpenAlexWork(data)
}

async function fetchOpenAlexByQuery(query: string) {
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=10`
  const response = await fetchWithTimeout(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': APP_USER_AGENT,
    },
  })

  if (!response.ok) {
    return []
  }

  const data = await response.json()
  return Array.isArray(data?.results) ? data.results.map(formatOpenAlexWork) : []
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 200 })
  }

  try {
    const { doi, query } = await req.json()

    if (!doi && !query) {
      return new Response(
        JSON.stringify({ error: { code: 'MISSING_PARAMS', message: 'Either doi or query is required' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (doi) {
      const cleanedDoi = doi.replace(/^https?:\/\/doi\.org\//, '')
      const crossrefResult = await fetchCrossrefByDoi(cleanedDoi)

      if (crossrefResult.ok) {
        return new Response(
          JSON.stringify({ data: crossrefResult.work }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const openAlexResult = await fetchOpenAlexByDoi(cleanedDoi)
      if (openAlexResult) {
        return new Response(
          JSON.stringify({ data: openAlexResult }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const message =
        crossrefResult.body?.message ||
        crossrefResult.body?.status ||
        crossrefResult.body?.error ||
        (crossrefResult.status === 403
          ? 'Crossref rejected the request (possible rate limit or missing credentials)'
          : 'Unable to fetch paper metadata')

      const status = crossrefResult.status === 404 ? 404 : crossrefResult.status || 502

      return new Response(
        JSON.stringify({ error: { code: 'NOT_FOUND', message } }),
        { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const [crossrefResult, openAlexResults] = await Promise.all([
      fetchCrossrefByQuery(query),
      fetchOpenAlexByQuery(query),
    ])

    const merged = new Map<string, ReturnType<typeof formatCrossrefWork>>()

    if (crossrefResult.ok) {
      for (const item of crossrefResult.items) {
        const key = item.doi || item.title
        if (!merged.has(key)) merged.set(key, item)
      }
    }

    for (const item of openAlexResults) {
      const key = item.doi || item.title
      if (!merged.has(key)) merged.set(key, item)
    }

    if (merged.size === 0) {
      const message = crossrefResult.ok
        ? 'No papers found for that query'
        : crossrefResult.body?.message ||
          crossrefResult.body?.status ||
          crossrefResult.body?.error ||
          'Failed to search for papers'

      const status = crossrefResult.ok ? 404 : crossrefResult.status || 502

      return new Response(
        JSON.stringify({ error: { code: 'NOT_FOUND', message } }),
        { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ data: Array.from(merged.values()) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Fetch paper error:', error);
    return new Response(
      JSON.stringify({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An internal server error occurred while fetching the paper.',
        },
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

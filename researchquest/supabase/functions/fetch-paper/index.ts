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
    const { doi, query } = await req.json()

    // Handle DOI search
    if (doi) {
      const crossrefUrl = `https://api.crossref.org/works/${encodeURIComponent(doi)}`
      const response = await fetch(crossrefUrl)
      
      if (!response.ok) {
        return new Response(
          JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Paper not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const data = await response.json()
      const work = data.message

      const paper = {
        doi: work.DOI,
        title: work.title?.[0] || 'Untitled',
        authors: work.author?.map((a: any) => `${a.given || ''} ${a.family || ''}`.trim()) || [],
        abstract: work.abstract || '',
        publicationDate: work.published?.['date-parts']?.[0]?.[0] || null,
        sourceUrl: work.URL || `https://doi.org/${work.DOI}`,
        containerTitle: work['container-title']?.[0] || '',
        publisher: work.publisher || '',
        type: work.type || 'article',
      }

      return new Response(
        JSON.stringify({ data: paper }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Handle query search
    if (query) {
      const crossrefUrl = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=10`
      const response = await fetch(crossrefUrl)
      
      if (!response.ok) {
        return new Response(
          JSON.stringify({ error: { code: 'SEARCH_FAILED', message: 'Search failed' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const data = await response.json()
      const papers = data.message.items.map((work: any) => ({
        doi: work.DOI,
        title: work.title?.[0] || 'Untitled',
        authors: work.author?.map((a: any) => `${a.given || ''} ${a.family || ''}`.trim()) || [],
        abstract: work.abstract || '',
        publicationDate: work.published?.['date-parts']?.[0]?.[0] || null,
        sourceUrl: work.URL || (work.DOI ? `https://doi.org/${work.DOI}` : ''),
        containerTitle: work['container-title']?.[0] || '',
        publisher: work.publisher || '',
        type: work.type || 'article',
      }))

      return new Response(
        JSON.stringify({ data: papers }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: { code: 'INVALID_REQUEST', message: 'Must provide doi or query' } }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({
        error: {
          code: 'FUNCTION_ERROR',
          message: error.message,
        },
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

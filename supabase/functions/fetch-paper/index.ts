Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  try {
    const { doi, query } = await req.json();

    if (!doi && !query) {
      return new Response(
        JSON.stringify({ error: { code: 'MISSING_PARAMS', message: 'Either doi or query is required' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let crossrefUrl: string;
    
    if (doi) {
      // Fetch specific DOI
      const cleanDoi = doi.replace(/^https?:\/\/doi\.org\//, '');
      crossrefUrl = `https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}?mailto=research@researchquest.app`;
    } else {
      // Search by query
      crossrefUrl = `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(query)}&rows=10&mailto=research@researchquest.app`;
    }

    const crossrefResponse = await fetch(crossrefUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!crossrefResponse.ok) {
      if (crossrefResponse.status === 404) {
        return new Response(
          JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Paper not found in Crossref database' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: { code: 'CROSSREF_ERROR', message: 'Failed to fetch from Crossref API' } }),
        { status: crossrefResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await crossrefResponse.json();

    // Format the response
    if (doi) {
      // Single paper response
      const work = data.message;
      const formatted = {
        doi: work.DOI,
        title: work.title?.[0] || 'Untitled',
        authors: work.author?.map((a: any) => `${a.given || ''} ${a.family || ''}`.trim()) || [],
        abstract: work.abstract || '',
        publicationDate: work.published?.['date-parts']?.[0]?.[0] || null,
        sourceUrl: `https://doi.org/${work.DOI}`,
        containerTitle: work['container-title']?.[0] || '',
        publisher: work.publisher || '',
        type: work.type || 'article',
      };

      return new Response(
        JSON.stringify({ data: formatted }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Multiple results from search
      const results = data.message.items.map((work: any) => ({
        doi: work.DOI,
        title: work.title?.[0] || 'Untitled',
        authors: work.author?.map((a: any) => `${a.given || ''} ${a.family || ''}`.trim()).slice(0, 3) || [],
        abstract: work.abstract || '',
        publicationDate: work.published?.['date-parts']?.[0]?.[0] || null,
        sourceUrl: `https://doi.org/${work.DOI}`,
        containerTitle: work['container-title']?.[0] || '',
        publisher: work.publisher || '',
        type: work.type || 'article',
      }));

      return new Response(
        JSON.stringify({ data: results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: error instanceof Error ? error.message : 'An unknown error occurred' 
        } 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

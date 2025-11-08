# Crossref REST API for DOI-based Scholarly Search: Endpoints, Authentication, Parameters, Rate Limits, Responses, and Web Integration Best Practices

## Executive Summary and Objectives

The Crossref REST API provides public access to metadata deposited by Crossref members, enabling developers to search, filter, and retrieve scholarly works at scale. The API underpins DOI-based workflows, from singleton DOI lookups to large-scale harvesting and analytics. This report explains the endpoints that matter for DOI search, how to authenticate and identify your application, the parameters that drive precise retrieval, the rate limits that shape reliable integrations, the JSON response structure, and the implementation patterns that perform well in production web applications. The guidance synthesizes official documentation and community tips, with specific attention to responsible usage and scheduled rate limit changes effective December 1, 2025.[^1][^2]

Key findings:
- The API is open and widely used. No sign-up is required for basic access; public and “polite” pools are differentiated by identification (via email and User-Agent). A premium “Plus” service offers higher limits and monthly snapshots. Metadata typically appears within ~20 minutes of deposit, and daily counts and facets are calculated once per day.[^1][^3][^4]
- For DOI-centric use cases, the most important endpoints are: singleton retrieval (works/{doi}), agency checks (works/{doi}/agency), filtered searches (works with doi: filters), and scoping by container (journals/{issn}/works), prefix (prefixes/{prefix}/works), member (members/{id}/works), and funder (funders/{id}/works). Content negotiation can be used to request specific formats for a single DOI.[^3][^6]
- Precise search hinges on the filter and field-query parameters, with cursor-based pagination for large result sets. The select parameter can minimize payload size, but it is most efficient only for very small field sets.[^2][^8]
- Rate limits are being revised on December 1, 2025. The announcement specifies per-second rates and concurrency by pool (public vs polite) and by operation (single vs list). Metadata Plus is not affected by these changes. Clients should monitor rate-limit headers, implement backoff, and cache results.[^4][^3]
- Reliable web applications combine pagination, caching, backoff, user identification, and, where appropriate, local datasets (public data file, Plus snapshots) for high-volume or low-latency needs.[^2][^3]

Deliverable: a practical implementation blueprint to build DOI search features and maintain robust, responsible integrations with the Crossref REST API.[^1][^2]

---

## API Surface: Endpoints and URL Structure

The Crossref REST API base is the anchor for all resource-oriented requests. While a versioned path has been used historically, modern usage centers on the canonical base. The published documentation and Swagger reference should be consulted for the most current routing details and features.[^3][^1]

At a high level, Crossref exposes resources for works, journals, members, prefixes, types, funders, and licenses, with list and singleton operations, filtering and faceting, and specialized routes like agency checks for DOIs.[^3] A practical way to approach the API is to think in terms of singletons (a specific identifier) versus lists (collections you filter and page through). Crossref also supports content negotiation for single-record retrieval, allowing clients to request alternate formats when that is advantageous.[^6]

To orient implementation teams, Table 1 summarizes the endpoints most relevant to DOI-based search and discovery.

Table 1. Endpoint overview for DOI-centric workflows (paths, methods, purpose, DOI relevance)

| Method | Path                       | Purpose                                             | DOI Relevance                                |
|--------|----------------------------|-----------------------------------------------------|----------------------------------------------|
| GET    | /works/{doi}               | Retrieve metadata for a specific DOI                | High: direct singleton DOI lookup            |
| GET    | /works/{doi}/agency        | Return the DOI’s registration agency                | High: agency attribution for a DOI           |
| GET    | /works                     | List works with query and filters (includes doi:)   | High: DOI-scoped and DOI-targeted search     |
| GET    | /journals/{issn}/works     | List works for a journal (ISSN)                     | Medium: narrowing by container                |
| GET    | /prefixes/{prefix}/works   | List works under a DOI prefix                        | Medium: scoping by publisher prefix          |
| GET    | /members/{id}/works        | List works deposited by a member                     | Medium: scoping by member                    |
| GET    | /funders/{id}/works        | List works funded by a specific funder               | Medium: funding-based discovery              |
| GET    | /types, /types/{id}, /types/{id}/works | Work types enumeration and retrieval      | Low: useful for filtering and validation     |
| GET    | /licenses                  | License enumeration                                  | Low: useful for analytics/faceting           |
| GET    | /journals, /journals/{issn}| Journal enumeration and singleton                    | Low: journal-level context                   |
| GET    | /members, /members/{id}    | Member enumeration and singleton                     | Low: organizational context                  |
| GET    | /funders, /funders/{id}    | Funder enumeration and singleton                     | Low: funder context                          |
| GET    | /deposits                  | Deposit-related data (some endpoints deprecated)     | Low: legacy/deprecation context              |

Notes: The deposits route is noted as scheduled for deprecation in some references; consult Swagger for the latest status.[^3]

### Works Endpoint for DOI Retrieval

For DOI-centric retrieval, the works resource is the workhorse. The /works/{doi} route returns a single record for a given DOI, while /works supports rich filtering and query parameters, including the doi: filter for DOI-targeted searches and field queries such as query.bibliographic when matching against composite reference strings.[^3][^2] The works endpoint also offers facets and sorts, cursor-based pagination, and select to constrain returned fields.[^3][^2]

### Journal, Prefix, Member, and Funder Scoping

Filtering by container, prefix, member, or funder can dramatically narrow result sets. Use journals/{issn}/works to scope to a specific journal, prefixes/{prefix}/works for a publisher’s DOI prefix, members/{id}/works for a Crossref member, and funders/{id}/works for a funder registry identifier. These routes share the same filtering and pagination patterns as /works.[^3]

### Agency Check for DOI

The works/{doi}/agency route returns the DOI’s registration agency. This is useful when building DOI resolution logic or classifying data sources in your application.[^3]

---

## Authentication, Identification, and Access Pools

Crossref’s REST API is publicly accessible. No sign-up is required. Two behavioral pools—public and polite—reflect how your application identifies itself. A premium “Plus” service adds higher limits, support, and snapshots.[^1][^3][^2]

The practical distinction is straightforward: anonymous access places you in the public pool, while including a contact email (via a mailto parameter) and a descriptive User-Agent moves you into the polite pool. For production systems with sustained demand, the Crossref Metadata Plus service offers higher rate limits, priority support, and access to monthly snapshots that make it feasible to maintain a local, queryable copy of the registry.[^3][^1]

Table 2. Access pools and identification

| Pool/Service        | Authentication/Identification                        | Intended Audience                 | Benefits/Guidance                                 |
|---------------------|-------------------------------------------------------|-----------------------------------|---------------------------------------------------|
| Public              | None required (anonymous)                             | Prototyping, low-volume use       | Expect tighter limits; cache aggressively         |
| Polite              | Include mailto (query parameter) and User-Agent       | Most production apps              | Improved limits; identification for support       |
| Plus (premium)      | API key/token in request header                       | Production with higher throughput | Higher rate limits, support, monthly snapshots    |

Clients should set a descriptive User-Agent and include a valid email address to facilitate troubleshooting and responsible usage.[^2][^3]

### Responsible Identification

Even when not required, identifying your application is a best practice. Include a mailto parameter with a valid email and a descriptive User-Agent. Anonymous access is allowed, but logs capture IPs and queries, so polite identification improves the ecosystem’s ability to address issues and maintain service quality.[^2]

### Plus Service Integration

Plus subscribers include an API key/token in the request header and gain higher rate limits and operational support. Plus also provides access to monthly snapshots, which are invaluable for high-volume synchronization and analytics workloads that would otherwise strain the REST API.[^3][^1]

---

## Search Parameters and Query Design

The Crossref API provides three categories of controls that are often used together: field queries, filters, and result controls. The design goal is precision (retrieve what you need) and efficiency (avoid over-fetching).

Field queries improve recall and precision for specific metadata fields. For example, query.bibliographic searches composite citation-like strings, and query.author searches contributor names. Filters express precise constraints such as publication date windows, type, funder membership, and DOI membership. Result controls determine the size and shape of the response, including rows, offset, cursor, select, sort, order, sample, and facet.[^2][^3][^8]

Table 3. Core search parameters and how to use them

| Parameter              | Purpose                                              | Example Values                 | Notes                                                                 |
|------------------------|------------------------------------------------------|--------------------------------|-----------------------------------------------------------------------|
| query                  | General full-text query                              | "CRISPR"                       | Broad search across multiple fields                                   |
| query.bibliographic    | Composite reference-like query                       | "Carberry 2008 psychoceramics" | Often the best starting point for reference matching                  |
| query.author           | Contributor name search                              | "Carberry"                     | Searches given and family name fields                                 |
| query.container-title  | Journal or proceedings title                         | "Nature"                       | Useful for scoping by publication                                     |
| filter                 | Constrain by field values                            | type:journal-article           | Multiple filters AND together; same filter can be repeated for OR     |
| rows                   | Items per page                                       | 0, 10, 100, 1000               | 0 returns only summary; max 1000                                      |
| select                 | Restrict returned fields                             | DOI,title,author               | Efficient for 1–3 fields; otherwise fetch full record locally         |
| sort, order            | Sorting controls                                     | sort:score,order:desc          | Sort fields include score, updated, published, counts, etc.           |
| sample                 | Random sample                                        | sample:100                     | Max 100; ignores rows/offset                                          |
| facet                  | Request facet counts                                 | type-name:*                    | Returns approximate counts; daily-updated                             |
| cursor, offset         | Pagination                                           | cursor:* then next-cursor      | Cursors for deep paging; cursors expire if unused                     |

When using the filter parameter, combine multiple criteria to narrow to the intended set. Table 4 lists commonly used filters for DOI search and analytics.

Table 4. Frequently used filters for DOI workflows

| Filter Name                  | Meaning/Use Case                                  | Example Value                 |
|-----------------------------|---------------------------------------------------|-------------------------------|
| doi                         | Match works with given DOI(s)                     | 10.1038/nphys1170             |
| type                        | Constrain to work type                            | journal-article               |
| member                      | Constrain to a Crossref member                    | 120                           |
| prefix                      | Constrain to DOI prefix                           | 10.1038                       |
| from-pub-date / until-pub-date | Publication date window                         | 2024-01-01 / 2024-12-31       |
| has-references              | Works with references                             | true                          |
| has-orcid                   | Works with ORCID identifiers                      | true                          |
| orcid                       | Works by a specific ORCID                         | 0000-0002-1825-0097           |
| issn / isbn                 | Serial/print identifiers                          | 0028-0836 / 978-0-262-53176-8 |
| funder                      | Works funded by a funder                          | 10.13039/100000040            |
| from-created-date / until-created-date | Ingestion window                         | 2025-01-01 / 2025-06-30       |
| from-indexed-date / until-indexed-date | Indexing window (includes reindexing) | 2025-01-01 / 2025-06-30       |
| has-license                 | Works with license information                    | true                          |
| license.url                 | Works with specific license URL                   | https://creativecommons.org/licenses/by/4.0/ |
| reference-visibility        | Reference visibility policy                        | open, limited, closed         |

Field queries are especially useful for bibliographic search. Table 5 highlights the most relevant ones.

Table 5. Field queries (works route)

| Field Query             | Scope                               |
|-------------------------|--------------------------------------|
| query.bibliographic     | Titles, authors, ISSNs, year, etc.   |
| query.author            | Contributor given and family names   |
| query.container-title   | Journal or proceedings title         |
| query.contributor       | Author/editor/chair/translator names |
| query.affiliation       | Contributor affiliations             |

Precision strategies:
- Combine filters (e.g., type + from-pub-date + prefix) to reduce the candidate set before applying free-text query terms.
- Use select only when you need one to three fields. Fetch the full record and discard unneeded fields locally when selecting four or more, as this is more efficient on the network.[^2]
- For matching lists of references, prefer query.bibliographic; request rows=2 for simple best-match checks or rows=5 for ranking when you need more candidates.[^2][^9]

### Date and Timestamp Filters

Crossref supports multiple date filters that map to different lifecycle events. Choose the one that aligns with your synchronization strategy: created (new records), updated (new and changed records), indexed (new, changed, and reindexed records), and published (issued dates). Date filters accept day-level precision; use inclusive ranges and avoid overlaps across runs.[^2]

Table 6. Date filter semantics for sync strategies

| Filter                       | Semantics                                  | Typical Use Case                        | Precision           |
|-----------------------------|--------------------------------------------|------------------------------------------|---------------------|
| from-created-date / until-created-date | New records only                     | Initial backfill of new content           | Day or coarser      |
| from-update-date / until-update-date   | New + changed records                 | Refresh changed metadata                  | Day or coarser      |
| from-indexed-date / until-indexed-date | New + changed + reindexed            | Comprehensive catch-up                    | Day or coarser      |
| from-pub-date / until-pub-date         | Publication date window               | Time-bounded analytics                    | Day or coarser      |
| from-online-pub-date / until-online-pub-date | Online publication window      | Online-first analytics                    | Day or coarser      |
| from-print-pub-date / until-print-pub-date | Print publication window        | Print-specific analytics                  | Day or coarser      |

Timestamps are inclusive. When分段 (segmenting) by time, ensure windows abut rather than overlap to avoid duplication or omission.[^2]

---

## Rate Limits and Concurrency (Current and Dec 2025 Changes)

The REST API currently receives around one billion hits per month. To maintain stability as request volumes have grown—tripling over the last five years—Crossref is revising rate limits for public and polite pools effective December 1, 2025. The changes are operation-specific (single-record lookups versus list searches) and include both per-second rate limits and concurrency caps. The Metadata Plus service, XML API, and OAI-PMH endpoint are unaffected by these changes.[^4][^3]

Table 7 summarizes the scheduled changes.

Table 7. Scheduled rate-limit changes effective December 1, 2025

| Pool    | Operation             | Requests/sec | Concurrency | Notes                                        |
|---------|------------------------|--------------|-------------|----------------------------------------------|
| Public  | Single-record (e.g., DOI lookup) | 5            | 1           | Per-IP; tighter caps to smooth spikes        |
| Public  | List/filtered searches | 1            | 1           | Encourage batching, caching                   |
| Polite  | Single-record          | 10           | 3           | Requires mailto and descriptive User-Agent    |
| Polite  | List/filtered searches | 3            | 3           | Same identification as above                  |

Before the change, guidance indicated a 50 requests/second ceiling for public/polite pools, with responses including x-rate-limit-limit and x-rate-limit-interval headers to monitor your effective quota. Concurrency in public/polite was commonly constrained to around five concurrent requests. Clients should migrate to the new per-operation limits shown above and continue to monitor the headers for current constraints. Exceeding limits yields HTTP 429, and clients should pause before retrying.[^2][^3][^4]

Information gap: The exact definition of “single” versus “list” operations at the routing level can vary. Treat singleton routes (e.g., works/{doi}) as single-record operations and routes that return lists (e.g., works with query/filters) as list operations. Confirm the classification for ambiguous routes against the live Swagger and announcements before production rollout.[^3][^4]

### Current vs New Limits: What Changes

- Per-operation caps replace generic per-second caps for public and polite pools. This aligns limits with operation cost and encourages responsible usage patterns (caching, batching).[^4]
- Plus subscribers are unaffected and continue to operate under their contracted service levels.[^4]
- Clients should expect to reduce concurrency and spread traffic over time to remain within the new caps. Identification (polite pool) remains a practical way to gain modestly higher limits.[^4][^2]

---

## Response Formats and Data Structures

The Crossref REST API returns JSON. The message media type is documented, and responses for list queries contain a summary section and an items array; singleton requests return a single work message. HTTP HEAD requests are supported for fast existence checks (200 exists; 404 not found). For single-record retrieval, content negotiation can be used to request alternate representations where appropriate.[^3][^6]

Table 8. Common response elements

| Field                     | Meaning                                                   | Example                                   |
|--------------------------|-----------------------------------------------------------|-------------------------------------------|
| status                   | HTTP status                                              | ok                                        |
| message-type             | Always present in JSON message envelope                   | work-message, works-message               |
| message                  | Payload: summary + items (list) or single work (singleton)| Summary with total-results; items array   |
| message.items            | Array of work records                                    | [ { DOI: "10.xxxx/...", title: "..." } ]  |
| message.total-results    | Count of matches (approximate for faceted lists)          | 15423                                     |
| message.facets           | Facet counts (approximate; daily-updated)                | { "type-name": { "journal-article": … } } |
| message.next-cursor      | Cursor for next page in deep paging                       | "Cmab…"                                   |
| message.query            | Normalized query parameters                              | { "query": "CRISPR", " "rows": 20 }       |

Table 9. Top-level work record fields to extract for DOI search UIs

| Field                    | Description                                    |
|-------------------------|------------------------------------------------|
| DOI                     | The definitive identifier                      |
| title                   | Work title                                     |
| author                  | Contributors (name, affiliation, ORCID)        |
| issued/published        | Publication date(s)                            |
| container-title         | Journal or proceedings title                   |
| type                    | Work type (e.g., journal-article)              |
| link                    | Landing-page link(s)                           |
| license                 | License URL(s) and version                     |
| funder                  | Funding metadata                               |
| reference               | Cited references                               |
| update-to / update-policy| Crossmark updates and policy                   |
| orcid                   | ORCID identifiers (if present)                 |
| is-referenced-by-count  | Citation count (daily-updated)                 |
| prefix                  | DOI prefix for the work                        |

Facets: Facets provide approximate counts (for example, type-name or publisher-name), suitable for analytics and filters, but not for exact counts. They are updated on a daily cadence. Use select to minimize payload only when you need a small number of fields; otherwise, fetch the full record once and filter locally.[^2][^3]

Abstracts: While most metadata is freely reusable, abstracts may be subject to copyright. Handle and display abstracts according to publisher terms and applicable law.[^1][^7]

---

## DOI-centric Search and Match Patterns

The most precise way to retrieve a single record is a singleton DOI lookup at /works/{doi}. For agency checks, use /works/{doi}/agency. For matching unstructured references, start with query.bibliographic on /works; it often outperforms ad hoc parsing plus multiple field filters.[^3][^2][^9]

Precision tips:
- Limit returned fields with select=DOI for high-throughput DOI harvesting. When you need to verify the match, include title, container-title, and author fields to present meaningful context to users. For automated matching, start with rows=2; for ranking, rows=5 provides enough candidates without excessive noise.[^9][^2]
- For DOI-targeted list queries (e.g., “give me all records whose DOI starts with 10.1038/nphys”), combine prefix and date filters, then page with cursor for large sets.[^3][^2]
- Handle DOI variations and encoding carefully; always URL-encode the DOI and related parameter values.[^8]

Table 10. Reference matching strategies

| Strategy                         | When to Use                                  | rows Setting | Pros                                        | Cons                                  |
|----------------------------------|----------------------------------------------|-------------|---------------------------------------------|---------------------------------------|
| query.bibliographic (exact)      | Single, well-formed reference                 | 2           | Fast, simple, often most relevant            | May need manual tie-breakers          |
| query.bibliographic (ranking)    | Ambiguous or noisy references                 | 5           | Better coverage, rank candidates             | More client-side work                 |
| Composite field filters          | When you have parsed components               | 10–50       | Tunable precision                            | Fragile; missing fields hurt recall   |
| DOI filter (prefix + date)       | DOI-prefixed harvesting                       | 100–1000    | Scales via cursor; deterministic scoping     | Requires prefix knowledge             |

---

## Best Practices for Web Application Integration

Robust integrations are built on a handful of disciplined practices: careful pagination, caching, rate-limit awareness, error handling, and user identification. Crossref’s own guidance emphasizes these patterns to ensure equitable access and reliable service.

- Pagination: Use rows up to 1000 for paging. For large result sets, use cursor-based pagination; stop when a page returns fewer than the requested rows. Cursors expire if unused, so advance promptly and avoid long pauses between pages.[^2][^3]
- Caching: Cache responses and adopt ETags/If-None-Match when available. Caching reduces repeated calls for infrequently changing metadata and keeps you within rate limits.[^2]
- Error handling: Monitor HTTP status codes. Use exponential backoff on 429 and other throttling signals. When response times increase, slow down proactively to protect the shared service.[^2]
- User identification: Include a descriptive User-Agent and mailto parameter. Polite pool identification helps Crossref support teams reach you in case of issues and is tied to higher limits under the new policy.[^2][^4]
- High-volume strategies: For syncing large datasets, segment time windows (e.g., by day) and use the created/updated/indexed filters appropriately. For analytics or intensive workloads, consider the annual public data file or monthly Plus snapshots to minimize REST API load while keeping local data fresh.[^2][^1]

Table 11. Pagination strategies: cursor vs offset

| Approach | Strengths                                     | Limitations                                  | When to Use                                 |
|----------|-----------------------------------------------|-----------------------------------------------|---------------------------------------------|
| cursor   | Scales to arbitrarily large result sets       | Cursors expire if unused                      | Large harvests and ongoing syncs            |
| offset   | Simple for small pages                        | Soft limits and inefficiency for deep paging  | Small pages (<10k) and admin tooling        |

### Caching and Local Data Strategies

For sustained high demand or strict SLAs, maintain a local mirror. Segment ingestion by created/updated/indexed dates, and use cursors to sweep windows systematically. This approach reduces REST API load, stabilizes performance, and enables fast local queries. Crossref’s public data file (annual) and Metadata Plus snapshots (monthly) are designed for this use case; consult the service descriptions for access and update cadence.[^2][^1]

---

## Tools, SDKs, and Community Resources

Several official and community libraries simplify integration. These clients encapsulate best practices, reduce boilerplate, and help manage pagination and error handling.

Table 12. SDKs and libraries by language

| Library/Client             | Language     | Maintainer/Source | Notes                       |
|----------------------------|--------------|-------------------|-----------------------------|
| crossref-commons           | Python       | Crossref          | Official client             |
| habanero                   | Python       | Community         | Popular wrapper             |
| crossrefapi                | Python       | Community         | Alternative client          |
| rcrossref                  | R            | rOpenSci          | Mature R client             |
| Serrano                    | Ruby         | Community         | Ruby client                 |
| crossref-rs                | Rust         | Community         | Rust client                 |
| pitaya                     | Julia        | Community         | Julia client                |
| crossrefapi                | Go           | Caltech Library   | Go client                   |
| TypeScript client          | TypeScript   | Community (NPM)   | TypeScript client           |

For learning and prototyping, the non-technical introduction and live API exploration pages are particularly useful, as is the status page during incident response.[^10][^3][^13]

---

## Compliance, Licensing, and Ethics

Most Crossref metadata is freely usable for any purpose without restriction. Abstracts may be subject to copyright, so treat them according to publisher terms and applicable law. When exposing data, respect publisher licenses and link to landing pages rather than hosting full texts.[^1][^7]

From a privacy perspective, the polite pool model encourages identification via mailto and User-Agent. Anonymous usage is permitted, but be aware that IP addresses and query details are part of operational logs used to maintain service quality.[^2]

Always provide a contact channel in your application’s User-Agent or documentation so that support teams can reach you if needed.

---

## Appendix: Implementation Checklist and Example Request Patterns

This checklist distills the practices above into implementation steps.

Table 13. Implementation checklist

| Task                                 | Done? | Reference |
|--------------------------------------|-------|-----------|
| Set descriptive User-Agent and mailto|       | [^2][^4]  |
| Choose access pool (public/polite/Plus) |    | [^1][^3]  |
| Implement singleton DOI lookup       |       | [^3]      |
| Implement DOI agency check           |       | [^3]      |
| Build filter-based list queries      |       | [^2][^3]  |
| Add cursor-based deep paging         |       | [^2][^3]  |
| Add select for small field sets      |       | [^2]      |
| Implement caching and ETag handling  |       | [^2]      |
| Implement backoff on 429 and spikes  |       | [^2][^4]  |
| Monitor rate-limit headers           |       | [^2][^3]  |
| Segment time windows for syncs       |       | [^2]      |
| Define Plus or snapshots if needed   |       | [^1][^3]  |
| Handle abstracts per copyright       |       | [^1][^7]  |
| Check status page during incidents   |       | [^13]     |

Example request patterns (pattern descriptions; omit full URLs):

- Singleton DOI retrieval:
  - GET /works/{doi}
  - Use to display detailed metadata for a known DOI.[^3]

- DOI-targeted search:
  - GET /works?filter=doi:{doi}&select=DOI,title
  - Useful when you need both retrieval and a small number of fields.[^2][^3]

- Bibliographic reference matching:
  - GET /works?query.bibliographic={reference_text}&rows=2&select=DOI,title,container-title,author
  - Start with rows=2 for simple matching or rows=5 for ranking.[^2][^9]

- Journal-scoped search by date:
  - GET /journals/{issn}/works?filter=from-pub-date:2024-01-01,until-pub-date:2024-12-31&rows=1000&cursor:*
  - Page with cursor for large sets; stop when fewer than rows returned.[^3][^2]

- Prefix-scoped harvesting:
  - GET /prefixes/{prefix}/works?filter=from-created-date:2025-01-01&rows=1000&cursor:*
  - Use prefix plus time window to bound the harvest.[^3][^2]

- Daily sync using “updated” window:
  - GET /works?filter=from-update-date:2025-05-01,until-update-date:2025-05-02&rows=1000&cursor:*
  - Sweep with overlapping-free windows to catch changes.[^2]

For live parameter discovery and schema checks, consult the Swagger UI and validate against the published schema before deploying changes.[^3][^12]

---

## References

[^1]: REST API – Crossref Documentation. https://www.crossref.org/documentation/retrieve-metadata/rest-api/
[^2]: Tips for using the Crossref REST API. https://www.crossref.org/documentation/retrieve-metadata/rest-api/tips-for-using-the-crossref-rest-api/
[^3]: Crossref REST API Swagger UI. https://api.crossref.org/swagger-ui
[^4]: Announcing changes to REST API rate limits. https://www.crossref.org/blog/announcing-changes-to-rest-api-rate-limits/
[^5]: A non-technical introduction to our API. https://www.crossref.org/documentation/retrieve-metadata/rest-api/a-non-technical-introduction-to-our-api/
[^6]: Content Negotiation – Crossref. https://www.crossref.org/documentation/retrieve-metadata/content-negotiation/
[^7]: REST API Metadata License Information. https://www.crossref.org/documentation/retrieve-metadata/rest-api/rest-api-metadata-license-information/
[^8]: CrossRef/rest-api-doc (GitHub) – Deprecated REST API docs. https://github.com/CrossRef/rest-api-doc
[^9]: Retrieve DOI from title and author (Community Thread). https://community.crossref.org/t/retrieve-doi-from-title-and-author/12533
[^10]: Crossref API Learning Hub. https://www.crossref.org/learning/
[^11]: Metadata Plus (Crossref). https://www.crossref.org/services/metadata-retrieval/metadata-plus/
[^12]: Swagger Validator for Crossref API schema. https://validator.swagger.io/validator/debug?url=https%3A%2F%2Fapi.crossref.org%2Fswagger-docs
[^13]: Crossref Status Page. https://status.crossref.org/
2024-05-19 — Better exported Note Titles
Opportunity: Identify that notes exported via the Data Management screen just used the fallback 'Untitled Note' if no explicit title was set, ignoring their actual markdown content.
Learning: Leveraging `deriveTitleFromMarkdown` consistently across the app (in `convertNotesToMarkdown`) instead of simple truthy fallbacks guarantees meaning is preserved.
Prevention: Apply existing title derivation logic anywhere note titles are presented or serialized.

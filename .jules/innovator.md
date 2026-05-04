2024-05-19 — Better exported Note Titles
Opportunity: Identify that notes exported via the Data Management screen just used the fallback 'Untitled Note' if no explicit title was set, ignoring their actual markdown content.
Learning: Leveraging `deriveTitleFromMarkdown` consistently across the app (in `convertNotesToMarkdown`) instead of simple truthy fallbacks guarantees meaning is preserved.
Prevention: Apply existing title derivation logic anywhere note titles are presented or serialized.

## 2026-04-30 - Detail View Export Parity
**Opportunity:** Discovered that Detail views (Topic, Idea, Paper) lack the export functionality present in List views.
**Learning:** Standardizing export functionality across list and detail views improves user experience by allowing users to export single items directly from their detail view, without navigating back to a list view and searching for it.
**Prevention:** Ensure new entity views maintain feature parity with existing views, particularly regarding standard actions like Export, Sort, and Search.

2024-05-20 — Duplicate Entities Feature
Opportunity: Users often need to copy notes, papers, or ideas for templating or fast data entry, but no such feature existed.
Learning: Leveraging existing create functions and simply appending '(Copy)' to titles is a lightweight and robust way to implement duplication without schema changes.
Prevention: When adding new UI actions (like duplicate buttons), remember to ensure they match the interactive styling (e.g. opacity transitions) of adjacent actions like delete buttons.
## 2026-05-04 - Adding active entities to Dashboard ensures feature parity\n**Learning:** When adding new top-level entities (like Ideas) to an application, ensure they are represented in central overview components (like the Dashboard) to maintain feature parity with existing entities (Notes, Papers, Tasks) and support user resumption workflows.\n**Action:** Update global Dashboard and overview components whenever introducing or elevating new core entities, making sure to include necessary state selectors (e.g. `ideasLoading`, `setSelectedIdea`) to support interactive drill-downs.

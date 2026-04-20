## 2026-04-11 - Implement Markdown Export for Papers

**Opportunity:** Users should be able to export papers as Markdown to embed within notes or external tools, just like they can with Ideas and Notes.
**Learning:** The export UI patterns and logic are localized in `PapersView.tsx` and `export.ts`. It's easy to add new export formats by extending the `convert[Entity]To[Format]` paradigm.
**Prevention:** Always check if a generic export feature is implemented uniformly across all entity types. If a new export type is needed, update the specific view components and utility scripts accordingly.

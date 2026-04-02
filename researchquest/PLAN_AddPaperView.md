# PLAN: Refactor AddPaperView.tsx

## Problem Analysis
`AddPaperView.tsx` has a complexity of 57 and 1229 lines. It likely contains:
- Search logic
- Form state management
- Multiple UI sub-sections (results list, upload area, manual entry)
- Metadata extraction logic

## Refactor Steps
1. **Extract Sub-Components**:
   - `PaperSearchForm.tsx`: Input and search button logic.
   - `PaperSearchResults.tsx`: List of search results and selection logic.
   - `PaperMetadataForm.tsx`: Manual entry/edit form for paper details.
   - `PaperFileUpload.tsx`: Drag-and-drop / upload logic.
2. **Extract Logic to Hooks**:
   - `usePaperSearch.ts`: Handle API calls and result state.
   - `usePaperMetadata.ts`: Handle extraction and validation logic.
3. **Simplify Main Component**:
   - `AddPaperView.tsx` should only orchestrate the sub-components using a simple state machine (e.g., `view: 'search' | 'upload' | 'edit'`).

## Atomic Commits
- `refactor: extract PaperSearchForm from AddPaperView`
- `refactor: extract PaperSearchResults from AddPaperView`
- `refactor: extract search logic to usePaperSearch hook`
...

# SPEC: De-Monolith & Complexity Reduction (ResearchQuest)

## Goal
Reduce cyclomatic complexity of top offenders to ≤ 10 and function length to ≤ 100 lines. 
Improve maintainability and testability by extracting atomic components and utility logic.

## Target Offenders (ResearchQuest)
1. `src/components/entities/AddPaperView.tsx` (Complexity: 57)
2. `src/components/editor/MarkdownEditor.tsx` (Complexity: 26)
3. `src/components/entities/IdeaDetailView.tsx` (Complexity: 23)
4. `src/components/layout/LeftSidebar.tsx` (Complexity: 20)
5. `src/hooks/useIdeas.ts` (Complexity: 34 in async methods)

## Success Metrics
- [ ] ESLint `complexity` error count: 0
- [ ] ESLint `max-lines-per-function` warning count: Reduced by 50%+
- [ ] Build Time: ≤ 120s
- [ ] INP: ≤ 150ms

## Constraints
- No breaking changes to existing functionality.
- Maintain existing styling and UX.
- Atomic commits for every logical extraction.

# Refactoring Plan: MarkdownEditor

## Phase 1: Setup
1.  Create `src/components/editor/sub-components/` directory.
2.  Create `src/components/editor/hooks/` directory.

## Phase 2: Extraction (Hooks)
1.  Extract core editor state into `useMarkdownEditor.ts`.
2.  Extract formatting logic into `useFormatting.ts`.
3.  Extract action logic (copy, export, print, save) into `useEditorActions.ts`.
4.  Extract link dialog logic into `useLinkDialog.ts`.

## Phase 3: Extraction (Sub-components)
1.  Extract Header into `EditorHeader.tsx`.
2.  Extract Toolbar into `EditorToolbar.tsx`.
3.  Extract Content/Split/Preview into `EditorContent.tsx`.
4.  Extract Footer into `EditorFooter.tsx`.
5.  Extract LinkDialog into `LinkDialog.tsx`.

## Phase 4: Integration
1.  Refactor `MarkdownEditor.tsx` to use the new hooks and sub-components.
2.  Ensure props are properly passed and typed.

## Phase 5: Verification
1.  Run `pnpm run lint`.
2.  Run `pnpm run build`.
3.  Check complexity (manually or with tools if available).

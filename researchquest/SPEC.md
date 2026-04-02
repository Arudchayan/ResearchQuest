# Specification: MarkdownEditor Refactoring

## Goal
Refactor `src/components/editor/MarkdownEditor.tsx` to reduce cyclomatic complexity from 26 to <= 10 and ensure max-lines-per-function <= 100.

## Requirements
1.  **Extract Sub-components**: Move UI logic into specialized sub-components in `src/components/editor/sub-components/`.
    *   `EditorHeader`: Title input and saving status.
    *   `EditorToolbar`: All formatting and action buttons.
    *   `EditorContent`: CodeMirror editor and Preview pane.
    *   `EditorFooter`: Word count and reading time.
    *   `LinkDialog`: Link insertion modal.
2.  **Extract Hooks**: Move state management and business logic into custom hooks.
    *   `useMarkdownEditor`: Core editor state (content, title, view mode, zen mode).
    *   `useFormatting`: Logic for applying markdown formatting.
    *   `useEditorActions`: Logic for copy, export, print, and save.
    *   `useLinkDialog`: Logic for managing the link dialog state.
3.  **Metrics**:
    *   Cyclomatic complexity per function: <= 10.
    *   Max lines per function: <= 100.
4.  **Verification**:
    *   `pnpm run lint` must pass.
    *   `pnpm run build` must pass.

## Architecture
```
MarkdownEditor (Container)
├── useMarkdownEditor (Hook)
├── useFormatting (Hook)
├── useEditorActions (Hook)
├── useLinkDialog (Hook)
├── EditorHeader (Sub-component)
├── EditorToolbar (Sub-component)
├── EditorContent (Sub-component)
├── EditorFooter (Sub-component)
├── LinkDialog (Sub-component)
└── CitationPicker (Existing Sub-component)
```

import { useCallback } from "react";
import type { EditorView } from "@codemirror/view";

export function useFormatting(editorViewRef: React.MutableRefObject<EditorView | null>) {
  const applyWrappedFormatting = useCallback(
    (startWrapper: string, endWrapper: string, placeholder: string) => {
      const view = editorViewRef.current;
      if (!view) return;

      const { state } = view;
      const { from, to } = state.selection.main;
      const selectedText = state.sliceDoc(from, to);
      const hasSelection = from !== to;
      const alreadyWrapped =
        hasSelection &&
        selectedText.startsWith(startWrapper) &&
        selectedText.endsWith(endWrapper) &&
        selectedText.length >= startWrapper.length + endWrapper.length;

      if (alreadyWrapped) {
        const unwrapped = selectedText.slice(
          startWrapper.length,
          selectedText.length - endWrapper.length,
        );
        view.dispatch({
          changes: { from, to, insert: unwrapped },
          selection: { anchor: from, head: from + unwrapped.length },
          scrollIntoView: true,
        });
        view.focus();
        return;
      }

      const text =
        hasSelection && selectedText.length > 0 ? selectedText : placeholder;
      const insert = `${startWrapper}${text}${endWrapper}`;
      const anchor = from + startWrapper.length;
      const head = anchor + text.length;

      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor, head },
        scrollIntoView: true,
      });
      view.focus();
    },
    [editorViewRef],
  );

  const applyHeadingFormatting = useCallback(() => {
    const view = editorViewRef.current;
    if (!view) return;

    const { state } = view;

    const lineNumbers = new Set<number>();
    state.selection.ranges.forEach((currentRange) => {
      let line = state.doc.lineAt(currentRange.from);
      lineNumbers.add(line.number);

      while (line.to < currentRange.to) {
        line = state.doc.line(line.number + 1);
        lineNumbers.add(line.number);
      }
    });

    const changes = Array.from(lineNumbers)
      .map((lineNumber) => {
        const line = state.doc.line(lineNumber);
        const text = line.text;
        const match = text.match(/^(#{1,3})\s/);

        if (match && match[1]) {
          const level = match[1].length;
          if (level === 3) {
            return { from: line.from, to: line.from + 4, insert: "" };
          } else {
            return { from: line.from, to: line.from, insert: "#" };
          }
        } else {
          return { from: line.from, to: line.from, insert: "# " };
        }
      })
      .sort((a, b) => a.from - b.from);

    if (changes.length > 0) {
      view.dispatch({ changes, scrollIntoView: true });
    }

    view.focus();
  }, [editorViewRef]);

  const applyListFormatting = useCallback(() => {
    const view = editorViewRef.current;
    if (!view) return;

    const { state } = view;
    const range = state.selection.ranges[0];
    if (!range) return;

    if (state.selection.ranges.length === 1 && range.from === range.to) {
      const line = state.doc.lineAt(range.from);
      const prefix = line.text.startsWith("- ") ? "" : "- ";

      if (prefix) {
        view.dispatch({
          changes: { from: line.from, to: line.from, insert: prefix },
          selection: {
            anchor: range.from + prefix.length,
            head: range.from + prefix.length,
          },
          scrollIntoView: true,
        });
      }
      view.focus();
      return;
    }

    const lineNumbers = new Set<number>();
    state.selection.ranges.forEach((currentRange) => {
      let line = state.doc.lineAt(currentRange.from);
      lineNumbers.add(line.number);

      while (line.to < currentRange.to) {
        line = state.doc.line(line.number + 1);
        lineNumbers.add(line.number);
      }
    });

    const changes = Array.from(lineNumbers)
      .map((lineNumber) => state.doc.line(lineNumber))
      .filter((line) => !/^(?:[-*] |\d+\. )/.test(line.text.trimStart()))
      .map((line) => ({ from: line.from, to: line.from, insert: "- " }))
      .sort((a, b) => a.from - b.from);

    if (changes.length > 0) {
      view.dispatch({ changes, scrollIntoView: true });
    }

    view.focus();
  }, [editorViewRef]);

  const applyFormatting = useCallback(
    (format: "bold" | "italic" | "code" | "list" | "heading") => {
      switch (format) {
        case "bold":
          applyWrappedFormatting("**", "**", "bold text");
          break;
        case "italic":
          applyWrappedFormatting("*", "*", "italic text");
          break;
        case "code":
          applyWrappedFormatting("`", "`", "code");
          break;
        case "list":
          applyListFormatting();
          break;
        case "heading":
          applyHeadingFormatting();
          break;
      }
    },
    [applyListFormatting, applyWrappedFormatting, applyHeadingFormatting],
  );

  const handleCitationSelect = useCallback((citation: string, setCitationPickerOpen: (open: boolean) => void) => {
    const view = editorViewRef.current;
    if (!view) return;

    const { state } = view;
    const { from, to } = state.selection.main;

    view.dispatch({
      changes: { from, to, insert: citation },
      selection: { anchor: from + citation.length },
      scrollIntoView: true,
    });
    view.focus();
    setCitationPickerOpen(false);
  }, [editorViewRef]);

  return {
    applyFormatting,
    handleCitationSelect,
  };
}

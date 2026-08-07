import { useState, useEffect, useLayoutEffect, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../../../store/appStore";
import { useNotes } from "../../../hooks/useNotes";
import { countWords } from "../../../utils/text";

export type ViewMode = "split" | "edit" | "preview";
export type SaveState = "saving" | "saved" | "error";

export function useMarkdownEditor() {
  const { selectedNote, effectiveTheme, user, isZenMode, toggleZenMode } = useAppStore(
    useShallow((state) => ({
      selectedNote: state.selectedNote,
      effectiveTheme: state.effectiveTheme,
      user: state.user,
      isZenMode: state.isZenMode,
      toggleZenMode: state.toggleZenMode,
    })),
  );

  const userId = user?.id;
  const { updateNote } = useNotes(userId);

  const [content, setContent] = useState(selectedNote?.markdown_body || "");
  const [title, setTitle] = useState(selectedNote?.title || "");
  const [debouncedContent, setDebouncedContent] = useState(
    selectedNote?.markdown_body || "",
  );
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [saveState, setSaveState] = useState<SaveState>("saved");

  // Load selected note
  useLayoutEffect(() => {
    if (selectedNote) {
      setContent(selectedNote.markdown_body);
      setTitle(selectedNote.title || "");
      setDebouncedContent(selectedNote.markdown_body);
      setSaveState("saved");
    } else {
      setContent("");
      setTitle("");
      setDebouncedContent("");
      setSaveState("saved");
    }
  }, [selectedNote]);

  // Debounce content updates for preview
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedContent(content);
    }, 300);
    return () => clearTimeout(handler);
  }, [content]);

  // Word count and reading time
  const wordCount = useMemo(() => countWords(content), [content]);
  const readingTime = useMemo(() => {
    const wordsPerMinute = 200;
    const minutes = Math.ceil(wordCount / wordsPerMinute);
    if (wordCount === 0) return "0 min read";
    if (minutes <= 1) return "1 min read";
    return `${minutes} min read`;
  }, [wordCount]);

  return {
    selectedNote,
    content,
    setContent,
    title,
    setTitle,
    debouncedContent,
    viewMode,
    setViewMode,
    saveState,
    setSaveState,
    wordCount,
    readingTime,
    effectiveTheme,
    isZenMode,
    toggleZenMode,
    updateNote,
    userId,
  };
}

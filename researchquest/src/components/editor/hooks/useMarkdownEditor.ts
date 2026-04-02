import { useState, useEffect, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../../../store/appStore";
import { useNotes } from "../../../hooks/useNotes";
import { countWords } from "../../../utils/text";

export type ViewMode = "split" | "edit" | "preview";

export function useMarkdownEditor() {
  const { selectedNote, setSelectedNote, effectiveTheme, user, isZenMode, toggleZenMode } = useAppStore(
    useShallow((state) => ({
      selectedNote: state.selectedNote,
      setSelectedNote: state.setSelectedNote,
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
  const [saving, setSaving] = useState(false);

  // Load selected note
  useEffect(() => {
    if (selectedNote) {
      setContent(selectedNote.markdown_body);
      setTitle(selectedNote.title || "");
      setDebouncedContent(selectedNote.markdown_body);
    } else {
      setContent("");
      setTitle("");
      setDebouncedContent("");
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
    saving,
    setSaving,
    wordCount,
    readingTime,
    effectiveTheme,
    isZenMode,
    toggleZenMode,
    updateNote,
    userId,
  };
}

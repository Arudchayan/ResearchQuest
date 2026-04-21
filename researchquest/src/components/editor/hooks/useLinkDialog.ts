import { useState, useCallback, useRef, useEffect } from "react";
import type { EditorView } from "@codemirror/view";
import { isValidUrl } from "../../../utils/security";

export function useLinkDialog(editorViewRef: React.MutableRefObject<EditorView | null>) {
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [pendingLinkRange, setPendingLinkRange] = useState<{ from: number; to: number } | null>(null);
  const [linkTextValue, setLinkTextValue] = useState("");
  const [linkUrlValue, setLinkUrlValue] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const linkUrlInputRef = useRef<HTMLInputElement>(null);

  const closeLinkDialog = useCallback(() => {
    setLinkDialogOpen(false);
    setPendingLinkRange(null);
    setLinkTextValue("");
    setLinkUrlValue("");
    setLinkError(null);
  }, []);

  const openLinkDialog = useCallback(() => {
    const view = editorViewRef.current;
    if (!view) return;

    const { state } = view;
    const { from, to } = state.selection.main;
    const selectedText = state.sliceDoc(from, to);

    setPendingLinkRange({ from, to });
    setLinkTextValue(selectedText);
    setLinkUrlValue("");
    setLinkError(null);
    setLinkDialogOpen(true);
  }, [editorViewRef]);

  const handleLinkSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!pendingLinkRange) return;

      const url = linkUrlValue.trim();
      const text = linkTextValue.trim();

      if (!url) {
        setLinkError("Link URL is required");
        return;
      }

      if (!isValidUrl(url)) {
        setLinkError("Invalid URL protocol. Only http, https, and mailto are allowed.");
        return;
      }

      const view = editorViewRef.current;
      if (!view) {
        closeLinkDialog();
        return;
      }

      const safeText = text.length > 0 ? text : url;
      const insert = `[${safeText}](${url})`;
      const anchor = pendingLinkRange.from + 1;
      const head = anchor + safeText.length;

      view.dispatch({
        changes: { from: pendingLinkRange.from, to: pendingLinkRange.to, insert },
        selection: { anchor, head },
        scrollIntoView: true,
      });
      view.focus();
      closeLinkDialog();
    },
    [closeLinkDialog, linkTextValue, linkUrlValue, pendingLinkRange, editorViewRef],
  );

  useEffect(() => {
    if (!linkDialogOpen) return;
    setLinkError(null);
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => {
      linkUrlInputRef.current?.focus();
    });
    return () => {
      document.body.style.overflow = "unset";
      cancelAnimationFrame(frame);
    };
  }, [linkDialogOpen]);

  return {
    linkDialogOpen,
    setLinkDialogOpen,
    openLinkDialog,
    closeLinkDialog,
    handleLinkSubmit,
    linkTextValue,
    setLinkTextValue,
    linkUrlValue,
    setLinkUrlValue,
    linkError,
    linkUrlInputRef,
  };
}

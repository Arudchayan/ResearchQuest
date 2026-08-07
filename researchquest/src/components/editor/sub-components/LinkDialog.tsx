import React, { useEffect, useRef } from "react";

interface LinkDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  linkText: string;
  setLinkText: (text: string) => void;
  linkUrl: string;
  setLinkUrl: (url: string) => void;
  error: string | null;
  inputRef: React.RefObject<HTMLInputElement>;
}

export function LinkDialog({
  isOpen,
  onClose,
  onSubmit,
  linkText,
  setLinkText,
  linkUrl,
  setLinkUrl,
  error,
  inputRef,
}: LinkDialogProps) {
  const lastFocusedRef = useRef<Element | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      // Restore focus when dialog closes
      if (lastFocusedRef.current instanceof HTMLElement) {
        lastFocusedRef.current.focus();
      }
      return;
    }

    lastFocusedRef.current = document.activeElement;
    // Focus the URL input when dialog opens
    const timer = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [isOpen, inputRef]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    // Focus trap: keep Tab cycling within the dialog
    if (e.key === "Tab" && dialogRef.current) {
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="link-dialog-title"
      onKeyDown={handleKeyDown}
      ref={dialogRef}
    >
      <div className="w-full max-w-md rounded-lg bg-bg-surface border border-border-subtle shadow-xl">
        <div className="p-6 border-b border-border-subtle">
          <h2 id="link-dialog-title" className="text-lg font-semibold text-text-primary">Insert link</h2>
          <p className="text-caption text-text-secondary mt-1">Wrap selection with a link label.</p>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-4" noValidate>
          <div>
            <label htmlFor="link-text" className="block text-caption font-medium text-text-secondary mb-1">Link text</label>
            <input
              id="link-text"
              type="text"
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-border-subtle bg-bg-base text-small"
            />
          </div>

          <div>
            <label htmlFor="link-url" className="block text-caption font-medium text-text-secondary mb-1">URL</label>
            <input
              id="link-url"
              ref={inputRef}
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              required
              aria-invalid={!!error}
              aria-describedby={error ? "link-url-error" : undefined}
              className="w-full px-3 py-2 rounded-md border border-border-subtle bg-bg-base text-small"
            />
            {error && <p id="link-url-error" role="alert" className="text-caption text-destructive mt-1">{error}</p>}
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-md">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-primary-500 text-white rounded-md">Insert link</button>
          </div>
        </form>
      </div>
    </div>
  );
}

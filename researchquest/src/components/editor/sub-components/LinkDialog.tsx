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
    if (isOpen) {
      lastFocusedRef.current = document.activeElement;
      // Focus the URL input when dialog opens
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 0);
      return () => clearTimeout(timer);
    } else {
      // Restore focus when dialog closes
      if (lastFocusedRef.current instanceof HTMLElement) {
        lastFocusedRef.current.focus();
      }
    }
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
      <div className="w-full max-w-md rounded-xl border border-border-moderate bg-bg-surface shadow-lift animate-fade-slide-in">
        <div className="border-b border-border-subtle p-6">
          <h2 id="link-dialog-title" className="font-serif text-lg font-semibold text-text-primary">Insert link</h2>
          <p className="mt-1 text-caption text-text-secondary">Wrap selection with a link label.</p>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-4" noValidate>
          <div>
            <label htmlFor="link-text" className="mb-1.5 block text-caption font-semibold text-text-secondary">Link text</label>
            <input
              id="link-text"
              type="text"
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              className="w-full rounded-lg border border-border-moderate bg-bg-surface px-3 py-2.5 text-small text-text-primary shadow-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>

          <div>
            <label htmlFor="link-url" className="mb-1.5 block text-caption font-semibold text-text-secondary">URL</label>
            <input
              id="link-url"
              ref={inputRef}
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              required
              aria-invalid={!!error}
              aria-describedby={error ? "link-url-error" : undefined}
              className="w-full rounded-lg border border-border-moderate bg-bg-surface px-3 py-2.5 text-small text-text-primary shadow-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            {error && <p id="link-url-error" role="alert" className="mt-1.5 text-caption font-medium text-coral-strong">{error}</p>}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-border-moderate bg-bg-surface px-4 text-sm font-semibold text-text-secondary shadow-sm transition-all hover:-translate-y-0.5 hover:border-border-strong hover:bg-bg-elevated hover:text-text-primary hover:shadow-lift"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-text-primary px-4 text-sm font-semibold text-bg-base shadow-lift transition-transform hover:-translate-y-0.5 hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
            >
              Insert link
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

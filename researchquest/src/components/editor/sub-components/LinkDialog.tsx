import React from "react";

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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" role="dialog">
      <div className="w-full max-w-md rounded-lg bg-bg-surface border border-border-subtle shadow-xl">
        <div className="p-6 border-b border-border-subtle">
          <h2 className="text-lg font-semibold text-text-primary">Insert link</h2>
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

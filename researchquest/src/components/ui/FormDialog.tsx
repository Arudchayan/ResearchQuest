import { X } from "lucide-react";
import { useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode, FormEvent } from "react";

import { Button } from "@/components/ui/button";

export interface FormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
  title: string;
  description?: string;
  children: ReactNode;
  icon?: ReactNode;
  submitText?: string;
  cancelText?: string;
  isLoading?: boolean;
  isSubmitDisabled?: boolean;
}

export function FormDialog({
  isOpen,
  onClose,
  onSubmit,
  title,
  description,
  children,
  icon,
  submitText = "Submit",
  cancelText = "Cancel",
  isLoading = false,
  isSubmitDisabled = false,
}: FormDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isLoading) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-modal-stacked bg-overlay animate-in fade-in duration-fast" />
        <Dialog.Content
          ref={dialogRef}
          aria-modal="true"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            dialogRef.current
              ?.querySelector<HTMLElement>(
                'input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
              )
              ?.focus();
          }}
          className="fixed left-1/2 top-1/2 z-modal-stacked w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-surface bg-bg-surface shadow-lg border border-border-moderate animate-in zoom-in-95 duration-fast"
        >
          <form onSubmit={onSubmit}>
            {/* Header */}
            <div className="flex items-start gap-4 p-6 pb-4">
              {icon && (
                <div className="w-12 h-12 rounded-control bg-info-bg flex items-center justify-center flex-shrink-0">
                  {icon}
                </div>
              )}

              <div className="flex-1 min-w-0 mt-1">
                <Dialog.Title
                  id="form-dialog-title"
                  className="text-lg font-serif font-semibold text-text-primary mb-1"
                >
                  {title}
                </Dialog.Title>
                {description && (
                  <Dialog.Description
                    id="form-dialog-description"
                    className="text-body text-text-secondary"
                  >
                    {description}
                  </Dialog.Description>
                )}
              </div>

              <Button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                variant="ghost"
                size="icon"
                className="text-text-tertiary hover:text-text-primary"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </Button>
            </div>

            {/* Body */}
            <div className="px-6 py-2 space-y-4">{children}</div>

            {/* Actions */}
            <div className="flex gap-3 px-6 py-6 mt-2">
              <Button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                variant="outline"
                className="flex-1"
              >
                {cancelText}
              </Button>

              <Button
                type="submit"
                disabled={isSubmitDisabled || isLoading}
                aria-live="polite"
                aria-atomic="true"
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-border-subtle border-t-current rounded-full animate-spin" aria-hidden="true" />
                    Processing...
                  </>
                ) : (
                  submitText
                )}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

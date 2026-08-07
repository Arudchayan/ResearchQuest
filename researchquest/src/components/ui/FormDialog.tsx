import { X } from "lucide-react";
import { useEffect, useRef } from "react";
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
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      const trigger = triggerRef.current;
      triggerRef.current = null;
      if (trigger && document.body.contains(trigger)) {
        trigger.focus();
      }
      return;
    }

    if (triggerRef.current === null) {
      const activeElement = document.activeElement;
      triggerRef.current = activeElement instanceof HTMLElement ? activeElement : null;
    }

    const dialog = dialogRef.current;
    if (!dialog) return;

    const firstControl = dialog.querySelector<HTMLElement>(
      'input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
    );
    const firstFocusable = dialog.querySelector<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    (firstControl ?? firstFocusable)?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const el = dialogRef.current;
    if (!el) return;

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusable = el.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (focusable.length === 0) { e.preventDefault(); return; }
      if (e.shiftKey) {
        if (first && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (last && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    window.addEventListener("keydown", handleTab);
    return () => window.removeEventListener("keydown", handleTab);
  }, [isOpen]);


  useEffect(() => {
    if (!isOpen) return;

    // Lock body scroll
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isLoading) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-overlay animate-in fade-in duration-fast"
      onClick={() => {
        if (!isLoading) onClose();
      }}
    >
      <div
        ref={dialogRef}
         className="w-full max-w-md bg-bg-surface rounded-surface shadow-lg border border-border-moderate animate-in zoom-in-95 duration-fast"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-dialog-title"
        aria-describedby={description ? "form-dialog-description" : undefined}
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
              <h3
                id="form-dialog-title"
                className="text-lg font-serif font-semibold text-text-primary mb-1"
              >
                {title}
              </h3>
              {description && (
                <p
                  id="form-dialog-description"
                  className="text-body text-text-secondary"
                >
                  {description}
                </p>
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
      </div>
    </div>
  );
}

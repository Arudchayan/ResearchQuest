import { AlertTriangle, X } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  isLoading?: boolean;
}

const VARIANT_STYLES = {
  danger: {
    icon: "text-destructive",
    iconBg: "bg-destructive-bg",
    button: "bg-destructive text-destructive-foreground hover:bg-destructive-hover",
  },
  warning: {
    icon: "text-warning",
    iconBg: "bg-warning-bg",
    button: "bg-warning text-warning-foreground hover:bg-warning-hover",
  },
  info: {
    icon: "text-info",
    iconBg: "bg-info-bg",
    button: "bg-info text-info-foreground hover:bg-info-hover",
  },
} as const;

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  isLoading = false,
}: ConfirmDialogProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const styles = VARIANT_STYLES[variant];

  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement;
    }
  }, [isOpen]);

  const handleConfirm = () => {
    if (!isLoading) {
      onConfirm();
    }
  };

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
          role="alertdialog"
          aria-modal="true"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            const target =
              variant === "danger" || variant === "warning"
                ? cancelButtonRef.current
                : confirmButtonRef.current;
            target?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            previouslyFocusedRef.current?.focus();
          }}
          className="fixed left-1/2 top-1/2 z-modal-stacked w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-surface bg-bg-surface shadow-lg border border-border-moderate animate-in zoom-in-95 duration-fast"
        >
          {/* Header */}
          <div className="flex items-start gap-4 p-6 pb-4">
            <div
              className={`w-12 h-12 rounded-control ${styles.iconBg} flex items-center justify-center flex-shrink-0`}
            >
              <AlertTriangle className={`w-6 h-6 ${styles.icon}`} aria-hidden="true" />
            </div>

            <div className="flex-1 min-w-0">
              <Dialog.Title
                id="dialog-title"
                className="text-lg font-serif font-semibold text-text-primary mb-2"
              >
                {title}
              </Dialog.Title>
              <Dialog.Description
                id="dialog-description"
                className="text-body text-text-secondary"
              >
                {message}
              </Dialog.Description>
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

          {/* Actions */}
          <div className="flex gap-3 px-6 py-4 bg-bg-elevated border-t border-border-subtle">
            <Button
              ref={cancelButtonRef}
              type="button"
              onClick={onClose}
              disabled={isLoading}
              variant="outline"
              className="flex-1"
            >
              {cancelText}
            </Button>

            <Button
              ref={confirmButtonRef}
              type="button"
              onClick={handleConfirm}
              disabled={isLoading}
              aria-live="polite"
              aria-atomic="true"
              variant={variant === "danger" ? "destructive" : "default"}
              className={cn("flex-1", styles.button)}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-border-subtle border-t-current rounded-full animate-spin" aria-hidden="true" />
                  Loading...
                </span>
              ) : (
                confirmText
              )}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Hook to manage confirm dialog state
 */
export function useConfirmDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<Partial<ConfirmDialogProps>>({});

  const confirm = useCallback(
    (
      options: Partial<ConfirmDialogProps> & { title: string; message: string },
    ) => {
      return new Promise<boolean>((resolve) => {
        setConfig({
          ...options,
          onConfirm: () => {
            resolve(true);
            setIsOpen(false);
          },
          onClose: () => {
            resolve(false);
            setIsOpen(false);
          },
        });
        setIsOpen(true);
      });
    },
    [],
  );

  return { confirm, isOpen, config };
}

import { AlertTriangle, X } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";

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

    // Focus cancel button for destructive/warning actions, confirm for others
    if (variant === "danger" || variant === "warning") {
      cancelButtonRef.current?.focus();
    } else {
      confirmButtonRef.current?.focus();
    }

    // Lock body scroll
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen, variant]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (!focusableElements || focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        if (!firstElement || !lastElement) return;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }

      if (e.key === "Escape" && !isLoading) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case "danger":
        return {
          icon: "text-destructive",
          iconBg: "bg-destructive-bg",
          button:
            "bg-destructive text-destructive-foreground hover:bg-destructive-hover",
        };
      case "warning":
        return {
          icon: "text-warning",
          iconBg: "bg-warning-bg",
          button:
            "bg-warning text-warning-foreground hover:bg-warning-hover",
        };
      case "info":
        return {
          icon: "text-info",
          iconBg: "bg-info-bg",
          button: "bg-info text-info-foreground hover:bg-info-hover",
        };
    }
  };

  const styles = getVariantStyles();

  const handleConfirm = () => {
    if (!isLoading) {
      onConfirm();
    }
  };

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
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-description"
      >
        {/* Header */}
        <div className="flex items-start gap-4 p-6 pb-4">
          <div
            className={`w-12 h-12 rounded-control ${styles.iconBg} flex items-center justify-center flex-shrink-0`}
          >
            <AlertTriangle className={`w-6 h-6 ${styles.icon}`} aria-hidden="true" />
          </div>

          <div className="flex-1 min-w-0">
            <h3
              id="dialog-title"
              className="text-lg font-serif font-semibold text-text-primary mb-2"
            >
              {title}
            </h3>
            <p
              id="dialog-description"
              className="text-body text-text-secondary"
            >
              {message}
            </p>
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
      </div>
    </div>
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

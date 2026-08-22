import { AlertTriangle, RefreshCw, Home } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ErrorFallbackProps {
  error: Error;
  resetError?: () => void;
  title?: string;
  showHomeButton?: boolean;
}

export function ErrorFallback({
  error,
  resetError,
  title = "Something went wrong",
  showHomeButton = true,
}: ErrorFallbackProps) {
  const handleGoHome = () => {
    window.location.href = "/";
  };

  const handleRetry = () => {
    if (resetError) {
      resetError();
    } else {
      window.location.reload();
    }
  };

  // Get user-friendly error message
  const getUserFriendlyMessage = (err: Error) => {
    const message = err.message.toLowerCase();

    if (message.includes("network") || message.includes("fetch")) {
      return "Network connection issue. Please check your internet connection and try again.";
    }

    if (message.includes("unauthorized") || message.includes("401")) {
      return "Your session has expired. Please log in again.";
    }

    if (message.includes("forbidden") || message.includes("403")) {
      return "You don't have permission to access this resource.";
    }

    if (message.includes("not found") || message.includes("404")) {
      return "The requested resource was not found.";
    }

    if (message.includes("timeout")) {
      return "The request took too long. Please try again.";
    }

    return "An unexpected error occurred. Our team has been notified.";
  };

  return (
    <div className="min-h-[400px] flex items-center justify-center p-6 bg-bg-base">
      <div className="w-full max-w-md">
        {/* Error Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-control bg-destructive-bg flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-destructive" aria-hidden="true" />
          </div>
        </div>

        {/* Error Title */}
        <h2 className="font-serif text-xl font-bold text-text-primary text-center mb-3">
          {title}
        </h2>

        {/* User-Friendly Message */}
        <p className="text-body text-text-secondary text-center mb-6">
          {getUserFriendlyMessage(error)}
        </p>

        {/* Technical Details (Collapsible) */}
        <details className="mb-6 p-4 bg-bg-elevated rounded-lg border border-border-moderate">
          <summary className="text-small font-medium text-text-secondary cursor-pointer hover:text-text-primary transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2">
            Technical Details
          </summary>
          <div className="mt-3 space-y-2">
            <p className="text-caption font-mono text-destructive break-words">
              {error.message}
            </p>
            
          </div>
        </details>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            type="button"
            onClick={handleRetry}
            className="flex-1"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Try Again
          </Button>

          {showHomeButton && (
            <Button
              type="button"
              onClick={handleGoHome}
              variant="outline"
              className="flex-1"
            >
              <Home className="w-4 h-4" aria-hidden="true" />
              Go Home
            </Button>
          )}
        </div>

        {/* Support Link */}
        <p className="text-caption text-text-tertiary text-center mt-6">
          If the problem persists, please{" "}
          <a
            href="mailto:support@researchquest.com"
            className="inline-flex min-h-11 items-center text-primary-500 hover:text-primary-600 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
          >
            contact support
          </a>
        </p>
      </div>
    </div>
  );
}

/**
 * Inline error message component for smaller errors
 */
interface InlineErrorProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function InlineError({
  message,
  onRetry,
  className = "",
}: InlineErrorProps) {
  return (
    <div
        className={`p-4 rounded-surface bg-destructive-bg border border-destructive ${className}`}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-small text-destructive mb-2">
            {message}
          </p>
          {onRetry && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onRetry}
              className="px-2 text-destructive hover:bg-destructive-bg hover:text-destructive-hover underline"
            >
              Try again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Network error specific component
 */
export function NetworkError({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 rounded-control bg-warning-bg flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8 text-warning" aria-hidden="true" />
      </div>

      <h3 className="font-serif text-lg font-semibold text-text-primary mb-2">
        Connection Lost
      </h3>

      <p className="text-body text-text-secondary mb-4 max-w-sm">
        Unable to connect to the server. Please check your internet connection.
      </p>

      {onRetry && (
        <Button
          type="button"
          onClick={onRetry}
          className="px-6"
        >
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
          Retry Connection
        </Button>
      )}
    </div>
  );
}

import { AlertCircle, Home, ArrowLeft } from "lucide-react";

interface NotFoundProps {
  title?: string;
  message?: string;
  showBackButton?: boolean;
}

export function NotFound({
  title = "Item Not Found",
  message = "The item you're looking for doesn't exist or has been deleted.",
  showBackButton = true,
}: NotFoundProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base p-6">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive-bg mb-6">
          <AlertCircle className="w-8 h-8 text-destructive" />
        </div>

        <h1 className="text-2xl font-bold text-text-primary mb-3">{title}</h1>

        <p className="text-body text-text-secondary mb-8">{message}</p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {showBackButton && (
            <button
              onClick={() => window.history.back()}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-bg-elevated text-text-primary rounded-lg hover:bg-bg-surface transition-colors border border-border-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              Go Back
            </button>
          )}

          <button
            onClick={() => window.location.replace("/")}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-500 text-bg-base rounded-lg hover:bg-primary-600 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
          >
            <Home className="w-4 h-4" aria-hidden="true" />
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
}

interface ItemNotFoundProps {
  itemType?: string;
  onReturn?: () => void;
  description?: string;
}

export function ItemNotFound({
  itemType = "item",
  onReturn,
  description,
}: ItemNotFoundProps) {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px] p-6">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-warning-bg mb-4">
          <AlertCircle className="w-6 h-6 text-warning" aria-hidden="true" />
        </div>

        <h3 className="text-lg font-semibold text-text-primary mb-2">
          {itemType.charAt(0).toUpperCase() + itemType.slice(1)} Not Found
        </h3>

        <p className="text-small text-text-secondary mb-4">
          {description ||
            `This ${itemType} may have been deleted or you may not have access to it.`}
        </p>

        <button
          onClick={() => {
            if (onReturn) {
              onReturn();
              return;
            }
            // Go back to the list view smoothly
            const view = window.location.pathname.split("/")[1];
            window.location.replace(`/${view}`);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-bg-base rounded-md hover:bg-primary-600 transition-colors text-small focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Back to List
        </button>
      </div>
    </div>
  );
}

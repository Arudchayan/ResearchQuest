import { AlertCircle, Home, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

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
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base p-6">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 mb-6">
          <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>

        <h1 className="text-2xl font-bold text-text-primary mb-3">{title}</h1>

        <p className="text-body text-text-secondary mb-8">{message}</p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {showBackButton && (
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-bg-elevated text-text-primary rounded-lg hover:bg-bg-surface transition-colors border border-border-subtle"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              Go Back
            </button>
          )}

          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
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
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center h-full min-h-[400px] p-6">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/20 mb-4">
          <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" aria-hidden="true" />
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
            navigate(`/${view}`, { replace: true });
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors text-small"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Back to List
        </button>
      </div>
    </div>
  );
}

import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface ErrorFallbackProps {
  error: Error
  resetError?: () => void
  title?: string
  showHomeButton?: boolean
}

export function ErrorFallback({ 
  error, 
  resetError, 
  title = 'Something went wrong',
  showHomeButton = true 
}: ErrorFallbackProps) {
  const navigate = useNavigate()
  
  const handleGoHome = () => {
    window.location.href = '/'
  }
  
  const handleRetry = () => {
    if (resetError) {
      resetError()
    } else {
      window.location.reload()
    }
  }
  
  // Get user-friendly error message
  const getUserFriendlyMessage = (err: Error) => {
    const message = err.message.toLowerCase()
    
    if (message.includes('network') || message.includes('fetch')) {
      return 'Network connection issue. Please check your internet connection and try again.'
    }
    
    if (message.includes('unauthorized') || message.includes('401')) {
      return 'Your session has expired. Please log in again.'
    }
    
    if (message.includes('forbidden') || message.includes('403')) {
      return "You don't have permission to access this resource."
    }
    
    if (message.includes('not found') || message.includes('404')) {
      return 'The requested resource was not found.'
    }
    
    if (message.includes('timeout')) {
      return 'The request took too long. Please try again.'
    }
    
    return 'An unexpected error occurred. Our team has been notified.'
  }
  
  return (
    <div className="min-h-[400px] flex items-center justify-center p-6 bg-bg-base">
      <div className="w-full max-w-md">
        {/* Error Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
        </div>
        
        {/* Error Title */}
        <h2 className="text-xl font-bold text-text-primary text-center mb-3">
          {title}
        </h2>
        
        {/* User-Friendly Message */}
        <p className="text-body text-text-secondary text-center mb-6">
          {getUserFriendlyMessage(error)}
        </p>
        
        {/* Technical Details (Collapsible) */}
        <details className="mb-6 p-4 bg-bg-elevated rounded-lg border border-border-subtle">
          <summary className="text-small font-medium text-text-secondary cursor-pointer hover:text-text-primary transition-colors">
            Technical Details
          </summary>
          <div className="mt-3 space-y-2">
            <p className="text-caption font-mono text-red-600 dark:text-red-400 break-words">
              {error.message}
            </p>
            {error.stack && (
              <pre className="text-caption font-mono text-text-tertiary overflow-x-auto p-2 bg-bg-base rounded max-h-32 overflow-y-auto">
                {error.stack}
              </pre>
            )}
          </div>
        </details>
        
        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleRetry}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
          
          {showHomeButton && (
            <button
              onClick={handleGoHome}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-bg-elevated text-text-primary border border-border-subtle rounded-md hover:bg-bg-surface transition-colors font-medium"
            >
              <Home className="w-4 h-4" />
              Go Home
            </button>
          )}
        </div>
        
        {/* Support Link */}
        <p className="text-caption text-text-tertiary text-center mt-6">
          If the problem persists, please{' '}
          <a href="mailto:support@researchquest.com" className="text-primary-500 hover:text-primary-600 underline">
            contact support
          </a>
        </p>
      </div>
    </div>
  )
}

/**
 * Inline error message component for smaller errors
 */
interface InlineErrorProps {
  message: string
  onRetry?: () => void
  className?: string
}

export function InlineError({ message, onRetry, className = '' }: InlineErrorProps) {
  return (
    <div className={`p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 ${className}`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-small text-red-800 dark:text-red-200 mb-2">
            {message}
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="text-caption text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100 font-medium underline"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Network error specific component
 */
export function NetworkError({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center mb-4">
        <AlertTriangle className="w-8 h-8 text-orange-600 dark:text-orange-400" />
      </div>
      
      <h3 className="text-lg font-semibold text-text-primary mb-2">
        Connection Lost
      </h3>
      
      <p className="text-body text-text-secondary mb-4 max-w-sm">
        Unable to connect to the server. Please check your internet connection.
      </p>
      
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-6 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors font-medium"
        >
          <RefreshCw className="w-4 h-4" />
          Retry Connection
        </button>
      )}
    </div>
  )
}

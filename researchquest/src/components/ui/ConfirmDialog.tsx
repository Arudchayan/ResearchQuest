import { AlertTriangle, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info'
  isLoading?: boolean
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false
}: ConfirmDialogProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  
  useEffect(() => {
    if (isOpen) {
      // Focus cancel button for destructive/warning actions, confirm for others
      if (variant === 'danger' || variant === 'warning') {
        cancelButtonRef.current?.focus()
      } else {
        confirmButtonRef.current?.focus()
      }
      
      // Lock body scroll
      document.body.style.overflow = 'hidden'
      
      return () => {
        document.body.style.overflow = 'unset'
      }
    }
  }, [isOpen, variant])
  
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose()
      }
    }
    
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, isLoading, onClose])
  
  if (!isOpen) return null
  
  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: 'text-red-600 dark:text-red-400',
          iconBg: 'bg-red-100 dark:bg-red-900/20',
          button: 'bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800'
        }
      case 'warning':
        return {
          icon: 'text-orange-600 dark:text-orange-400',
          iconBg: 'bg-orange-100 dark:bg-orange-900/20',
          button: 'bg-orange-600 hover:bg-orange-700 dark:bg-orange-700 dark:hover:bg-orange-800'
        }
      case 'info':
        return {
          icon: 'text-primary-600 dark:text-primary-400',
          iconBg: 'bg-primary-100 dark:bg-primary-900/20',
          button: 'bg-primary-600 hover:bg-primary-700'
        }
    }
  }
  
  const styles = getVariantStyles()
  
  const handleConfirm = () => {
    if (!isLoading) {
      onConfirm()
    }
  }
  
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-bg-surface rounded-lg shadow-lg border border-border-subtle animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-description"
      >
        {/* Header */}
        <div className="flex items-start gap-4 p-6 pb-4">
          <div className={`w-12 h-12 rounded-full ${styles.iconBg} flex items-center justify-center flex-shrink-0`}>
            <AlertTriangle className={`w-6 h-6 ${styles.icon}`} />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 
              id="dialog-title"
              className="text-lg font-semibold text-text-primary mb-2"
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
          
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-elevated transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Actions */}
        <div className="flex gap-3 px-6 py-4 bg-bg-elevated border-t border-border-subtle">
          <button
            ref={cancelButtonRef}
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-bg-surface text-text-primary border border-border-subtle rounded-md hover:bg-bg-base transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>
          
          <button
            ref={confirmButtonRef}
            onClick={handleConfirm}
            disabled={isLoading}
            className={`flex-1 px-4 py-2 text-white rounded-md transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed ${styles.button}`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Loading...
              </span>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Hook to manage confirm dialog state
 */
export function useConfirmDialog() {
  const [isOpen, setIsOpen] = useState(false)
  const [config, setConfig] = useState<Partial<ConfirmDialogProps>>({})

  const confirm = (options: Partial<ConfirmDialogProps> & { title: string; message: string }) => {
    return new Promise<boolean>((resolve) => {
      setConfig({
        ...options,
        onConfirm: () => {
          resolve(true)
          setIsOpen(false)
        },
        onClose: () => {
          resolve(false)
          setIsOpen(false)
        }
      })
      setIsOpen(true)
    })
  }

  return { confirm, isOpen, config }
}

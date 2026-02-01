import { Lightbulb, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface AddIdeaDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (data: { title: string; description?: string }) => void
  isLoading?: boolean
}

export function AddIdeaDialog({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false
}: AddIdeaDialogProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const firstInputRef = useRef<HTMLInputElement>(null)

  // Reset form when opening
  useEffect(() => {
    if (isOpen) {
      setTitle('')
      setDescription('')
      // Focus first input
      setTimeout(() => {
        firstInputRef.current?.focus()
      }, 50)

      // Lock body scroll
      document.body.style.overflow = 'hidden'

      return () => {
        document.body.style.overflow = 'unset'
      }
    }
  }, [isOpen])

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || isLoading) return

    onConfirm({
      title: title.trim(),
      description: description.trim() || undefined
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-bg-surface rounded-lg shadow-lg border border-border-subtle animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-idea-title"
      >
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="flex items-start gap-4 p-6 pb-4">
            <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/20 flex items-center justify-center flex-shrink-0">
              <Lightbulb className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>

            <div className="flex-1 min-w-0">
              <h3
                id="add-idea-title"
                className="text-lg font-semibold text-text-primary mb-1"
              >
                New Idea
              </h3>
              <p className="text-body text-text-secondary">
                Capture a new concept, hypothesis, or research direction.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-elevated transition-colors disabled:opacity-50"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-2 space-y-4">
            <div>
              <label htmlFor="idea-title" className="block text-small font-medium text-text-primary mb-1.5">
                Title *
              </label>
              <input
                ref={firstInputRef}
                id="idea-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="E.g., Neural network pruning technique"
                className="w-full px-3 py-2 bg-bg-base border border-border-subtle rounded-md text-body focus:outline-none focus:ring-2 focus:ring-primary-500 transition-shadow"
                required
                disabled={isLoading}
                maxLength={255}
              />
            </div>

            <div>
              <label htmlFor="idea-description" className="block text-small font-medium text-text-primary mb-1.5">
                Description
              </label>
              <textarea
                id="idea-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional details about this idea..."
                rows={4}
                className="w-full px-3 py-2 bg-bg-base border border-border-subtle rounded-md text-body focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none transition-shadow"
                disabled={isLoading}
                maxLength={5000}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 px-6 py-6 mt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-bg-surface text-text-primary border border-border-subtle rounded-md hover:bg-bg-base transition-colors font-medium disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={!title.trim() || isLoading}
              className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating...' : 'Create Idea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

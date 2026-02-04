import * as Dialog from '@radix-ui/react-dialog'
import { X, Copy, Check } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Paper } from '../../types/database'
import { generateBibTeX } from '../../utils/citation'
import { toast } from 'sonner'

interface CitationDialogProps {
  paper: Paper
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function CitationDialog({ paper, isOpen, onOpenChange }: CitationDialogProps) {
  const [bibtex, setBibtex] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setBibtex(generateBibTeX(paper))
      setCopied(false)
    }
  }, [isOpen, paper])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bibtex)
      setCopied(true)
      toast.success('BibTeX copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      toast.error('Failed to copy to clipboard')
      console.error('Clipboard error:', err)
    }
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-fade-in" />
        <Dialog.Content
          className="fixed left-[50%] top-[50%] max-h-[85vh] w-[90vw] max-w-[600px] translate-x-[-50%] translate-y-[-50%] rounded-xl bg-bg-surface p-6 shadow-2xl focus:outline-none z-50 animate-slide-in border border-border-subtle"
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-semibold text-text-primary">
              Cite Paper
            </Dialog.Title>
            <Dialog.Close className="p-2 hover:bg-bg-elevated rounded-full transition-colors">
              <X className="w-5 h-5 text-text-tertiary" />
            </Dialog.Close>
          </div>

          <div className="relative mb-6">
            <pre className="w-full p-4 bg-bg-elevated border border-border-subtle rounded-lg text-sm font-mono text-text-secondary overflow-x-auto whitespace-pre-wrap max-h-[400px]">
              {bibtex}
            </pre>
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 p-2 bg-bg-surface border border-border-subtle rounded-md shadow-sm hover:bg-bg-base transition-colors"
              title="Copy to clipboard"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4 text-text-tertiary" />
              )}
            </button>
          </div>

          <div className="flex justify-end gap-2">
            <Dialog.Close className="px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-elevated rounded-lg transition-colors">
              Close
            </Dialog.Close>
            <button
              onClick={handleCopy}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors flex items-center gap-2"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy BibTeX'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

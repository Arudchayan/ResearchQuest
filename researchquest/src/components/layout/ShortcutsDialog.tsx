import * as Dialog from '@radix-ui/react-dialog'
import { X, Keyboard } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useAppStore } from '../../store/appStore'

interface ShortcutItem {
  keys: string[]
  description: string
}

interface ShortcutSection {
  title: string
  shortcuts: ShortcutItem[]
}

const isMac = typeof window !== 'undefined' && typeof window.navigator !== 'undefined'
  ? /Mac|iPod|iPhone|iPad/.test(window.navigator.platform)
  : false

const META_KEY = isMac ? 'Cmd' : 'Ctrl'
const META_SYMBOL = isMac ? '⌘' : 'Ctrl'

const SHORTCUTS: ShortcutSection[] = [
  {
    title: 'General',
    shortcuts: [
      { keys: [META_KEY, 'K'], description: 'Open Command Palette' },
      { keys: ['?'], description: 'Show Keyboard Shortcuts' },
      { keys: ['/'], description: 'Open Command Palette (Search)' },
    ],
  },
  {
    title: 'Editor',
    shortcuts: [
      { keys: [META_KEY, 'B'], description: 'Bold' },
      { keys: [META_KEY, 'I'], description: 'Italic' },
      { keys: [META_KEY, 'Shift', 'C'], description: 'Inline Code' },
      { keys: [META_KEY, 'Shift', 'L'], description: 'Bulleted List' },
      { keys: [META_KEY, 'K'], description: 'Insert Link' },
      { keys: [META_KEY, 'Shift', 'E'], description: 'Edit View' },
      { keys: [META_KEY, 'Shift', 'S'], description: 'Split View' },
      { keys: [META_KEY, 'Shift', 'P'], description: 'Preview View' },
    ],
  },
  {
    title: 'Global Navigation',
    shortcuts: [
      { keys: [META_KEY, 'Alt', '1'], description: 'Go to Dashboard' },
      { keys: [META_KEY, 'Alt', '2'], description: 'Go to Notes' },
      { keys: [META_KEY, 'Alt', '3'], description: 'Go to Papers' },
      { keys: [META_KEY, 'Alt', '4'], description: 'Go to Ideas' },
      { keys: [META_KEY, 'Alt', '5'], description: 'Go to Tasks' },
      { keys: [META_KEY, 'Alt', '6'], description: 'Go to Focus' },
    ],
  },
  {
    title: 'Interface',
    shortcuts: [
      { keys: [META_KEY, 'Shift', 'F'], description: 'Toggle Zen Mode' },
      { keys: ['Tab'], description: 'Navigate Focus' },
      { keys: ['Enter'], description: 'Select Item' },
      { keys: ['Esc'], description: 'Close Dialogs' },
    ],
  },
]

export function ShortcutsDialog() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey

      // Global Navigation (Mod+Alt+1-6)
      if (isMod && e.altKey) {
        let view = ''
        let url = ''

        switch (e.key) {
          case '1': view = 'dashboard'; url = '/'; break
          case '2': view = 'notes'; url = '/notes'; break
          case '3': view = 'papers'; url = '/papers'; break
          case '4': view = 'ideas'; url = '/ideas'; break
          case '5': view = 'tasks'; url = '/tasks'; break
          case '6': view = 'focus'; url = '/focus'; break
        }

        if (view) {
          e.preventDefault()

          const { setCurrentView, setSelectedNote, setSelectedPaper, setSelectedIdea } = useAppStore.getState()

          // Clear selections when switching main views
          if (view !== 'notes') setSelectedNote(null)
          if (view !== 'papers') setSelectedPaper(null)
          if (view !== 'ideas') setSelectedIdea(null)

          setCurrentView(view as any)
          window.history.pushState(null, '', url)
          return
        }
      }

      // Ignore if typing in an input for other shortcuts
      const target = e.target as HTMLElement
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable

      if (isInput) return

      if (e.key === '?' && e.shiftKey) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }

    const handleCustomEvent = () => {
        setOpen(true)
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('open-shortcuts-help', handleCustomEvent)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('open-shortcuts-help', handleCustomEvent)
    }
  }, [])

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-fade-in" />
        <Dialog.Content
          className="fixed left-[50%] top-[50%] max-h-[85vh] w-[90vw] max-w-[600px] translate-x-[-50%] translate-y-[-50%] rounded-xl bg-bg-surface p-0 shadow-2xl focus:outline-none z-50 animate-slide-in border border-border-subtle overflow-hidden flex flex-col"
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between p-4 border-b border-border-subtle bg-bg-elevated/50">
            <div className="flex items-center gap-2">
                <Keyboard className="w-5 h-5 text-primary-500" />
                <Dialog.Title className="text-lg font-semibold text-text-primary">
                Keyboard Shortcuts
                </Dialog.Title>
            </div>
            <Dialog.Close className="p-2 hover:bg-bg-elevated rounded-full transition-colors">
              <X className="w-5 h-5 text-text-tertiary" />
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {SHORTCUTS.map((section) => (
              <div key={section.title} className="space-y-4">
                <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
                  {section.title}
                </h3>
                <div className="grid gap-3">
                  {section.shortcuts.map((shortcut, index) => (
                    <div key={index} className="flex items-center justify-between group">
                      <span className="text-sm text-text-primary group-hover:text-primary-600 transition-colors">
                        {shortcut.description}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {shortcut.keys.map((key, kIndex) => (
                          <kbd
                            key={kIndex}
                            className="inline-flex items-center justify-center h-6 min-w-[24px] px-1.5 text-[11px] font-bold text-text-secondary bg-bg-elevated border border-border-subtle rounded shadow-sm font-mono"
                          >
                            {key === META_KEY ? <span className="text-xs">{META_SYMBOL}</span> : key}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-border-subtle bg-bg-elevated/30 text-center">
             <p className="text-xs text-text-tertiary">
                Tip: Press <kbd className="font-mono font-bold text-text-secondary">?</kbd> anywhere to open this dialog.
             </p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

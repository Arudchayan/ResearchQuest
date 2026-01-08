import { useEffect, useState, useMemo } from 'react'
import { Command } from 'cmdk'
import { useAppStore } from '../../store/appStore'
import {
  FileText,
  BookOpen,
  Lightbulb,
  CheckSquare,
  Target,
  Search,
  Sun,
  Moon,
  Laptop,
  ArrowRight
} from 'lucide-react'

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const {
    notes,
    papers,
    ideas,
    setCurrentView,
    setSelectedNote,
    setSelectedPaper,
    setSelectedIdea,
    setTheme,
    theme
  } = useAppStore()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  // Filter items based on search
  // Note: cmdk handles filtering internally by default if you don't pass `shouldFilter={false}`
  // However, limiting the number of items passed to cmdk is good for performance.
  // For now, we rely on cmdk's internal filtering but we can pre-slice if needed.

  const runCommand = (command: () => void) => {
    setOpen(false)
    command()
  }

  // Navigation commands
  const navigateTo = (view: 'notes' | 'papers' | 'ideas' | 'tasks' | 'focus') => {
    runCommand(() => {
      setCurrentView(view)
      window.history.pushState(null, '', view === 'notes' ? '/' : `/${view}`)
    })
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Global Command Menu"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/50 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false)
      }}
    >
      <div className="w-full max-w-2xl bg-bg-surface border border-border-moderate rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center border-b border-border-subtle px-4">
          <Search className="w-5 h-5 text-text-tertiary mr-2" />
          <Command.Input
            value={search}
            onValueChange={setSearch}
            placeholder="Search notes, papers, ideas, or run commands..."
            className="flex-1 py-4 bg-transparent text-body text-text-primary placeholder:text-text-tertiary focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-border-moderate bg-bg-elevated px-1.5 font-mono text-[10px] font-medium text-text-secondary opacity-100">
            <span className="text-xs">ESC</span>
          </kbd>
        </div>

        <Command.List className="max-h-[60vh] overflow-y-auto overflow-x-hidden p-2 scroll-py-2">
          <Command.Empty className="py-6 text-center text-small text-text-secondary">
            No results found.
          </Command.Empty>

          <Command.Group heading="Navigation" className="text-xs font-medium text-text-tertiary px-2 py-1.5 mb-2">
            <Command.Item
              onSelect={() => navigateTo('notes')}
              className="flex items-center gap-2 px-2 py-2 rounded-md text-small text-text-primary aria-selected:bg-primary-50 aria-selected:text-primary-600 dark:aria-selected:bg-primary-900/30 dark:aria-selected:text-primary-200 cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>Go to Notes</span>
            </Command.Item>
            <Command.Item
              onSelect={() => navigateTo('papers')}
              className="flex items-center gap-2 px-2 py-2 rounded-md text-small text-text-primary aria-selected:bg-primary-50 aria-selected:text-primary-600 dark:aria-selected:bg-primary-900/30 dark:aria-selected:text-primary-200 cursor-pointer"
            >
              <BookOpen className="w-4 h-4" />
              <span>Go to Papers</span>
            </Command.Item>
            <Command.Item
              onSelect={() => navigateTo('ideas')}
              className="flex items-center gap-2 px-2 py-2 rounded-md text-small text-text-primary aria-selected:bg-primary-50 aria-selected:text-primary-600 dark:aria-selected:bg-primary-900/30 dark:aria-selected:text-primary-200 cursor-pointer"
            >
              <Lightbulb className="w-4 h-4" />
              <span>Go to Ideas</span>
            </Command.Item>
            <Command.Item
              onSelect={() => navigateTo('tasks')}
              className="flex items-center gap-2 px-2 py-2 rounded-md text-small text-text-primary aria-selected:bg-primary-50 aria-selected:text-primary-600 dark:aria-selected:bg-primary-900/30 dark:aria-selected:text-primary-200 cursor-pointer"
            >
              <CheckSquare className="w-4 h-4" />
              <span>Go to Tasks</span>
            </Command.Item>
            <Command.Item
              onSelect={() => navigateTo('focus')}
              className="flex items-center gap-2 px-2 py-2 rounded-md text-small text-text-primary aria-selected:bg-primary-50 aria-selected:text-primary-600 dark:aria-selected:bg-primary-900/30 dark:aria-selected:text-primary-200 cursor-pointer"
            >
              <Target className="w-4 h-4" />
              <span>Go to Focus</span>
            </Command.Item>
          </Command.Group>

          {notes.length > 0 && (
            <Command.Group heading="Notes" className="text-xs font-medium text-text-tertiary px-2 py-1.5 mb-2">
              {notes.map((note) => (
                <Command.Item
                  key={note.id}
                  value={`note ${note.title || note.markdown_body}`}
                  onSelect={() => {
                    runCommand(() => {
                      setSelectedNote(note)
                      setCurrentView('notes')
                      window.history.pushState(null, '', `/notes/${note.id}`)
                    })
                  }}
                  className="flex items-center gap-2 px-2 py-2 rounded-md text-small text-text-primary aria-selected:bg-primary-50 aria-selected:text-primary-600 dark:aria-selected:bg-primary-900/30 dark:aria-selected:text-primary-200 cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-text-secondary" />
                  <span className="truncate flex-1">
                    {note.title || (
                      <span className="text-text-tertiary italic">Untitled Note</span>
                    )}
                  </span>
                  {note.title && <span className="text-caption text-text-tertiary truncate max-w-[200px]">{note.markdown_body.slice(0, 30)}...</span>}
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {papers.length > 0 && (
            <Command.Group heading="Papers" className="text-xs font-medium text-text-tertiary px-2 py-1.5 mb-2">
              {papers.map((paper) => (
                <Command.Item
                  key={paper.id}
                  value={`paper ${paper.title} ${paper.authors?.join(' ')}`}
                  onSelect={() => {
                    runCommand(() => {
                      setSelectedPaper(paper)
                      setCurrentView('papers')
                      window.history.pushState(null, '', `/papers/${paper.id}`)
                    })
                  }}
                  className="flex items-center gap-2 px-2 py-2 rounded-md text-small text-text-primary aria-selected:bg-primary-50 aria-selected:text-primary-600 dark:aria-selected:bg-primary-900/30 dark:aria-selected:text-primary-200 cursor-pointer"
                >
                  <BookOpen className="w-4 h-4 text-text-secondary" />
                  <span className="truncate flex-1">{paper.title}</span>
                  <span className="text-caption text-text-tertiary">
                    {paper.publication_date ? new Date(paper.publication_date).getFullYear() : ''}
                  </span>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {ideas.length > 0 && (
            <Command.Group heading="Ideas" className="text-xs font-medium text-text-tertiary px-2 py-1.5 mb-2">
              {ideas.map((idea) => (
                <Command.Item
                  key={idea.id}
                  value={`idea ${idea.title} ${idea.description}`}
                  onSelect={() => {
                    runCommand(() => {
                      setSelectedIdea(idea)
                      setCurrentView('ideas')
                      window.history.pushState(null, '', `/ideas/${idea.id}`)
                    })
                  }}
                  className="flex items-center gap-2 px-2 py-2 rounded-md text-small text-text-primary aria-selected:bg-primary-50 aria-selected:text-primary-600 dark:aria-selected:bg-primary-900/30 dark:aria-selected:text-primary-200 cursor-pointer"
                >
                  <Lightbulb className="w-4 h-4 text-text-secondary" />
                  <span className="truncate flex-1">{idea.title}</span>
                  <span className="text-caption text-text-tertiary">{idea.stage}</span>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          <Command.Group heading="Theme" className="text-xs font-medium text-text-tertiary px-2 py-1.5 mb-2">
            <Command.Item
              onSelect={() => runCommand(() => setTheme('light'))}
              className="flex items-center gap-2 px-2 py-2 rounded-md text-small text-text-primary aria-selected:bg-primary-50 aria-selected:text-primary-600 dark:aria-selected:bg-primary-900/30 dark:aria-selected:text-primary-200 cursor-pointer"
            >
              <Sun className="w-4 h-4" />
              <span>Light Mode</span>
              {theme === 'light' && <CheckSquare className="w-3 h-3 ml-auto opacity-50" />}
            </Command.Item>
            <Command.Item
              onSelect={() => runCommand(() => setTheme('dark'))}
              className="flex items-center gap-2 px-2 py-2 rounded-md text-small text-text-primary aria-selected:bg-primary-50 aria-selected:text-primary-600 dark:aria-selected:bg-primary-900/30 dark:aria-selected:text-primary-200 cursor-pointer"
            >
              <Moon className="w-4 h-4" />
              <span>Dark Mode</span>
              {theme === 'dark' && <CheckSquare className="w-3 h-3 ml-auto opacity-50" />}
            </Command.Item>
            <Command.Item
              onSelect={() => runCommand(() => setTheme('auto'))}
              className="flex items-center gap-2 px-2 py-2 rounded-md text-small text-text-primary aria-selected:bg-primary-50 aria-selected:text-primary-600 dark:aria-selected:bg-primary-900/30 dark:aria-selected:text-primary-200 cursor-pointer"
            >
              <Laptop className="w-4 h-4" />
              <span>System Theme</span>
              {theme === 'auto' && <CheckSquare className="w-3 h-3 ml-auto opacity-50" />}
            </Command.Item>
          </Command.Group>
        </Command.List>

        <div className="border-t border-border-subtle bg-bg-elevated px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-text-tertiary">
            <span className="font-medium">ProTip:</span>
            <span>Use arrow keys to navigate</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-text-tertiary">
            <div className="flex items-center gap-1">
              <ArrowRight className="w-3 h-3" />
              <span>to select</span>
            </div>
          </div>
        </div>
      </div>
    </Command.Dialog>
  )
}

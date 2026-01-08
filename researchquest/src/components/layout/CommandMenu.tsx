import { useEffect, useState, useMemo } from 'react'
import { Command } from 'cmdk'
import { useAppStore } from '../../store/appStore'
import { useNotes } from '../../hooks/useNotes'
import { usePapers } from '../../hooks/usePapers'
import { useIdeas } from '../../hooks/useIdeas'
import {
  FileText,
  BookOpen,
  Lightbulb,
  CheckSquare,
  Target,
  Moon,
  Sun,
  Search
} from 'lucide-react'

export function CommandMenu() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const {
    currentView,
    setCurrentView,
    theme,
    setTheme,
    setSelectedNote,
    setSelectedPaper,
    setSelectedIdea,
    effectiveTheme
  } = useAppStore()

  // Connect to data
  const { notes } = useNotes(undefined) // Passing undefined as userId since hooks seem to use global store anyway or handle undefined
  const { papers } = usePapers(undefined)
  const { ideas } = useIdeas(undefined)

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

  const runCommand = (command: () => void) => {
    setOpen(false)
    command()
  }

  // Filter data based on search
  const filteredNotes = useMemo(() => {
    if (!search) return notes.slice(0, 3)
    return notes.filter(n =>
      (n.title?.toLowerCase() || '').includes(search.toLowerCase()) ||
      (n.markdown_body?.toLowerCase() || '').includes(search.toLowerCase())
    ).slice(0, 5)
  }, [notes, search])

  const filteredPapers = useMemo(() => {
    if (!search) return papers.slice(0, 3)
    return papers.filter(p =>
      p.title.toLowerCase().includes(search.toLowerCase())
    ).slice(0, 5)
  }, [papers, search])

  const filteredIdeas = useMemo(() => {
    if (!search) return ideas.slice(0, 3)
    return ideas.filter(i =>
      i.title.toLowerCase().includes(search.toLowerCase())
    ).slice(0, 5)
  }, [ideas, search])

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Global Command Menu"
      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-bg-surface rounded-xl shadow-2xl border border-border-subtle overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200 p-0"
      overlayClassName="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-in fade-in duration-200"
    >
      <div className="flex items-center border-b border-border-subtle px-4">
        <Search className="w-5 h-5 text-text-tertiary mr-2" />
        <Command.Input
          value={search}
          onValueChange={setSearch}
          placeholder="Type a command or search..."
          className="flex-1 h-14 bg-transparent outline-none text-text-primary placeholder:text-text-tertiary text-body"
        />
        <div className="flex items-center gap-1 text-xs text-text-tertiary bg-bg-elevated px-2 py-1 rounded">
          <span className="text-xs">ESC</span>
        </div>
      </div>

      <Command.List className="max-h-[60vh] overflow-y-auto overflow-x-hidden p-2 scroll-py-2">
        <Command.Empty className="py-6 text-center text-text-secondary">
          No results found.
        </Command.Empty>

        {/* General Navigation */}
        <Command.Group heading="Navigation" className="text-xs font-semibold text-text-tertiary mb-2 px-2">
          <Command.Item
            onSelect={() => runCommand(() => { setCurrentView('notes'); window.history.pushState(null, '', '/') })}
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-text-primary aria-selected:bg-primary-50 aria-selected:text-primary-600 dark:aria-selected:bg-primary-500/10 dark:aria-selected:text-primary-100 cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>Go to Notes</span>
          </Command.Item>
          <Command.Item
            onSelect={() => runCommand(() => { setCurrentView('papers'); window.history.pushState(null, '', '/papers') })}
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-text-primary aria-selected:bg-primary-50 aria-selected:text-primary-600 dark:aria-selected:bg-primary-500/10 dark:aria-selected:text-primary-100 cursor-pointer"
          >
            <BookOpen className="w-4 h-4" />
            <span>Go to Papers</span>
          </Command.Item>
          <Command.Item
            onSelect={() => runCommand(() => { setCurrentView('ideas'); window.history.pushState(null, '', '/ideas') })}
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-text-primary aria-selected:bg-primary-50 aria-selected:text-primary-600 dark:aria-selected:bg-primary-500/10 dark:aria-selected:text-primary-100 cursor-pointer"
          >
            <Lightbulb className="w-4 h-4" />
            <span>Go to Ideas</span>
          </Command.Item>
          <Command.Item
            onSelect={() => runCommand(() => { setCurrentView('tasks'); window.history.pushState(null, '', '/tasks') })}
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-text-primary aria-selected:bg-primary-50 aria-selected:text-primary-600 dark:aria-selected:bg-primary-500/10 dark:aria-selected:text-primary-100 cursor-pointer"
          >
            <CheckSquare className="w-4 h-4" />
            <span>Go to Tasks</span>
          </Command.Item>
          <Command.Item
            onSelect={() => runCommand(() => { setCurrentView('focus'); window.history.pushState(null, '', '/focus') })}
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-text-primary aria-selected:bg-primary-50 aria-selected:text-primary-600 dark:aria-selected:bg-primary-500/10 dark:aria-selected:text-primary-100 cursor-pointer"
          >
            <Target className="w-4 h-4" />
            <span>Go to Focus</span>
          </Command.Item>
        </Command.Group>

        <Command.Separator className="h-px bg-border-subtle my-2" />

        {/* Quick Actions */}
        <Command.Group heading="Actions" className="text-xs font-semibold text-text-tertiary mb-2 px-2">
           {/* We can't easily "Create New Note" from here without triggering logic in sidebar,
               but we can navigate to the view.
               Ideally we would have a global 'createNote' function exposed, but for now let's just do Theme. */}
          <Command.Item
            onSelect={() => runCommand(() => setTheme(effectiveTheme === 'light' ? 'dark' : 'light'))}
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-text-primary aria-selected:bg-primary-50 aria-selected:text-primary-600 dark:aria-selected:bg-primary-500/10 dark:aria-selected:text-primary-100 cursor-pointer"
          >
            {effectiveTheme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            <span>Toggle Theme</span>
          </Command.Item>
        </Command.Group>

        {/* Results */}
        {filteredNotes.length > 0 && (
          <>
            <Command.Separator className="h-px bg-border-subtle my-2" />
            <Command.Group heading="Notes" className="text-xs font-semibold text-text-tertiary mb-2 px-2">
              {filteredNotes.map(note => (
                <Command.Item
                  key={note.id}
                  onSelect={() => runCommand(() => {
                    setCurrentView('notes')
                    setSelectedNote(note)
                    window.history.pushState(null, '', `/notes/${note.id}`)
                  })}
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-text-primary aria-selected:bg-primary-50 aria-selected:text-primary-600 dark:aria-selected:bg-primary-500/10 dark:aria-selected:text-primary-100 cursor-pointer"
                >
                  <FileText className="w-4 h-4 opacity-50" />
                  <span className="truncate">{note.title || 'Untitled Note'}</span>
                </Command.Item>
              ))}
            </Command.Group>
          </>
        )}

        {filteredPapers.length > 0 && (
          <>
            <Command.Separator className="h-px bg-border-subtle my-2" />
            <Command.Group heading="Papers" className="text-xs font-semibold text-text-tertiary mb-2 px-2">
              {filteredPapers.map(paper => (
                <Command.Item
                  key={paper.id}
                  onSelect={() => runCommand(() => {
                    setCurrentView('papers')
                    setSelectedPaper(paper)
                    window.history.pushState(null, '', `/papers/${paper.id}`)
                  })}
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-text-primary aria-selected:bg-primary-50 aria-selected:text-primary-600 dark:aria-selected:bg-primary-500/10 dark:aria-selected:text-primary-100 cursor-pointer"
                >
                  <BookOpen className="w-4 h-4 opacity-50" />
                  <span className="truncate">{paper.title}</span>
                </Command.Item>
              ))}
            </Command.Group>
          </>
        )}

        {filteredIdeas.length > 0 && (
          <>
            <Command.Separator className="h-px bg-border-subtle my-2" />
            <Command.Group heading="Ideas" className="text-xs font-semibold text-text-tertiary mb-2 px-2">
              {filteredIdeas.map(idea => (
                <Command.Item
                  key={idea.id}
                  onSelect={() => runCommand(() => {
                    setCurrentView('ideas')
                    setSelectedIdea(idea)
                    window.history.pushState(null, '', `/ideas/${idea.id}`)
                  })}
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-text-primary aria-selected:bg-primary-50 aria-selected:text-primary-600 dark:aria-selected:bg-primary-500/10 dark:aria-selected:text-primary-100 cursor-pointer"
                >
                  <Lightbulb className="w-4 h-4 opacity-50" />
                  <span className="truncate">{idea.title}</span>
                </Command.Item>
              ))}
            </Command.Group>
          </>
        )}

      </Command.List>
    </Command.Dialog>
  )
}

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { Plus, Search, FileText, X } from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import { useNotes } from '../../hooks/useNotes'
import { MarkdownEditor } from '../editor/MarkdownEditor'
import { NoteCard } from './NoteCard'
import { ConfirmDialog, useConfirmDialog } from '../ui/ConfirmDialog'
import { ListSkeleton } from '../ui/Skeleton'
import type { Note } from '../../types/database'
import { toast } from 'sonner'

export function NotesView() {
  const { notes, selectedNote, setSelectedNote, notesLoading } = useAppStore()
  const { createNote, deleteNote, restoreNote } = useNotes(useAppStore.getState().user?.id)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const { confirm, isOpen, config } = useConfirmDialog()

  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastDeletedRef = useRef<Note | null>(null)

  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current)
      }
    }
  }, [])

  const filteredNotes = useMemo(() => {
    // Optimization: Skip filtering if query is empty
    if (!searchQuery) return notes

    // Optimization: Calculate query lowercasing once outside the loop to avoid redundant operations
    const query = searchQuery.toLowerCase()
    return notes.filter(note => {
      return (
        (note.title && note.title.toLowerCase().includes(query)) ||
        (note.markdown_body && note.markdown_body.toLowerCase().includes(query))
      )
    })
  }, [notes, searchQuery])

  const handleCreateNote = async () => {
    const newNote = await createNote({
      title: '',
      markdown_body: '',
    })
    if (newNote) {
      setSelectedNote(newNote)
    }
  }

  const handleDeleteWithUndo = useCallback(async (noteId: string) => {
    // Optimization: Access state directly to prevent function recreation when notes array changes
    const note = useAppStore.getState().notes.find(n => n.id === noteId)
    const success = await deleteNote(noteId)

    if (success && note) {
      lastDeletedRef.current = note
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current)
      }

      // Optimization: Access state directly to keep callback stable and avoid re-renders
      const currentSelected = useAppStore.getState().selectedNote
      if (currentSelected?.id === noteId) {
        setSelectedNote(null)
      }

      const toastId = toast.success('Note deleted', {
        description: 'Undo within 6 seconds to restore it.',
        duration: 6000,
        action: {
          label: 'Undo',
          onClick: async () => {
            if (lastDeletedRef.current) {
              await restoreNote(lastDeletedRef.current)
              lastDeletedRef.current = null
              if (undoTimeoutRef.current) {
                clearTimeout(undoTimeoutRef.current)
                undoTimeoutRef.current = null
              }
              toast.dismiss(toastId)
            }
          },
        },
      })

      undoTimeoutRef.current = setTimeout(() => {
        lastDeletedRef.current = null
        toast.dismiss(toastId)
        undoTimeoutRef.current = null
      }, 6000)
    }
  }, [deleteNote, restoreNote, setSelectedNote])

  const handleDeleteNote = useCallback(async (noteId: string) => {
    const shouldDelete = await confirm({
      title: 'Delete Note',
      message: 'Are you sure you want to delete this note?',
      variant: 'danger',
      confirmText: 'Delete'
    })

    if (shouldDelete) {
      await handleDeleteWithUndo(noteId)
    }
  }, [confirm, handleDeleteWithUndo])

  const handleSelectNote = useCallback((note: Note) => {
     setSelectedNote(note)
  }, [setSelectedNote])

  return (
    <div className="flex h-full bg-white dark:bg-slate-950">
      {/* Notes List Sidebar */}
      <div className="w-80 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Notes</h2>
            <button
              onClick={handleCreateNote}
              className="p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              aria-label="Create new note"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-10 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Search notes"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('')
                  searchInputRef.current?.focus()
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {notesLoading ? (
            <div className="p-4">
              <ListSkeleton count={6} itemType="note" />
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">
              <p className="text-sm">No notes found</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredNotes.map((note) => (
                <NoteCard
                    key={note.id}
                    note={note}
                    isSelected={selectedNote?.id === note.id}
                    onSelect={handleSelectNote}
                    onDelete={handleDeleteNote}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-slate-950">
        {selectedNote ? (
          <MarkdownEditor />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Select a note</h3>
            <p className="max-w-xs text-sm">
              Choose a note from the sidebar to start editing, or create a new one.
            </p>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={isOpen}
        onClose={config.onClose || (() => {})}
        onConfirm={config.onConfirm || (() => {})}
        title={config.title || ''}
        message={config.message || ''}
        confirmText={config.confirmText}
        cancelText={config.cancelText}
        variant={config.variant}
        isLoading={config.isLoading}
      />
    </div>
  )
}

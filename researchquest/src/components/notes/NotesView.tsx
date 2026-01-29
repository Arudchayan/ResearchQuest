import { useState } from 'react'
import { Plus, Search, FileText, Trash2, Clock } from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import { useNotes } from '../../hooks/useNotes'
import { MarkdownEditor } from '../editor/MarkdownEditor'
import { cn } from '../../lib/utils'
import { formatDistanceToNow } from 'date-fns'

export function NotesView() {
  const { notes, selectedNote, setSelectedNote } = useAppStore()
  const { createNote, deleteNote } = useNotes(useAppStore.getState().user?.id)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredNotes = notes.filter(note => {
    const query = searchQuery.toLowerCase()
    return (
      (note.title && note.title.toLowerCase().includes(query)) ||
      (note.markdown_body && note.markdown_body.toLowerCase().includes(query))
    )
  })

  const handleCreateNote = async () => {
    const newNote = await createNote({
      title: '',
      markdown_body: '',
    })
    if (newNote) {
      setSelectedNote(newNote)
    }
  }

  const handleDeleteNote = async (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation()
    if (window.confirm('Are you sure you want to delete this note?')) {
      await deleteNote(noteId)
      if (selectedNote?.id === noteId) {
        setSelectedNote(null)
      }
    }
  }

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
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredNotes.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">
              <p className="text-sm">No notes found</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredNotes.map((note) => (
                <div
                  key={note.id}
                  onClick={() => setSelectedNote(note)}
                  className={cn(
                    "group p-4 cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-colors",
                    selectedNote?.id === note.id ? "bg-white dark:bg-slate-800 border-l-4 border-blue-500" : "border-l-4 border-transparent"
                  )}
                >
                  <div className="flex items-start justify-between mb-1">
                    <h3 className={cn(
                      "font-medium truncate pr-2",
                      !note.title ? "text-slate-400 italic" : "text-slate-900 dark:text-slate-100"
                    )}>
                      {note.title || 'Untitled Note'}
                    </h3>
                    <button
                      onClick={(e) => handleDeleteNote(e, note.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2 h-8">
                    {note.markdown_body || 'No content...'}
                  </p>

                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <Clock className="w-3 h-3" />
                    <span>{formatDistanceToNow(new Date(note.updated_at), { addSuffix: true })}</span>
                  </div>
                </div>
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
    </div>
  )
}

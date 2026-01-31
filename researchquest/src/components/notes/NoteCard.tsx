import React from 'react'
import { Trash2, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '../../lib/utils'
import type { Note } from '../../types/database'

interface NoteCardProps {
  note: Note
  isSelected: boolean
  onSelect: (note: Note) => void
  onDelete: (noteId: string) => void
}

export const NoteCard = React.memo(function NoteCard({
  note,
  isSelected,
  onSelect,
  onDelete
}: NoteCardProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(note.id)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(note)
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Select note: ${note.title || 'Untitled Note'}`}
      onClick={() => onSelect(note)}
      onKeyDown={handleKeyDown}
      className={cn(
        "group p-4 cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500",
        isSelected ? "bg-white dark:bg-slate-800 border-l-4 border-blue-500" : "border-l-4 border-transparent"
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
          onClick={handleDelete}
          aria-label="Delete note"
          className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-all focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
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
  )
})

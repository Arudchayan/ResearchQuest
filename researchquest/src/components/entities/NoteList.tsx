import { useState, memo, useCallback } from 'react'
import { Clock, Hash, Link2, Trash2, FileText } from 'lucide-react'
import type { Note } from '../../types/database'
import { useAppStore } from '../../store/appStore'

interface NoteCardProps {
  note: Note
  onSelect: (note: Note) => void
  onDelete: (id: string) => void
  isSelected: boolean
}

const NoteCardComponent = ({ note, onSelect, onDelete, isSelected }: NoteCardProps) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  
  // Extract title from markdown or use first line
  const title = note.title || note.markdown_body.split('\n')[0]?.replace(/^#+ /, '').trim() || 'Untitled Note'
  const preview = note.markdown_body.slice(0, 100) + (note.markdown_body.length > 100 ? '...' : '')
  
  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (showDeleteConfirm) {
      onDelete(note.id)
    } else {
      setShowDeleteConfirm(true)
      setTimeout(() => setShowDeleteConfirm(false), 3000)
    }
  }, [showDeleteConfirm, onDelete, note.id])
  
  const handleSelect = useCallback(() => {
    onSelect(note)
  }, [onSelect, note])
  
  return (
    <div
      onClick={handleSelect}
      className={`p-3 rounded-md border cursor-pointer transition-all ${
        isSelected
          ? 'bg-bg-elevated border-primary-500'
          : 'bg-bg-surface border-border-subtle hover:border-border-moderate hover:shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <FileText className="w-4 h-4 text-text-tertiary flex-shrink-0" />
          <h4 className="text-small font-semibold text-text-primary truncate">{title}</h4>
        </div>
        <button
          onClick={handleDelete}
          className={`p-1 rounded hover:bg-bg-elevated transition-colors flex-shrink-0 ${
            showDeleteConfirm ? 'text-red-500' : 'text-text-tertiary'
          }`}
          title={showDeleteConfirm ? 'Click again to confirm' : 'Delete note'}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      
      <p className="text-caption text-text-secondary line-clamp-2 mb-2">{preview}</p>
      
      <div className="flex items-center gap-3 text-caption text-text-tertiary">
        {note.tags && note.tags.length > 0 && (
          <div className="flex items-center gap-1">
            <Hash className="w-3 h-3" />
            <span>{note.tags.length}</span>
          </div>
        )}
        {note.linked_entity_ids && note.linked_entity_ids.length > 0 && (
          <div className="flex items-center gap-1">
            <Link2 className="w-3 h-3" />
            <span>{note.linked_entity_ids.length}</span>
          </div>
        )}
        <div className="flex items-center gap-1 ml-auto">
          <Clock className="w-3 h-3" />
          <span>{new Date(note.updated_at).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  )
}

export const NoteCard = memo(NoteCardComponent)

interface NoteListProps {
  notes: Note[]
  onSelectNote: (note: Note) => void
  onDeleteNote: (id: string) => void
  selectedNoteId?: string
}

export function NoteList({ notes, onSelectNote, onDeleteNote, selectedNoteId }: NoteListProps) {
  if (notes.length === 0) {
    return (
      <div className="text-center py-12 text-text-tertiary">
        <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-small">No notes yet</p>
        <p className="text-caption mt-1">Create your first note above</p>
      </div>
    )
  }
  
  return (
    <div className="space-y-2">
      {notes.map((note) => (
        <NoteCard
          key={note.id}
          note={note}
          onSelect={onSelectNote}
          onDelete={onDeleteNote}
          isSelected={note.id === selectedNoteId}
        />
      ))}
    </div>
  )
}

import { useState, memo, useCallback, useMemo, useRef, useEffect } from 'react'
import { Clock, Hash, Link2, Trash2, FileText } from 'lucide-react'
import type { Note } from '../../types/database'
import { ListSkeleton } from '../ui/Skeleton'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { toast } from 'sonner'
import { highlightMatch } from '../../utils/highlight'

interface NoteCardProps {
  note: Note
  onSelect: (note: Note) => void
  onDelete: (note: Note) => void
  isSelected: boolean
  searchQuery?: string
}

const NoteCardComponent = ({ note, onSelect, onDelete, isSelected, searchQuery = '' }: NoteCardProps) => {
  // Extract title from markdown or use first line
  const title = note.title || note.markdown_body.split('\n')[0]?.replace(/^#+ /, '').trim() || 'Untitled Note'
  const preview = note.markdown_body.slice(0, 100) + (note.markdown_body.length > 100 ? '...' : '')

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(note)
  }, [onDelete, note])
  
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
          <h4 className="text-small font-semibold text-text-primary truncate">
            {highlightMatch(title, searchQuery)}
          </h4>
        </div>
        <button
          onClick={handleDelete}
          className="p-1 rounded hover:bg-bg-elevated transition-colors flex-shrink-0 text-text-tertiary"
          title="Delete note"
          aria-label="Delete note"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <p className="text-caption text-text-secondary line-clamp-2 mb-2">
        {highlightMatch(preview, searchQuery)}
      </p>
      
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
  onDeleteNote: (note: Note) => Promise<boolean>
  onRestoreNote: (note: Note) => Promise<Note | null>
  selectedNoteId?: string
  selectedNote?: Note | null
  loading?: boolean
  searchQuery?: string
}

export function NoteList({
  notes,
  onSelectNote,
  onDeleteNote,
  onRestoreNote,
  selectedNoteId,
  selectedNote,
  loading = false,
  searchQuery = '',
}: NoteListProps) {
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null)
  const [deleting, setDeleting] = useState(false)
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastDeletedRef = useRef<Note | null>(null)

  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current)
      }
    }
  }, [])

  const mergedNotes = useMemo(
    () =>
      notes.map((note) => {
        if (selectedNote && note.id === selectedNote.id) {
          return { ...note, ...selectedNote }
        }
        return note
      }),
    [notes, selectedNote]
  )

  const emptyState = useMemo(() => {
    if (notes.length > 0) {
      return null
    }

    if (searchQuery) {
      return (
        <div className="text-center py-12 text-text-tertiary">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-small font-semibold text-text-secondary">No matches found</p>
          <p className="text-caption mt-1">Try a different keyword or clear your search.</p>
        </div>
      )
    }

    return (
      <div className="text-center py-12 text-text-tertiary">
        <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-small">No notes yet</p>
        <p className="text-caption mt-1">Create your first note above</p>
      </div>
    )
  }, [notes.length, searchQuery])

  const handleDeleteRequest = useCallback((candidate: Note) => {
    setNoteToDelete(candidate)
  }, [])

  const handleConfirmDelete = useCallback(async () => {
    if (!noteToDelete) return
    setDeleting(true)
    const note = noteToDelete
    const success = await onDeleteNote(note)
    setDeleting(false)
    setNoteToDelete(null)

    if (success) {
      lastDeletedRef.current = note
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current)
      }

      const toastId = toast.success('Note deleted', {
        description: 'Undo within 6 seconds to restore it.',
        duration: 6000,
        action: {
          label: 'Undo',
          onClick: async () => {
            if (lastDeletedRef.current) {
              await onRestoreNote(lastDeletedRef.current)
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
  }, [noteToDelete, onDeleteNote, onRestoreNote])

  if (loading) {
    return <ListSkeleton count={5} itemType="note" />
  }

  if (emptyState) {
    return emptyState
  }

  return (
    <>
      <div className="space-y-2">
        {mergedNotes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            onSelect={onSelectNote}
            onDelete={handleDeleteRequest}
            isSelected={note.id === selectedNoteId}
            searchQuery={searchQuery}
          />
        ))}
      </div>

      <ConfirmDialog
        isOpen={Boolean(noteToDelete)}
        onClose={() => {
          if (!deleting) {
            setNoteToDelete(null)
          }
        }}
        onConfirm={() => {
          void handleConfirmDelete()
        }}
        title="Delete note"
        message={`Are you sure you want to delete "${noteToDelete?.title || noteToDelete?.markdown_body.split('\n')[0] || 'Untitled Note'}"? You can undo for a short time after deleting.`}
        confirmText="Delete"
        cancelText="Cancel"
        isLoading={deleting}
      />
    </>
  )
}

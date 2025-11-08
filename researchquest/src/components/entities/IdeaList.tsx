import { useState } from 'react'
import { Clock, Lightbulb, Trash2, TrendingUp } from 'lucide-react'
import type { Idea, IdeaStage } from '../../types/database'
import { ListSkeleton } from '../ui/Skeleton'

interface IdeaCardProps {
  idea: Idea
  onSelect: (idea: Idea) => void
  onDelete: (id: string) => void
  onStageChange: (id: string, stage: IdeaStage, oldStage: IdeaStage) => void
  isSelected: boolean
}

export function IdeaCard({ idea, onSelect, onDelete, onStageChange, isSelected }: IdeaCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (showDeleteConfirm) {
      onDelete(idea.id)
    } else {
      setShowDeleteConfirm(true)
      setTimeout(() => setShowDeleteConfirm(false), 3000)
    }
  }
  
  const getStageColor = (stage: IdeaStage) => {
    switch (stage) {
      case 'Seed':
        return 'bg-warning-bg text-warning border-warning'
      case 'Developing':
        return 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400'
      case 'Supported':
        return 'bg-purple-bg text-purple border-purple'
      case 'Mature':
        return 'bg-success-bg text-success border-success'
    }
  }
  
  return (
    <div
      onClick={() => onSelect(idea)}
      className={`p-3 rounded-md border cursor-pointer transition-all ${
        isSelected
          ? 'bg-bg-elevated border-primary-500'
          : 'bg-bg-surface border-border-subtle hover:border-border-moderate hover:shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Lightbulb className="w-4 h-4 text-text-tertiary flex-shrink-0" />
          <h4 className="text-small font-semibold text-text-primary line-clamp-2">{idea.title}</h4>
        </div>
        <button
          onClick={handleDelete}
          className={`p-1 rounded hover:bg-bg-elevated transition-colors flex-shrink-0 ${
            showDeleteConfirm ? 'text-red-500' : 'text-text-tertiary'
          }`}
          title={showDeleteConfirm ? 'Click again to confirm' : 'Delete idea'}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      
      {idea.description && (
        <p className="text-caption text-text-secondary line-clamp-2 mb-2">{idea.description}</p>
      )}
      
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={idea.stage}
          onChange={(e) => {
            e.stopPropagation()
            onStageChange(idea.id, e.target.value as IdeaStage, idea.stage)
          }}
          className={`px-2 py-1 text-caption rounded-md border ${getStageColor(idea.stage)} transition-colors font-medium`}
          onClick={(e) => e.stopPropagation()}
        >
          <option value="Seed">Seed</option>
          <option value="Developing">Developing</option>
          <option value="Supported">Supported</option>
          <option value="Mature">Mature</option>
        </select>
        
        {(idea.linked_note_ids?.length || 0) + (idea.linked_paper_ids?.length || 0) > 0 && (
          <div className="flex items-center gap-1 text-caption text-text-tertiary">
            <TrendingUp className="w-3 h-3" />
            <span>{(idea.linked_note_ids?.length || 0) + (idea.linked_paper_ids?.length || 0)} connections</span>
          </div>
        )}
        
        <div className="flex items-center gap-1 ml-auto text-caption text-text-tertiary">
          <Clock className="w-3 h-3" />
          <span>{new Date(idea.updated_at).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  )
}

interface IdeaListProps {
  ideas: Idea[]
  onSelectIdea: (idea: Idea) => void
  onDeleteIdea: (id: string) => void
  onStageChange: (id: string, stage: IdeaStage, oldStage: IdeaStage) => void
  selectedIdeaId?: string
  loading?: boolean
}

export function IdeaList({ ideas, onSelectIdea, onDeleteIdea, onStageChange, selectedIdeaId, loading = false }: IdeaListProps) {
  if (loading) {
    return <ListSkeleton count={5} itemType="idea" />
  }
  
  if (ideas.length === 0) {
    return (
      <div className="text-center py-12 text-text-tertiary">
        <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-small">No ideas yet</p>
        <p className="text-caption mt-1">Create your first idea above</p>
      </div>
    )
  }
  
  return (
    <div className="space-y-2">
      {ideas.map((idea) => (
        <IdeaCard
          key={idea.id}
          idea={idea}
          onSelect={onSelectIdea}
          onDelete={onDeleteIdea}
          onStageChange={onStageChange}
          isSelected={idea.id === selectedIdeaId}
        />
      ))}
    </div>
  )
}

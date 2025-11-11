import { useState, useEffect } from 'react'
import { Lightbulb, Calendar, TrendingUp, Edit2, Save, X } from 'lucide-react'
import type { Idea, IdeaStage } from '../../types/database'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import { TopicSelector } from '../topics/TopicSelector'

interface IdeaDetailViewProps {
  idea: Idea
  onUpdate: (ideaId: string, updates: Partial<Idea>, oldStage?: IdeaStage) => Promise<boolean>
}

export function IdeaDetailView({ idea, onUpdate }: IdeaDetailViewProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedTitle, setEditedTitle] = useState(idea.title)
  const [editedDescription, setEditedDescription] = useState(idea.description || '')
  const [editedStage, setEditedStage] = useState(idea.stage)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    setEditedTitle(idea.title)
    setEditedDescription(idea.description || '')
    setEditedStage(idea.stage)
    setIsEditing(false)
    setSaveError('')
  }, [idea.id, idea.title, idea.description, idea.stage])

  const handleSave = async () => {
    const nextTitle = editedTitle.trim()
    const nextDescription = editedDescription.trim()

    if (!nextTitle) {
      setSaveError('Title is required to save changes.')
      return
    }

    const updates: Partial<Idea> = {}
    if (nextTitle !== idea.title) {
      updates.title = nextTitle
    }

    const currentDescription = (idea.description || '').trim()
    if (nextDescription !== currentDescription) {
      updates.description = nextDescription
    }

    if (editedStage !== idea.stage) {
      updates.stage = editedStage
    }

    if (Object.keys(updates).length === 0) {
      setSaveError('No changes to save yet.')
      return
    }

    setSaving(true)
    setSaveError('')
    const success = await onUpdate(idea.id, updates, idea.stage)
    setSaving(false)

    if (success) {
      const stageChanged = updates.stage && updates.stage !== idea.stage
      const hasContentUpdates = Object.keys(updates).some((key) => key !== 'stage')
      setIsEditing(false)
      if (hasContentUpdates || !stageChanged) {
        toast.success('Idea updated successfully')
      }
    } else {
      setSaveError('Unable to save changes. Please try again.')
    }
  }

  const handleCancel = () => {
    setEditedTitle(idea.title)
    setEditedDescription(idea.description || '')
    setEditedStage(idea.stage)
    setIsEditing(false)
    setSaveError('')
  }
  
  const getStageColor = (stage: IdeaStage) => {
    switch (stage) {
      case 'Seed':
        return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700'
      case 'Developing':
        return 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700'
      case 'Supported':
        return 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-300 dark:border-purple-700'
      case 'Mature':
        return 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700'
    }
  }
  
  const getStageDescription = (stage: IdeaStage) => {
    switch (stage) {
      case 'Seed':
        return 'Initial concept or thought - needs exploration and development'
      case 'Developing':
        return 'Actively being explored and refined with research backing'
      case 'Supported':
        return 'Well-researched with evidence supporting the concept'
      case 'Mature':
        return 'Fully developed idea ready for implementation or publication'
    }
  }
  
  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="bg-bg-surface rounded-lg border border-border-subtle shadow-sm">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-border-subtle">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 flex-1">
              <div className="p-3 bg-bg-elevated rounded-lg">
                <Lightbulb className="w-6 h-6 text-primary-500" />
              </div>
              {isEditing ? (
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="flex-1 text-2xl font-bold text-text-primary bg-bg-base border border-border-subtle rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Idea title..."
                />
              ) : (
                <h1 className="text-2xl font-bold text-text-primary">{idea.title}</h1>
              )}
            </div>
            
            <div className="flex items-center gap-2 md:self-start">
              {isEditing ? (
                <>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="p-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    title="Save changes"
                  >
                    <Save className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handleCancel}
                    className="p-2 bg-bg-elevated text-text-secondary rounded-md hover:bg-bg-base transition-colors"
                    title="Cancel"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-2 bg-bg-elevated text-text-secondary rounded-md hover:bg-bg-base transition-colors"
                  title="Edit idea"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
          
          {/* Stage Selector */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-text-secondary">
              Development Stage
            </label>
            {isEditing ? (
              <select
                value={editedStage}
                onChange={(e) => setEditedStage(e.target.value as IdeaStage)}
                className={`px-4 py-2 rounded-md border text-sm font-medium ${getStageColor(editedStage)} focus:outline-none focus:ring-2 focus:ring-primary-500`}
              >
                <option value="Seed">🌱 Seed</option>
                <option value="Developing">🌿 Developing</option>
                <option value="Supported">🌳 Supported</option>
                <option value="Mature">🏆 Mature</option>
              </select>
            ) : (
              <div>
                <div className={`inline-flex items-center px-4 py-2 rounded-md border text-sm font-medium ${getStageColor(idea.stage)}`}>
                  {idea.stage === 'Seed' && '🌱'}
                  {idea.stage === 'Developing' && '🌿'}
                  {idea.stage === 'Supported' && '🌳'}
                  {idea.stage === 'Mature' && '🏆'}
                  <span className="ml-2">{idea.stage}</span>
                </div>
                <p className="text-sm text-text-tertiary mt-2">{getStageDescription(idea.stage)}</p>
              </div>
            )}
            {saveError && isEditing && (
              <p className="text-sm text-destructive">{saveError}</p>
            )}
          </div>
        </div>
        
        {/* Description */}
        <div className="p-4 sm:p-6 border-b border-border-subtle">
          <h2 className="text-lg font-semibold text-text-primary mb-3">Description</h2>
          {isEditing ? (
            <textarea
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              rows={8}
              className="w-full px-4 py-3 bg-bg-base border border-border-subtle rounded-md text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              placeholder="Describe your idea in detail..."
            />
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              {idea.description ? (
                <p className="text-body text-text-secondary whitespace-pre-wrap">{idea.description}</p>
              ) : (
                <p className="text-body text-text-tertiary italic">No description yet. Click edit to add one.</p>
              )}
            </div>
          )}
        </div>

        <div className="p-4 sm:p-6 border-b border-border-subtle">
          <TopicSelector entityId={idea.id} entityType="idea" />
        </div>

        {/* Metadata */}
        <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-text-tertiary">
              <Calendar className="w-4 h-4" />
              <span className="text-sm font-medium">Created</span>
            </div>
            <p className="text-text-primary">{new Date(idea.created_at).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</p>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-text-tertiary">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-medium">Last Updated</span>
            </div>
            <p className="text-text-primary">{new Date(idea.updated_at).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</p>
          </div>
          
          {(idea.linked_note_ids?.length || idea.linked_paper_ids?.length) && (
            <div className="col-span-full space-y-1">
              <div className="flex items-center gap-2 text-text-tertiary">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm font-medium">Connections</span>
              </div>
              <p className="text-text-secondary">
                {idea.linked_note_ids?.length || 0} notes, {idea.linked_paper_ids?.length || 0} papers
              </p>
            </div>
          )}
        </div>
      </div>
      
      {/* Tips Card */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">💡 Tip: Develop Your Idea</h3>
        <p className="text-sm text-blue-800 dark:text-blue-400">
          Progress your idea through stages as you gather evidence and develop it further. 
          Link related papers and notes to build a strong foundation for your research.
        </p>
      </div>
    </div>
  )
}

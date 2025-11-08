import { useState, useEffect } from 'react'
import { BookOpen, Calendar, ExternalLink, Edit2, Save, X, Link as LinkIcon } from 'lucide-react'
import type { Paper, ReadingStatus } from '../../types/database'
import { toast } from 'sonner'

interface PaperDetailViewProps {
  paper: Paper
  onUpdate: (paperId: string, updates: Partial<Paper>) => Promise<boolean>
}

export function PaperDetailView({ paper, onUpdate }: PaperDetailViewProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedTitle, setEditedTitle] = useState(paper.title)
  const [editedAuthors, setEditedAuthors] = useState(paper.authors.join(', '))
  const [editedAbstract, setEditedAbstract] = useState(paper.abstract || '')
  const [editedStatus, setEditedStatus] = useState(paper.status)
  
  useEffect(() => {
    setEditedTitle(paper.title)
    setEditedAuthors(paper.authors.join(', '))
    setEditedAbstract(paper.abstract || '')
    setEditedStatus(paper.status)
    setIsEditing(false)
  }, [paper.id, paper.title, paper.authors, paper.abstract, paper.status])
  
  const handleSave = async () => {
    const updates: Partial<Paper> = {
      title: editedTitle,
      authors: editedAuthors.split(',').map(a => a.trim()).filter(Boolean),
      abstract: editedAbstract || undefined,
      status: editedStatus,
    }
    
    const success = await onUpdate(paper.id, updates)
    if (success) {
      setIsEditing(false)
      toast.success('Paper updated successfully')
    }
  }
  
  const handleCancel = () => {
    setEditedTitle(paper.title)
    setEditedAuthors(paper.authors.join(', '))
    setEditedAbstract(paper.abstract || '')
    setEditedStatus(paper.status)
    setIsEditing(false)
  }
  
  const getStatusColor = (status: ReadingStatus) => {
    switch (status) {
      case 'Read':
        return 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700'
      case 'Reading':
        return 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700'
      default:
        return 'bg-gray-100 dark:bg-gray-900/20 text-gray-700 dark:text-gray-400 border-gray-300 dark:border-gray-700'
    }
  }
  
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-bg-surface rounded-lg border border-border-subtle shadow-sm">
        {/* Header */}
        <div className="p-6 border-b border-border-subtle">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="p-3 bg-bg-elevated rounded-lg">
                <BookOpen className="w-6 h-6 text-primary-500" />
              </div>
              {isEditing ? (
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="flex-1 text-2xl font-bold text-text-primary bg-bg-base border border-border-subtle rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Paper title..."
                />
              ) : (
                <h1 className="text-2xl font-bold text-text-primary">{paper.title}</h1>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <button
                    onClick={handleSave}
                    className="p-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors"
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
                  title="Edit paper"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
          
          {/* Authors */}
          <div className="space-y-2 mb-4">
            <label className="block text-sm font-medium text-text-secondary">
              Authors
            </label>
            {isEditing ? (
              <input
                type="text"
                value={editedAuthors}
                onChange={(e) => setEditedAuthors(e.target.value)}
                className="w-full px-4 py-2 bg-bg-base border border-border-subtle rounded-md text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Author 1, Author 2, et al."
              />
            ) : (
              <p className="text-lg text-text-secondary">{paper.authors.join(', ')}</p>
            )}
          </div>
          
          {/* Status Selector */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-text-secondary">
              Reading Status
            </label>
            {isEditing ? (
              <select
                value={editedStatus}
                onChange={(e) => setEditedStatus(e.target.value as ReadingStatus)}
                className={`px-4 py-2 rounded-md border text-sm font-medium ${getStatusColor(editedStatus)} focus:outline-none focus:ring-2 focus:ring-primary-500`}
              >
                <option value="To Read">📚 To Read</option>
                <option value="Reading">📖 Reading</option>
                <option value="Read">✅ Read</option>
              </select>
            ) : (
              <div className={`inline-flex items-center px-4 py-2 rounded-md border text-sm font-medium ${getStatusColor(paper.status)}`}>
                {paper.status === 'To Read' && '📚'}
                {paper.status === 'Reading' && '📖'}
                {paper.status === 'Read' && '✅'}
                <span className="ml-2">{paper.status}</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Abstract */}
        {(paper.abstract || isEditing) && (
          <div className="p-6 border-b border-border-subtle">
            <h2 className="text-lg font-semibold text-text-primary mb-3">Abstract</h2>
            {isEditing ? (
              <textarea
                value={editedAbstract}
                onChange={(e) => setEditedAbstract(e.target.value)}
                rows={8}
                className="w-full px-4 py-3 bg-bg-base border border-border-subtle rounded-md text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                placeholder="Enter or paste the paper's abstract..."
              />
            ) : (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <p className="text-body text-text-secondary leading-relaxed whitespace-pre-wrap">
                  {paper.abstract}
                </p>
              </div>
            )}
          </div>
        )}
        
        {/* Metadata & Links */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {paper.publication_date && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-text-tertiary">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm font-medium">Publication Date</span>
                </div>
                <p className="text-text-primary">{paper.publication_date}</p>
              </div>
            )}
            
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-text-tertiary">
                <Calendar className="w-4 h-4" />
                <span className="text-sm font-medium">Added to Library</span>
              </div>
              <p className="text-text-primary">{new Date(paper.created_at).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</p>
            </div>
          </div>
          
          {/* External Links */}
          <div className="pt-4 border-t border-border-subtle">
            <div className="flex flex-wrap gap-3">
              {paper.doi && (
                <a
                  href={`https://doi.org/${paper.doi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors"
                >
                  <LinkIcon className="w-4 h-4" />
                  View DOI
                </a>
              )}
              {paper.source_url && (
                <a
                  href={paper.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-bg-elevated text-text-primary border border-border-subtle rounded-md hover:bg-bg-base transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  View Source
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Tips Card */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">💡 Pro Tip</h3>
        <p className="text-sm text-blue-800 dark:text-blue-400">
          Update the reading status as you progress through the paper. This helps track your research progress and earns you XP!
        </p>
      </div>
    </div>
  )
}

import React from 'react'
import { BookOpen, ExternalLink, Calendar } from 'lucide-react'
import type { Paper } from '../../types/database'

interface PaperCardProps {
  paper: Paper
  onSelect: (paper: Paper) => void
}

export const PaperCard = React.memo(function PaperCard({ paper, onSelect }: PaperCardProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(paper)
    }
  }

  const handleDoiClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Select paper: ${paper.title}`}
      onClick={() => onSelect(paper)}
      onKeyDown={handleKeyDown}
      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-5 cursor-pointer hover:border-blue-500 dark:hover:border-blue-500 transition-all hover:shadow-md group focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
          <BookOpen className="w-5 h-5" />
        </div>
        {paper.doi && (
          <a
            href={`https://doi.org/${paper.doi}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleDoiClick}
            className="text-xs text-slate-400 hover:text-blue-600 flex items-center gap-1"
          >
            DOI <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      <h3 className="font-semibold text-slate-900 dark:text-white mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
        {paper.title}
      </h3>

      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 line-clamp-2">
        {paper.authors?.join(', ') || 'Unknown Authors'}
      </p>

      <div className="flex items-center gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {/* Optimization: Parse year from string instead of full Date parsing */}
          <span>{paper.publication_date ? parseInt(paper.publication_date.substring(0, 4)) || 'N/A' : 'N/A'}</span>
        </div>
      </div>
    </div>
  )
})

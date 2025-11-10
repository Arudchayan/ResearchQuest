import { Loader2, Trash2, Notebook, BookOpen, Lightbulb } from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import type { TopicWithCounts } from '../../types/database'
import { useCallback } from 'react'

interface TopicListProps {
  topics: TopicWithCounts[]
  loading: boolean
  onSelectTopic: (topic: TopicWithCounts) => void
  onDeleteTopic: (topicId: string) => Promise<boolean>
}

export function TopicList({ topics, loading, onSelectTopic, onDeleteTopic }: TopicListProps) {
  const selectedTopic = useAppStore((state) => state.selectedTopic)

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>, topic: TopicWithCounts) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onSelectTopic(topic)
      }
    },
    [onSelectTopic]
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-text-tertiary">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="ml-2 text-small">Loading topics...</span>
      </div>
    )
  }

  if (!topics.length) {
    return (
      <div className="text-center py-12 text-text-tertiary">
        <p className="text-small">Create a topic to start organizing your research</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {topics.map((topic) => {
        const isActive = selectedTopic?.id === topic.id
        return (
          <div
            key={topic.id}
            role="button"
            tabIndex={0}
            aria-label={topic.name}
            onClick={() => onSelectTopic(topic)}
            onKeyDown={(event) => handleKeyDown(event, topic)}
            className={`w-full text-left px-4 py-3 rounded-md border transition-colors group focus:outline-none focus:ring-2 focus:ring-primary-500 ${
              isActive
                ? 'border-primary-500 bg-primary-500/10 text-text-primary'
                : 'border-border-subtle bg-bg-surface hover:border-primary-500/60 hover:bg-primary-500/5'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-small text-text-primary">{topic.name}</p>
                {topic.description && (
                  <p className="text-caption text-text-secondary mt-1 line-clamp-2">
                    {topic.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    if (confirm(`Delete "${topic.name}"? This will remove its links.`)) {
                      void onDeleteTopic(topic.id)
                    }
                  }}
                  aria-label={`Delete ${topic.name}`}
                  className="p-1 rounded-md bg-bg-elevated hover:bg-destructive/10 text-text-tertiary hover:text-destructive transition-colors"
                  title="Delete topic"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-caption text-text-secondary">
              <span className="inline-flex items-center gap-1">
                <Notebook className="w-3.5 h-3.5" />
                {topic.note_count} notes
              </span>
              <span className="inline-flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5" />
                {topic.paper_count} papers
              </span>
              <span className="inline-flex items-center gap-1">
                <Lightbulb className="w-3.5 h-3.5" />
                {topic.idea_count} ideas
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

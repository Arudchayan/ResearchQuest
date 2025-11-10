import { useEffect, useMemo, useState } from 'react'
import { Clock, Play, Pause, RotateCcw, Target, BookOpen, FileText, CheckSquare, Sparkles } from 'lucide-react'
import { useTasks } from '../../hooks/useTasks'
import { useAppStore } from '../../store/appStore'
import type { Note, Paper } from '../../types/database'
import type { Task } from '../../hooks/useTasks'
import { useWorkspaceData } from '../../context/WorkspaceDataContext'

interface FocusWorkspaceProps {
  userId: string | undefined
}

type FocusTargetType = 'note' | 'paper' | 'task'

interface SelectedTarget {
  type: FocusTargetType
  id: string
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function extractNoteSummary(note: Note) {
  const raw = note.title || note.markdown_body.split('\n')[0] || 'Untitled note'
  return raw.replace(/[#*_`>-]/g, '').trim() || 'Untitled note'
}

function extractNotePreview(note: Note) {
  const plain = note.markdown_body.replace(/[#*_`>-]/g, '').replace(/\[(.*?)\]\(.*?\)/g, '$1')
  return plain.trim().slice(0, 220) || 'No content yet. Use this focus block to capture your first thoughts.'
}

function extractPaperPreview(paper: Paper) {
  if (paper.abstract) {
    return paper.abstract
  }
  return 'No abstract saved yet. Add highlights once you complete this focus sprint.'
}

function extractTaskPreview(task: Task) {
  if (task.description) {
    return task.description
  }
  return 'Break this task into the next concrete step during your focus session.'
}

export function FocusWorkspace({ userId }: FocusWorkspaceProps) {
  const { notes, notesLoading, papers, papersLoading } = useWorkspaceData()
  const { tasks, loading: tasksLoading } = useTasks(userId)

  const setCurrentView = useAppStore((state) => state.setCurrentView)
  const setSelectedNote = useAppStore((state) => state.setSelectedNote)
  const setSelectedPaper = useAppStore((state) => state.setSelectedPaper)

  const [selectedTarget, setSelectedTarget] = useState<SelectedTarget | null>(null)
  const [sessionLength, setSessionLength] = useState(25 * 60)
  const [timeLeft, setTimeLeft] = useState(sessionLength)
  const [isRunning, setIsRunning] = useState(false)
  const [customMinutes, setCustomMinutes] = useState('')
  const [hasCompletedSession, setHasCompletedSession] = useState(false)

  useEffect(() => {
    setTimeLeft(sessionLength)
    setIsRunning(false)
    setHasCompletedSession(false)
  }, [sessionLength, selectedTarget?.id])

  useEffect(() => {
    if (!isRunning) return

    const timer = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer)
          setIsRunning(false)
          setHasCompletedSession(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [isRunning])

  const selectedItem = useMemo(() => {
    if (!selectedTarget) return null
    if (selectedTarget.type === 'note') {
      return notes.find((note) => note.id === selectedTarget.id) || null
    }
    if (selectedTarget.type === 'paper') {
      return papers.find((paper) => paper.id === selectedTarget.id) || null
    }
    if (selectedTarget.type === 'task') {
      return tasks.find((task) => task.id === selectedTarget.id) || null
    }
    return null
  }, [notes, papers, tasks, selectedTarget])

  const isLoading = notesLoading || papersLoading || tasksLoading
  const effectiveTimeLeft = Math.max(0, timeLeft)
  const progress = sessionLength > 0 ? (sessionLength - effectiveTimeLeft) / sessionLength : 0

  const quickTargets = useMemo(() => {
    return [
      {
        type: 'note' as FocusTargetType,
        title: 'Notes',
        description: 'Recently edited notes ready for synthesis',
        icon: FileText,
        items: notes.slice(0, 4).map((note) => ({
          id: note.id,
          title: extractNoteSummary(note),
          meta: new Date(note.updated_at).toLocaleDateString(),
        })),
      },
      {
        type: 'paper' as FocusTargetType,
        title: 'Papers',
        description: 'Papers waiting for a close read or annotation',
        icon: BookOpen,
        items: papers
          .filter((paper) => paper.status === 'To Read' || paper.status === 'Reading')
          .slice(0, 4)
          .map((paper) => ({
            id: paper.id,
            title: paper.title,
            meta: paper.publication_date ? new Date(paper.publication_date).getFullYear().toString() : 'No year',
          })),
      },
      {
        type: 'task' as FocusTargetType,
        title: 'Tasks',
        description: 'Upcoming commitments that benefit from deep work',
        icon: CheckSquare,
        items: tasks
          .filter((task) => !task.completed)
          .slice(0, 4)
          .map((task) => ({
            id: task.id,
            title: task.title,
            meta: task.due_date ? new Date(task.due_date).toLocaleString(undefined, { month: 'short', day: 'numeric' }) : 'No due date',
          })),
      },
    ]
  }, [notes, papers, tasks])

  const focusInsights = useMemo(() => {
    const insights: { title: string; detail: string }[] = []

    const unreadPapers = papers.filter((paper) => paper.status === 'To Read').length
    const inProgressTasks = tasks.filter((task) => !task.completed).length
    const notesWithoutTitles = notes.filter((note) => !note.title || note.title.trim() === '').length

    if (unreadPapers > 0) {
      insights.push({
        title: `${unreadPapers} paper${unreadPapers === 1 ? '' : 's'} waiting to be read`,
        detail: 'Pick one and spend a pomodoro extracting key claims and open questions.',
      })
    }

    if (inProgressTasks > 0) {
      insights.push({
        title: 'Focus on an in-flight task',
        detail: 'Use a 45-minute deep work block to unblock your highest priority task.',
      })
    }

    if (notesWithoutTitles > 0) {
      insights.push({
        title: 'Name your notes',
        detail: 'Give untitled notes memorable names while the context is fresh.',
      })
    }

    if (insights.length === 0) {
      insights.push({
        title: 'Celebrate the calm',
        detail: 'No urgent items detected—use focus mode for deliberate exploration or literature review.',
      })
    }

    return insights.slice(0, 3)
  }, [notes, papers, tasks])

  const applyCustomDuration = () => {
    const minutes = Number(customMinutes)
    if (!Number.isFinite(minutes) || minutes <= 0) {
      return
    }
    const clamped = Math.min(minutes, 180)
    setSessionLength(clamped * 60)
    setCustomMinutes('')
  }

  const handleTargetSelection = (target: SelectedTarget) => {
    setSelectedTarget(target)
    setHasCompletedSession(false)
    setIsRunning(false)
    setTimeLeft(sessionLength)
  }

  const handleOpenInWorkspace = () => {
    if (!selectedTarget || !selectedItem) return

    if (selectedTarget.type === 'note') {
      setSelectedNote(selectedItem as Note)
      setCurrentView('notes')
      window.history.pushState(null, '', `/notes/${selectedTarget.id}`)
    } else if (selectedTarget.type === 'paper') {
      setSelectedPaper(selectedItem as Paper)
      setCurrentView('papers')
      window.history.pushState(null, '', `/papers/${selectedTarget.id}`)
    } else if (selectedTarget.type === 'task') {
      setCurrentView('tasks')
      window.history.pushState(null, '', '/tasks')
    }
  }

  const presets = [
    { label: '15 min warm-up', value: 15 * 60 },
    { label: '25 min pomodoro', value: 25 * 60 },
    { label: '45 min deep work', value: 45 * 60 },
    { label: '60 min dive', value: 60 * 60 },
  ]

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-3">
        <div className="inline-flex items-center gap-2 text-primary-500 text-sm font-semibold uppercase tracking-wide">
          <Target className="w-4 h-4" />
          Focus Studio
        </div>
        <h1 className="text-3xl font-bold text-text-primary">Design an intentional deep work session</h1>
        <p className="text-text-secondary max-w-3xl">
          Choose one target, set a timer, and stay in flow. Your notes, papers, and tasks update automatically when the session ends.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_1fr]">
        <div className="space-y-6">
          <div className="bg-bg-surface border border-border-subtle rounded-2xl shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary-500/10 text-primary-600 flex items-center justify-center">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-secondary">Current session</p>
                  <p className="text-lg font-semibold text-text-primary">
                    {selectedItem ? (
                      <>
                        {selectedTarget?.type === 'note' && 'Note review · '}
                        {selectedTarget?.type === 'paper' && 'Paper focus · '}
                        {selectedTarget?.type === 'task' && 'Task sprint · '}
                        {selectedTarget?.type === 'note' && extractNoteSummary(selectedItem as Note)}
                        {selectedTarget?.type === 'paper' && (selectedItem as Paper).title}
                        {selectedTarget?.type === 'task' && (selectedItem as Task).title}
                      </>
                    ) : (
                      'Select a focus target'
                    )}
                  </p>
                </div>
              </div>
              {hasCompletedSession && (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-success-bg text-success text-sm font-medium">
                  <Sparkles className="w-4 h-4" /> Session complete!
                </span>
              )}
            </div>

            <div className="flex flex-col items-center gap-4">
              <div className="text-6xl md:text-7xl font-mono font-bold text-text-primary">
                {formatTime(effectiveTimeLeft)}
              </div>
              <div className="w-full h-3 bg-bg-base rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
                />
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2">
                {presets.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => setSessionLength(preset.value)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      sessionLength === preset.value
                        ? 'bg-primary-500 text-white border-primary-500'
                        : 'border-border-subtle text-text-secondary hover:border-primary-400 hover:text-text-primary'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
                <div className="flex items-center gap-2 border border-border-subtle rounded-full px-3 py-1.5 text-sm">
                  <input
                    value={customMinutes}
                    onChange={(event) => setCustomMinutes(event.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Custom"
                    inputMode="numeric"
                    className="w-16 bg-transparent text-center outline-none"
                  />
                  <span className="text-text-tertiary">min</span>
                  <button
                    onClick={applyCustomDuration}
                    className="text-primary-500 font-semibold"
                    disabled={!customMinutes}
                  >
                    Set
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setIsRunning((prev) => !prev)}
                  disabled={!selectedItem || sessionLength === 0}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary-500 text-white font-semibold hover:bg-primary-600 transition-colors disabled:opacity-50"
                >
                  {isRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  {isRunning ? 'Pause' : 'Start focus'}
                </button>
                <button
                  onClick={() => {
                    setTimeLeft(sessionLength)
                    setIsRunning(false)
                    setHasCompletedSession(false)
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border-subtle text-text-secondary hover:border-primary-400 hover:text-primary-500 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" /> Reset
                </button>
              </div>
            </div>
          </div>

          <div className="bg-bg-surface border border-border-subtle rounded-2xl shadow-sm p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-text-secondary">Focus target</p>
                <h2 className="text-2xl font-semibold text-text-primary">
                  {selectedItem
                    ? selectedTarget?.type === 'note'
                      ? extractNoteSummary(selectedItem as Note)
                      : selectedTarget?.type === 'paper'
                        ? (selectedItem as Paper).title
                        : (selectedItem as Task).title
                    : 'Nothing selected yet'}
                </h2>
              </div>
              {selectedTarget && (
                <span className="px-3 py-1.5 rounded-full text-sm font-semibold bg-primary-500/10 text-primary-600">
                  {selectedTarget.type === 'note' && 'Note'}
                  {selectedTarget.type === 'paper' && 'Paper'}
                  {selectedTarget.type === 'task' && 'Task'}
                </span>
              )}
            </div>

            {selectedItem ? (
              <div className="mt-4 space-y-4">
                <div className="bg-bg-elevated border border-border-subtle rounded-lg p-4 text-sm text-text-secondary whitespace-pre-line max-h-56 overflow-y-auto">
                  {selectedTarget?.type === 'note' && extractNotePreview(selectedItem as Note)}
                  {selectedTarget?.type === 'paper' && extractPaperPreview(selectedItem as Paper)}
                  {selectedTarget?.type === 'task' && extractTaskPreview(selectedItem as Task)}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-caption text-text-tertiary">
                    {selectedTarget?.type === 'paper' && (selectedItem as Paper).status}
                    {selectedTarget?.type === 'task' && (() => {
                      const dueDate = (selectedItem as Task).due_date
                      if (!dueDate) {
                        return 'No due date'
                      }
                      return `Due ${new Date(dueDate).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}`
                    })()}
                  </div>
                  <button
                    onClick={handleOpenInWorkspace}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-500 text-white font-medium hover:bg-primary-600 transition-colors"
                  >
                    Open in workspace
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-6 text-text-secondary text-sm">
                Select a target from the lists on the right to preview its details and plan your focus session.
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-6">
          {isLoading ? (
            <div className="p-6 border border-border-subtle rounded-2xl bg-bg-surface shadow-sm text-center text-text-secondary">
              Loading your workspace…
            </div>
          ) : (
            quickTargets.map((group) => {
              const Icon = group.icon
              const items = group.items
              return (
                <div key={group.type} className="bg-bg-surface border border-border-subtle rounded-2xl shadow-sm">
                  <div className="flex items-start justify-between gap-3 p-5">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-text-secondary">
                        <Icon className="w-4 h-4 text-primary-500" />
                        {group.title}
                      </div>
                      <p className="text-caption text-text-tertiary mt-1">{group.description}</p>
                    </div>
                   <button
                      className="text-caption text-primary-500 hover:text-primary-600"
                      onClick={() => {
                        const targetView = group.type === 'task' ? 'tasks' : group.type === 'paper' ? 'papers' : 'notes'
                        setCurrentView(targetView)
                        window.history.pushState(
                          null,
                          '',
                          targetView === 'notes' ? '/' : `/${targetView}`
                        )
                      }}
                    >
                      View all
                    </button>
                  </div>
                  <div className="border-t border-border-subtle">
                    {items.length > 0 ? (
                      <ul className="divide-y divide-border-subtle/60">
                        {items.map((item) => {
                          const isActive = selectedTarget?.type === group.type && selectedTarget.id === item.id
                          return (
                            <li key={item.id}>
                              <button
                                onClick={() => handleTargetSelection({ type: group.type, id: item.id })}
                                className={`w-full text-left px-5 py-3 transition-colors ${
                                  isActive ? 'bg-primary-500/10 text-primary-600' : 'hover:bg-bg-base'
                                }`}
                              >
                                <p className="text-sm font-semibold text-text-primary line-clamp-2">{item.title}</p>
                                <p className="text-caption text-text-tertiary mt-1">{item.meta}</p>
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    ) : (
                      <div className="px-5 py-6 text-sm text-text-tertiary">
                        {group.type === 'note' && 'No notes yet. Create one to capture your thinking.'}
                        {group.type === 'paper' && 'No papers are marked for reading. Add one from the Papers tab.'}
                        {group.type === 'task' && 'No active tasks. Create a task to anchor your next focus sprint.'}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}

          <div className="bg-bg-surface border border-border-subtle rounded-2xl shadow-sm p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-text-secondary">
              <Sparkles className="w-4 h-4 text-primary-500" />
              Suggested moves
            </div>
            <ul className="space-y-2">
              {focusInsights.map((insight) => (
                <li key={insight.title} className="p-3 rounded-lg bg-bg-base/60 border border-border-subtle/60">
                  <p className="text-sm font-semibold text-text-primary">{insight.title}</p>
                  <p className="text-caption text-text-secondary mt-1">{insight.detail}</p>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}

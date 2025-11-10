import { FileText, BookOpen, Lightbulb, Target, CheckSquare, Search, Plus, Sparkles, Coffee, Compass, ListChecks, Sprout } from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { useNotes } from '../../hooks/useNotes'
import { usePapers } from '../../hooks/usePapers'
import { useIdeas } from '../../hooks/useIdeas'
import { NoteList } from '../entities/NoteList'
import { PaperList } from '../entities/PaperList'
import { IdeaList } from '../entities/IdeaList'
import type { ReadingStatus, IdeaStage } from '../../types/database'
import { useGamificationStore } from '../../store/gamificationStore'
import { formatTimeUntil } from '../../utils/time'

const TABS = [
  { id: 'notes' as const, label: 'Notes', icon: FileText },
  { id: 'papers' as const, label: 'Papers', icon: BookOpen },
  { id: 'ideas' as const, label: 'Ideas', icon: Lightbulb },
  { id: 'tasks' as const, label: 'Tasks', icon: CheckSquare },
  { id: 'focus' as const, label: 'Focus', icon: Target },
]

interface DeadlinePreview {
  id: string
  title: string
  due_date: string
}

interface LeftSidebarProps {
  onNavigate?: () => void
}

type SidebarSearchState = Record<'notes' | 'papers' | 'ideas' | 'tasks' | 'focus', string>

export function LeftSidebar({ onNavigate }: LeftSidebarProps = {}) {
  const {
    currentView,
    setCurrentView,
    setUser: setUserProfile,
    setSelectedNote,
    setSelectedPaper,
    setSelectedIdea,
    selectedNote,
    selectedPaper,
    selectedIdea,
  } = useAppStore()
  const activeBoost = useGamificationStore((state) => state.activeBoost)
  const boostCountdown = useGamificationStore((state) => state.boostCountdown)
  const hydrateFromProfile = useGamificationStore((state) => state.hydrateFromProfile)
  const [searchQueries, setSearchQueries] = useState<SidebarSearchState>({
    notes: '',
    papers: '',
    ideas: '',
    tasks: '',
    focus: '',
  })
  const [userId, setUserId] = useState<string | undefined>(undefined)
  const [todayXP, setTodayXP] = useState(0)
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<DeadlinePreview[]>([])
  const realtimeChannelsRef = useRef<RealtimeChannel[]>([])
  
  // URL-based navigation handler
  const handleTabClick = (tabId: typeof currentView) => {
    setCurrentView(tabId)

    // Clear selected items when switching views to show default content
    if (tabId === 'papers') {
      setSelectedPaper(null)
    } else if (tabId === 'ideas') {
      setSelectedIdea(null)
    } else if (tabId === 'notes') {
      setSelectedNote(null)
    }

    const newUrl = tabId === 'notes' ? '/' : `/${tabId}`
    window.history.pushState(null, '', newUrl)
    onNavigate?.()
  }
  
  // Get hooks
  const { notes, loading: notesLoading, createNote, updateNote, deleteNote } = useNotes(userId)
  const { papers, loading: papersLoading, updatePaper, deletePaper } = usePapers(userId)
  const { ideas, loading: ideasLoading, createIdea, updateIdea, deleteIdea } = useIdeas(userId)
  // Determine current loading state
  const loading = useMemo(() => {
    if (currentView === 'notes') return notesLoading
    if (currentView === 'papers') return papersLoading
    if (currentView === 'ideas') return ideasLoading
    return false
  }, [currentView, ideasLoading, notesLoading, papersLoading])

  const showSidebarSearch = currentView !== 'tasks' && currentView !== 'focus'
  
  useEffect(() => {
    let isMounted = true

    const clearRealtimeChannels = () => {
      realtimeChannelsRef.current.forEach((channel) => {
        try {
          channel.unsubscribe()
        } catch (unsubscribeError) {
          console.error('Failed to unsubscribe from Supabase channel', unsubscribeError)
        }
      })
      realtimeChannelsRef.current = []
    }

    const fetchTodayXp = async (userId: string) => {
      const today = new Date().toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('daily_logs')
        .select('xp_earned')
        .eq('user_id', userId)
        .eq('date', today)
        .maybeSingle()

      if (!isMounted) {
        return
      }

      if (error) {
        console.error('Failed to fetch today\'s XP:', error)
        return
      }

      if (data) {
        setTodayXP(data.xp_earned)
      } else {
        setTodayXP(0)
      }
    }

    const fetchUpcomingDeadlines = async (userId: string) => {
      const now = new Date()
      const horizon = new Date()
      horizon.setDate(now.getDate() + 7)

      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, due_date, status')
        .eq('user_id', userId)
        .neq('status', 'completed')
        .neq('status', 'done')
        .not('due_date', 'is', null)
        .gte('due_date', now.toISOString())
        .lte('due_date', horizon.toISOString())
        .order('due_date', { ascending: true })
        .limit(5)

      if (!isMounted) {
        return
      }

      if (error) {
        console.error('Failed to load upcoming deadlines:', error)
        return
      }

      const tasks = (data as { id: string; title: string; due_date: string | null }[] | null) ?? []
      setUpcomingDeadlines(
        tasks
          .filter((item) => Boolean(item.due_date))
          .map((item) => ({
            id: item.id,
            title: item.title,
            due_date: item.due_date as string,
          }))
      )
    }

    const init = async () => {
      const { data, error } = await supabase.auth.getUser()

      if (!isMounted) {
        return
      }

      if (error) {
        console.error('Failed to get user:', error)
        return
      }

      const user = data.user
      setUserId(user?.id)

      if (!user?.id) {
        setTodayXP(0)
        setUpcomingDeadlines([])
        return
      }

      clearRealtimeChannels()
      await fetchTodayXp(user.id)
      await fetchUpcomingDeadlines(user.id)

      const profileChannel = supabase
        .channel('profile_changes')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'user_profiles', filter: `id=eq.${user.id}` },
          (payload) => {
            setUserProfile(payload.new as any)
            hydrateFromProfile(payload.new as any)
          }
        )
        .subscribe()

      const logsChannel = supabase
        .channel('daily_logs_changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'daily_logs', filter: `user_id=eq.${user.id}` },
          () => {
            void fetchTodayXp(user.id)
          }
        )
        .subscribe()

      const tasksChannel = supabase
        .channel('deadline_updates')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${user.id}` },
          () => {
            void fetchUpcomingDeadlines(user.id)
          }
        )
        .subscribe()

      realtimeChannelsRef.current = [profileChannel, logsChannel, tasksChannel]
    }

    void init()

    return () => {
      isMounted = false
      clearRealtimeChannels()
    }
  }, [setUserProfile, hydrateFromProfile])
  

  
  const handleAddClick = useCallback(async () => {
    if (currentView === 'notes') {
      const newNote = await createNote({
        markdown_body: '',
        tags: [],
      })
      if (newNote) {
        setSelectedNote(newNote)
        window.history.pushState(null, '', `/notes/${newNote.id}`)
      }
    } else if (currentView === 'papers') {
      // Clear selected paper to show the AddPaperView in main content
      setSelectedPaper(null)
    } else if (currentView === 'ideas') {
      const title = prompt('Enter idea title:')
      if (title) {
        const newIdea = await createIdea({
          title,
          stage: 'Seed',
        })
        if (newIdea) {
          setSelectedIdea(newIdea)
          window.history.pushState(null, '', `/ideas/${newIdea.id}`)
        }
      }
    }
  }, [createIdea, createNote, currentView, setSelectedIdea, setSelectedNote, setSelectedPaper])
  
  // Removed handleAddPaper - now handled in AddPaperView
  
  // Filter entities by search query (memoized for performance)
  const activeSearchQuery = searchQueries[currentView]
  const normalizedQuery = useMemo(
    () => activeSearchQuery.trim().toLowerCase(),
    [activeSearchQuery]
  )

  const filteredNotes = useMemo(
    () =>
      notes.filter((note) => {
        if (!normalizedQuery) {
          return true
        }

        const title = note.title || note.markdown_body.split('\n')[0] || ''
        return (
          title.toLowerCase().includes(normalizedQuery) ||
          note.markdown_body.toLowerCase().includes(normalizedQuery)
        )
      }),
    [notes, normalizedQuery]
  )

  const filteredPapers = useMemo(
    () =>
      papers.filter((paper) => {
        if (!normalizedQuery) {
          return true
        }

        return (
          paper.title.toLowerCase().includes(normalizedQuery) ||
          paper.authors.some((author) => author.toLowerCase().includes(normalizedQuery))
        )
      }),
    [papers, normalizedQuery]
  )

  const filteredIdeas = useMemo(
    () =>
      ideas.filter((idea) => {
        if (!normalizedQuery) {
          return true
        }

        return (
          idea.title.toLowerCase().includes(normalizedQuery) ||
          (idea.description && idea.description.toLowerCase().includes(normalizedQuery))
        )
      }),
    [ideas, normalizedQuery]
  )

  const nextDeadline = upcomingDeadlines[0]

  const nextDeadlineBadge = useMemo(() => {
    if (!nextDeadline) {
      return null
    }

    return formatTimeUntil(nextDeadline.due_date)
  }, [nextDeadline])

  const workspaceStats = useMemo(
    () => [
      { key: 'notes', label: 'Notes', count: notes.length, icon: FileText },
      { key: 'papers', label: 'Papers', count: papers.length, icon: BookOpen },
      { key: 'ideas', label: 'Ideas', count: ideas.length, icon: Lightbulb },
      { key: 'focus', label: 'Focus queue', count: upcomingDeadlines.length, icon: Target },
    ],
    [ideas.length, notes.length, papers.length, upcomingDeadlines.length]
  )

  const readingStatusCounts = useMemo(() => {
    return papers.reduce(
      (acc, paper) => {
        acc[paper.status] = (acc[paper.status] ?? 0) + 1
        return acc
      },
      {
        'To Read': 0,
        Reading: 0,
        Read: 0,
      } as Record<ReadingStatus, number>
    )
  }, [papers])

  const ideaStageCounts = useMemo(() => {
    return ideas.reduce(
      (acc, idea) => {
        acc[idea.stage] = (acc[idea.stage] ?? 0) + 1
        return acc
      },
      {
        Seed: 0,
        Developing: 0,
        Supported: 0,
        Mature: 0,
      } as Record<IdeaStage, number>
    )
  }, [ideas])

  const focusPrompts = useMemo(() => {
    const prompts: { title: string; detail: string }[] = []

    if (currentView === 'notes' && notes.length > 0) {
      prompts.push({
        title: 'Bundle a note',
        detail: 'Group related notes into a lightweight summary to spot emerging patterns.',
      })
    }

    if (currentView === 'papers' && readingStatusCounts['To Read'] > 0) {
      prompts.push({
        title: 'Schedule a skim',
        detail: 'Choose one “To Read” paper and pencil in a 15-minute skim to unblock progress.',
      })
    }

    if (currentView === 'ideas' && ideaStageCounts.Seed > 0) {
      prompts.push({
        title: 'Nudge a seed forward',
        detail: 'Pick a seed-stage idea and jot the smallest experiment that would advance it.',
      })
    }

    if (currentView === 'focus') {
      if (upcomingDeadlines.length > 0) {
        const deadline = upcomingDeadlines[0]
        prompts.push({
          title: 'Tackle your nearest deadline',
          detail: `Use a timer to make progress on “${deadline.title}” due ${formatTimeUntil(deadline.due_date)}.`,
        })
      }

      prompts.push({
        title: 'Pick a single target',
        detail: 'Choose one note, paper, or task in the Focus tab and commit to a 25-minute deep work sprint.',
      })
    }

    if (!activeBoost) {
      prompts.push({
        title: 'Plan a focus boost',
        detail: 'Line up a 25-minute boost window so the next deep work block is ready when you are.',
      })
    }

    if (todayXP === 0) {
      prompts.push({
        title: 'Log a micro-win',
        detail: 'Capture a two-minute action—like clarifying a task or clipping a quote—to start today’s streak.',
      })
    }

    if (prompts.length === 0) {
      prompts.push(
        {
          title: 'Review your workspace',
          detail: 'Scan the lists below and decide which item deserves your next deliberate step.',
        },
        {
          title: 'Archive the stale',
          detail: 'Clear out anything that no longer sparks energy so the active work stays visible.',
        }
      )
    }

    return prompts.slice(0, 3)
  }, [activeBoost, currentView, ideaStageCounts, notes.length, readingStatusCounts, todayXP, upcomingDeadlines])

  const focusReflection = useMemo(() => {
    if (todayXP === 0) {
      return 'No XP logged yet—start with a five-minute capture to open today’s momentum loop.'
    }

    if (todayXP < 50) {
      return `Nice warm-up with ${todayXP} XP. Stack another quick win while the energy is light.`
    }

    return `Great flow today! Bank a short reflection so future-you remembers what unlocked ${todayXP} XP.`
  }, [todayXP])
  
  return (
    <>
      <div className="flex-1 flex flex-col h-full overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Navigation Tabs */}
          <nav className="space-y-1">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const isActive = currentView === tab.id
              let badgeText: string | null = null
              let badgeStyle = ''

              if (tab.id === 'tasks' && nextDeadlineBadge) {
                badgeText = nextDeadlineBadge
                badgeStyle = 'bg-warning-bg text-warning border border-warning/30'
              } else if (tab.id === 'notes' && activeBoost && boostCountdown) {
                badgeText = boostCountdown
                badgeStyle = 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-200'
              }

              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-md transition-all duration-200 relative ${
                    isActive
                      ? 'bg-bg-elevated text-text-primary'
                      : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary'
                  }`}
                >
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1 bg-primary-500 rounded-r-full transition-opacity duration-200 ${
                      isActive ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{tab.label}</span>
                  {badgeText && (
                    <span
                      className={`ml-auto text-caption px-2 py-0.5 rounded-full font-semibold ${badgeStyle}`}
                    >
                      {badgeText}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
          
          {/* Search Bar */}
          {showSidebarSearch && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
              <input
                type="text"
                placeholder={`Search ${currentView}...`}
                value={activeSearchQuery}
                onChange={(e) => {
                  const nextValue = e.target.value
                  setSearchQueries((prev) => ({
                    ...prev,
                    [currentView]: nextValue,
                  }))
                }}
                className="w-full pl-10 pr-4 py-2 bg-bg-base border border-border-subtle rounded-md text-small focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          )}
          
          {/* Add Button (hide for tasks and focus) */}
          {currentView !== 'tasks' && currentView !== 'focus' && (
            <button
              onClick={() => {
                handleAddClick()
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors font-medium"
            >
              <Plus className="w-5 h-5" />
              <span>
                {`New ${currentView.slice(0, -1)}`}
              </span>
            </button>
          )}
          
          {/* Entity List */}
          <div className="space-y-2">
            <h3 className="text-small font-semibold text-text-secondary px-2">
              Recent {currentView}
            </h3>
            
            {currentView === 'notes' && (
              <NoteList
                notes={filteredNotes}
                loading={loading}
                onSelectNote={(note) => {
                  setSelectedNote(note)
                  window.history.pushState(null, '', `/notes/${note.id}`)
                }}
                onDeleteNote={deleteNote}
                selectedNoteId={selectedNote?.id}
              />
            )}
            
            {currentView === 'papers' && (
              <PaperList
                papers={filteredPapers}
                loading={loading}
                onSelectPaper={(paper) => {
                  setSelectedPaper(paper)
                  window.history.pushState(null, '', `/papers/${paper.id}`)
                }}
                onDeletePaper={deletePaper}
                onStatusChange={(id, status) => updatePaper(id, { status })}
                selectedPaperId={selectedPaper?.id}
              />
            )}
            
            {currentView === 'ideas' && (
              <IdeaList
                ideas={filteredIdeas}
                loading={loading}
                onSelectIdea={(idea) => {
                  setSelectedIdea(idea)
                  window.history.pushState(null, '', `/ideas/${idea.id}`)
                }}
                onDeleteIdea={deleteIdea}
                onStageChange={(id, stage, oldStage) => updateIdea(id, { stage }, oldStage)}
                selectedIdeaId={selectedIdea?.id}
              />
            )}
            
            {currentView === 'tasks' && (
              <div className="text-center py-12 text-text-tertiary">
                <CheckSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-small">Task manager is in the main panel</p>
              </div>
            )}
            
            {currentView === 'focus' && (
              <div className="space-y-3">
                <div className="p-4 border border-border-subtle rounded-lg bg-bg-base/60 text-sm text-text-secondary">
                  Set a target in the main panel, choose a timer preset, and block distractions while you work through a single thread.
                </div>
                <div className="space-y-2">
                  <h4 className="text-small font-semibold text-text-secondary px-2 flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary-500" />
                    Upcoming focus candidates
                  </h4>
                  {upcomingDeadlines.length > 0 ? (
                    <ul className="space-y-2">
                      {upcomingDeadlines.slice(0, 4).map((deadline) => (
                        <li
                          key={deadline.id}
                          className="p-3 rounded-md border border-border-subtle bg-bg-base/80"
                        >
                          <p className="text-small font-semibold text-text-primary line-clamp-2">
                            {deadline.title}
                          </p>
                          <p className="text-caption text-text-tertiary mt-1">
                            Due {new Date(deadline.due_date).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-caption text-text-tertiary px-2">
                      No deadlines this week—pick a note or paper you’ve been meaning to revisit.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Focus Studio Widget */}
          <div className="mt-4 p-4 bg-bg-elevated rounded-lg border border-border-subtle space-y-4">
            <div className="flex items-center gap-2 text-text-primary">
              <Compass className="w-4 h-4 text-primary-500" />
              <h3 className="text-small font-semibold uppercase tracking-wide">Focus Studio</h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {workspaceStats.map(({ key, label, count, icon: StatIcon }) => (
                <div
                  key={key}
                  className="flex items-center gap-3 p-3 bg-bg-base/60 rounded-md border border-border-subtle/60"
                >
                  <StatIcon className="w-4 h-4 text-primary-500" />
                  <div>
                    <p className="text-lg font-semibold text-text-primary">{count}</p>
                    <p className="text-caption text-text-secondary uppercase tracking-wide">{label}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-text-primary">
                <ListChecks className="w-4 h-4 text-primary-500" />
                <p className="text-small font-medium">Reading pipeline</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(['To Read', 'Reading', 'Read'] as ReadingStatus[]).map((status) => (
                  <span
                    key={status}
                    className="px-3 py-1 rounded-full border border-border-subtle text-caption text-text-secondary"
                  >
                    <span className="font-semibold text-text-primary">{readingStatusCounts[status]}</span> {status}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-text-primary">
                <Sprout className="w-4 h-4 text-success" />
                <p className="text-small font-medium">Idea garden</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(['Seed', 'Developing', 'Supported', 'Mature'] as IdeaStage[]).map((stage) => (
                  <span
                    key={stage}
                    className="px-3 py-1 rounded-full border border-border-subtle text-caption text-text-secondary"
                  >
                    <span className="font-semibold text-text-primary">{ideaStageCounts[stage]}</span> {stage}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-text-primary">
                <Sparkles className="w-4 h-4 text-primary-500" />
                <p className="text-small font-medium">Focus prompts</p>
              </div>
              <ul className="space-y-2">
                {focusPrompts.map((prompt) => (
                  <li
                    key={prompt.title}
                    className="p-3 rounded-md bg-bg-base/60 border border-border-subtle/60"
                  >
                    <p className="text-small font-semibold text-text-primary">{prompt.title}</p>
                    <p className="text-caption text-text-secondary mt-1">{prompt.detail}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-start gap-3">
              <Coffee className="w-4 h-4 mt-1 text-success" />
              <p className="text-caption text-text-secondary leading-relaxed">{focusReflection}</p>
            </div>
          </div>
        </div>
      </div>

    </>
  )
}

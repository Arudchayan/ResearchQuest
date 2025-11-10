import { FileText, BookOpen, Lightbulb, Tag, CheckSquare, Search, Plus, CalendarCheck, Sparkles, Snowflake, Coffee } from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { useNotes } from '../../hooks/useNotes'
import { usePapers } from '../../hooks/usePapers'
import { useIdeas } from '../../hooks/useIdeas'
import { useTopics } from '../../hooks/useTopics'
import { NoteList } from '../entities/NoteList'
import { PaperList } from '../entities/PaperList'
import { IdeaList } from '../entities/IdeaList'
import type { ReadingStatus, IdeaStage } from '../../types/database'
import { useGamificationStore } from '../../store/gamificationStore'
import { formatTimeUntil, formatDateLabel } from '../../utils/time'

const TABS = [
  { id: 'notes' as const, label: 'Notes', icon: FileText },
  { id: 'papers' as const, label: 'Papers', icon: BookOpen },
  { id: 'ideas' as const, label: 'Ideas', icon: Lightbulb },
  { id: 'tasks' as const, label: 'Tasks', icon: CheckSquare },
  { id: 'topics' as const, label: 'Topics', icon: Tag },
]

interface DeadlinePreview {
  id: string
  title: string
  due_date: string
}

interface LeftSidebarProps {
  onNavigate?: () => void
}

export function LeftSidebar({ onNavigate }: LeftSidebarProps = {}) {
  const { currentView, setCurrentView, user, setUser: setUserProfile, setSelectedNote, setSelectedPaper, setSelectedIdea } = useAppStore()
  const activeBoost = useGamificationStore((state) => state.activeBoost)
  const boostCountdown = useGamificationStore((state) => state.boostCountdown)
  const streakFreezeTokens = useGamificationStore((state) => state.streakFreezeTokens)
  const restDays = useGamificationStore((state) => state.restDays)
  const hydrateFromProfile = useGamificationStore((state) => state.hydrateFromProfile)
  const [searchQuery, setSearchQuery] = useState('')
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
    } else if (tabId === 'topics') {
      setSelectedTopic(null)
    }

    const newUrl = tabId === 'notes' ? '/' : `/${tabId}`
    window.history.pushState(null, '', newUrl)
    onNavigate?.()
  }
  
  // Get hooks
  const { notes, loading: notesLoading, createNote, updateNote, deleteNote } = useNotes(userId)
  const { papers, loading: papersLoading, searchPaperByDOI, searchPapersByQuery, createPaper, updatePaper, deletePaper } = usePapers(userId)
  const { ideas, loading: ideasLoading, createIdea, updateIdea, deleteIdea } = useIdeas(userId)
  const {
    topics,
    loading: topicsLoading,
    createTopic,
    deleteTopic,
  } = useTopics(userId)
  
  // Determine current loading state
  const loading = useMemo(() => {
    if (currentView === 'notes') return notesLoading
    if (currentView === 'papers') return papersLoading
    if (currentView === 'ideas') return ideasLoading
    if (currentView === 'topics') return topicsLoading
    return false
  }, [currentView, ideasLoading, notesLoading, papersLoading, topicsLoading])
  
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
    } else if (currentView === 'topics') {
      const name = prompt('Name your topic:')
      if (name && name.trim()) {
        const topic = await createTopic({ name })
        if (topic) {
          setSelectedTopic(topic)
          window.history.pushState(null, '', `/topics/${topic.id}`)
        }
      }
    }
  }, [createIdea, createNote, createTopic, currentView, setSelectedIdea, setSelectedNote, setSelectedPaper, setSelectedTopic])
  
  // Removed handleAddPaper - now handled in AddPaperView
  
  // Filter entities by search query (memoized for performance)
  const normalizedQuery = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery])

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

  const supportiveMessage = useMemo(() => {
    if (todayXP > 0) {
      return `You've already banked ${todayXP} XP today. Celebrate the momentum!`
    }

    if (nextDeadline) {
      const timePhrase = formatTimeUntil(nextDeadline.due_date)
      return `Next focus point "${nextDeadline.title}" is ${timePhrase === 'due now' ? 'ready whenever you are' : `coming up in ${timePhrase}`}. Take a calming breath before you dive in.`
    }

    return 'No deadlines within the next week. Feel free to explore, read, or simply rest.'
  }, [todayXP, nextDeadline])
  
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
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              type="text"
              placeholder={`Search ${currentView}...`}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
              }}
              className="w-full pl-10 pr-4 py-2 bg-bg-base border border-border-subtle rounded-md text-small focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          
          {/* Add Button (hide for tasks) */}
          {currentView !== 'tasks' && (
            <button
              onClick={() => {
                handleAddClick()
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors font-medium"
            >
              <Plus className="w-5 h-5" />
              <span>
                {currentView === 'topics' ? 'New Topic' : `New ${currentView.slice(0, -1)}`}
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
                selectedNoteId={undefined}
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
                selectedPaperId={undefined}
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
                selectedIdeaId={undefined}
              />
            )}
            
            {currentView === 'tasks' && (
              <div className="text-center py-12 text-text-tertiary">
                <CheckSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-small">Task manager is in the main panel</p>
              </div>
            )}
            
            {currentView === 'topics' && (
              <TopicList
                topics={filteredTopics}
                loading={loading}
                onSelectTopic={(topic) => {
                  setSelectedTopic(topic)
                  window.history.pushState(null, '', `/topics/${topic.id}`)
                }}
                onDeleteTopic={deleteTopic}
              />
            )}
          </div>
          
          {/* Gamification Widget */}
          <div className="mt-4 p-4 bg-bg-elevated rounded-lg border border-border-subtle space-y-4">
            <div className="flex items-center gap-2 text-text-primary">
              <Sparkles className="w-4 h-4 text-primary-500" />
              <h3 className="text-small font-semibold uppercase tracking-wide">Momentum Center</h3>
            </div>

            <div className="flex items-start gap-3">
              <CalendarCheck className="w-4 h-4 mt-1 text-primary-500" />
              <div className="flex-1">
                <p className="text-small font-medium text-text-primary">Upcoming focus</p>
                {upcomingDeadlines.length > 0 ? (
                  <ul className="mt-1 space-y-1">
                    {upcomingDeadlines.slice(0, 3).map((deadline) => (
                      <li key={deadline.id} className="text-caption text-text-secondary flex items-center gap-2">
                        <span className="truncate">{deadline.title}</span>
                        <span className="text-text-tertiary">
                          {formatDateLabel(deadline.due_date)} • {formatTimeUntil(deadline.due_date)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-caption text-text-secondary mt-1">
                    You're clear for the next few days. Use the space for deep work or creative wandering.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Sparkles className="w-4 h-4 mt-1 text-primary-500" />
              <div className="flex-1">
                <p className="text-small font-medium text-text-primary">Boost status</p>
                {activeBoost ? (
                  <p className="text-caption text-text-secondary mt-1">
                    {activeBoost.label ?? 'Focus boost'} active · {boostCountdown ?? 'counting down'}
                  </p>
                ) : (
                  <p className="text-caption text-text-secondary mt-1">
                    No boost running. Trigger one when you want an intentional burst of focus.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Snowflake className="w-4 h-4 mt-1 text-primary-400" />
              <div>
                <p className="text-small font-medium text-text-primary">Safety net</p>
                <p className="text-caption text-text-secondary mt-1">
                  {streakFreezeTokens} freeze token{streakFreezeTokens === 1 ? '' : 's'} · {restDays} rest day{restDays === 1 ? '' : 's'} ready for you.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Coffee className="w-4 h-4 mt-1 text-success" />
              <p className="text-caption text-text-secondary leading-relaxed">{supportiveMessage}</p>
            </div>
          </div>
        </div>
      </div>

    </>
  )
}

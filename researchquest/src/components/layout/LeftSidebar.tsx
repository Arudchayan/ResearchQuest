import { FileText, BookOpen, Lightbulb, Tag, CheckSquare, Search, Plus } from 'lucide-react'
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

const TABS = [
  { id: 'notes' as const, label: 'Notes', icon: FileText },
  { id: 'papers' as const, label: 'Papers', icon: BookOpen },
  { id: 'ideas' as const, label: 'Ideas', icon: Lightbulb },
  { id: 'tasks' as const, label: 'Tasks', icon: CheckSquare },
  { id: 'topics' as const, label: 'Topics', icon: Tag },
]

interface LeftSidebarProps {
  onNavigate?: () => void
}

export function LeftSidebar({ onNavigate }: LeftSidebarProps = {}) {
  const { currentView, setCurrentView, user, setUser: setUserProfile, setSelectedNote, setSelectedPaper, setSelectedIdea } = useAppStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [userId, setUserId] = useState<string | undefined>(undefined)
  const [todayXP, setTodayXP] = useState(0)
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
  const { papers, loading: papersLoading, searchPaperByDOI, searchPapersByQuery, createPaper, updatePaper, deletePaper } = usePapers(userId)
  const { ideas, loading: ideasLoading, createIdea, updateIdea, deleteIdea } = useIdeas(userId)
  
  // Determine current loading state
  const loading = useMemo(() => {
    if (currentView === 'notes') return notesLoading
    if (currentView === 'papers') return papersLoading
    if (currentView === 'ideas') return ideasLoading
    return false
  }, [currentView, notesLoading, papersLoading, ideasLoading])
  
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
        return
      }

      clearRealtimeChannels()
      await fetchTodayXp(user.id)

      const profileChannel = supabase
        .channel('profile_changes')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'user_profiles', filter: `id=eq.${user.id}` },
          (payload) => {
            setUserProfile(payload.new as any)
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

      realtimeChannelsRef.current = [profileChannel, logsChannel]
    }

    void init()

    return () => {
      isMounted = false
      clearRealtimeChannels()
    }
  }, [setUserProfile])
  

  
  const handleAddClick = useCallback(async () => {
    if (currentView === 'notes') {
      const newNote = await createNote({
        markdown_body: '',
        tags: [],
      })
      if (newNote) {
        setSelectedNote(newNote)
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
        }
      }
    }
  }, [currentView, createNote, setSelectedNote, createIdea, setSelectedIdea, setSelectedPaper])
  
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
  
  return (
    <>
      <div className="flex-1 flex flex-col h-full overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Navigation Tabs */}
          <nav className="space-y-1">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const isActive = currentView === tab.id
              
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
          
          {/* Add Button (hide for tasks and topics) */}
          {currentView !== 'tasks' && currentView !== 'topics' && (
            <button
              onClick={() => {
                handleAddClick()
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors font-medium"
            >
              <Plus className="w-5 h-5" />
              <span>New {currentView.slice(0, -1)}</span>
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
              <div className="text-center py-12 text-text-tertiary">
                <Tag className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-small">Topics coming soon</p>
              </div>
            )}
          </div>
          
          {/* Gamification Widget */}
          <div className="mt-4 p-3 bg-bg-elevated rounded-lg border border-border-subtle">
            <h3 className="text-small font-semibold text-text-primary mb-2">Today's Progress</h3>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-caption text-text-secondary">XP Earned</span>
                <span className="text-small font-bold text-primary-500">+{todayXP} XP</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-caption text-text-secondary">Total XP</span>
                <span className="text-small font-semibold text-text-primary">{user?.total_xp || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-caption text-text-secondary">Level</span>
                <span className="text-small font-semibold text-text-primary">{user?.current_level || 1}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
    </>
  )
}

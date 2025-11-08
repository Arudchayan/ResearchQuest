import { FileText, BookOpen, Lightbulb, Tag, CheckSquare, Search, Plus } from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useNotes } from '../../hooks/useNotes'
import { usePapers } from '../../hooks/usePapers'
import { useIdeas } from '../../hooks/useIdeas'
import { NoteList } from '../entities/NoteList'
import { PaperList } from '../entities/PaperList'
import { IdeaList } from '../entities/IdeaList'
import { AddPaperModal } from '../entities/AddPaperModal'
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
  const [showAddPaperModal, setShowAddPaperModal] = useState(false)
  const [todayXP, setTodayXP] = useState(0)
  
  // URL-based navigation handler
  const handleTabClick = (tabId: typeof currentView) => {
    console.log('handleTabClick called with:', tabId)
    setCurrentView(tabId)
    const newUrl = tabId === 'notes' ? '/' : `/${tabId}`
    window.history.pushState(null, '', newUrl)
    onNavigate?.()
    console.log('Navigation completed to:', newUrl)
  }
  
  // Get hooks
  const { notes, createNote, updateNote, deleteNote } = useNotes(userId)
  const { papers, searchPaperByDOI, searchPapersByQuery, createPaper, updatePaper, deletePaper } = usePapers(userId)
  const { ideas, createIdea, updateIdea, deleteIdea } = useIdeas(userId)
  
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id)
      
      // Fetch today's XP
      if (user?.id) {
        const today = new Date().toISOString().split('T')[0]
        supabase
          .from('daily_logs')
          .select('xp_earned')
          .eq('user_id', user.id)
          .eq('date', today)
          .maybeSingle()
          .then(({ data }) => {
            if (data) {
              setTodayXP(data.xp_earned)
            }
          })
          
        // Set up realtime listener for profile updates
        const profileChannel = supabase
          .channel('profile_changes')
          .on('postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'user_profiles', filter: `id=eq.${user.id}` },
            (payload) => {
              setUserProfile(payload.new as any)
            }
          )
          .subscribe()
          
        // Set up realtime listener for daily log updates
        const logsChannel = supabase
          .channel('daily_logs_changes')
          .on('postgres_changes',
            { event: '*', schema: 'public', table: 'daily_logs', filter: `user_id=eq.${user.id}` },
            () => {
              supabase
                .from('daily_logs')
                .select('xp_earned')
                .eq('user_id', user.id)
                .eq('date', today)
                .maybeSingle()
                .then(({ data }) => {
                  if (data) {
                    setTodayXP(data.xp_earned)
                  }
                })
            }
          )
          .subscribe()
          
        return () => {
          profileChannel.unsubscribe()
          logsChannel.unsubscribe()
        }
      }
    })
  }, [])
  

  
  const handleAddClick = async () => {
    if (currentView === 'notes') {
      const newNote = await createNote({
        markdown_body: '',
        tags: [],
      })
      if (newNote) {
        setSelectedNote(newNote)
      }
    } else if (currentView === 'papers') {
      setShowAddPaperModal(true)
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
  }
  
  const handleAddPaper = async (paperData: any) => {
    console.log('handleAddPaper called with:', paperData)
    
    try {
      const newPaper = await createPaper(paperData)
      console.log('createPaper result:', newPaper)
      
      if (newPaper) {
        setSelectedPaper(newPaper)
        console.log('Paper added and selected successfully')
      } else {
        console.error('createPaper returned null or undefined')
      }
    } catch (error) {
      console.error('Error in handleAddPaper:', error)
    }
  }
  
  // Filter entities by search query
  const filteredNotes = notes.filter(note => {
    const title = note.title || note.markdown_body.split('\n')[0] || ''
    return title.toLowerCase().includes(searchQuery.toLowerCase()) ||
           note.markdown_body.toLowerCase().includes(searchQuery.toLowerCase())
  })
  
  const filteredPapers = papers.filter(paper =>
    paper.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    paper.authors.some(author => author.toLowerCase().includes(searchQuery.toLowerCase()))
  )
  
  const filteredIdeas = ideas.filter(idea =>
    idea.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (idea.description && idea.description.toLowerCase().includes(searchQuery.toLowerCase()))
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
                console.log('Search input changed:', e.target.value)
                setSearchQuery(e.target.value)
              }}
              className="w-full pl-10 pr-4 py-2 bg-bg-base border border-border-subtle rounded-md text-small focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          
          {/* Add Button (hide for tasks and topics) */}
          {currentView !== 'tasks' && currentView !== 'topics' && (
            <button 
              onClick={() => {
                console.log('Add button clicked for:', currentView)
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
                onSelectNote={(note) => setSelectedNote(note)}
                onDeleteNote={deleteNote}
                selectedNoteId={undefined}
              />
            )}
            
            {currentView === 'papers' && (
              <PaperList
                papers={filteredPapers}
                onSelectPaper={(paper) => setSelectedPaper(paper)}
                onDeletePaper={deletePaper}
                onStatusChange={(id, status) => updatePaper(id, { status })}
                selectedPaperId={undefined}
              />
            )}
            
            {currentView === 'ideas' && (
              <IdeaList
                ideas={filteredIdeas}
                onSelectIdea={(idea) => setSelectedIdea(idea)}
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
      
      <AddPaperModal
        isOpen={showAddPaperModal}
        onClose={() => setShowAddPaperModal(false)}
        onAdd={handleAddPaper}
        searchByDOI={searchPaperByDOI}
        searchByQuery={searchPapersByQuery}
      />
    </>
  )
}

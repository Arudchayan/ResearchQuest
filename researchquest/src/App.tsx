import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { useAppStore } from './store/appStore'
import { TopNav } from './components/layout/TopNav'
import { LeftSidebar } from './components/layout/LeftSidebar'
import { RightSidebar } from './components/layout/RightSidebar'
import { MobileMenu } from './components/layout/MobileMenu'
import { MarkdownEditor } from './components/editor/MarkdownEditor'
import { TaskManager } from './components/tasks/TaskManager'
import { IdeaDetailView } from './components/entities/IdeaDetailView'
import { AddPaperView } from './components/entities/AddPaperView'
import { PaperDetailView } from './components/entities/PaperDetailView'
import { ItemNotFound } from './components/ui/NotFound'
import { Toaster } from 'sonner'
import type { User } from '@supabase/supabase-js'
import { usePapers } from './hooks/usePapers'
import { useIdeas } from './hooks/useIdeas'

function AuthScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        })
        if (error) throw error
        setMessage('Check your email for the confirmation link!')
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
      }
    } catch (error: any) {
      setMessage(error.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base">
      <div className="w-full max-w-md p-8 bg-bg-surface rounded-lg shadow-lg border border-border-subtle">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-500 rounded-lg mx-auto mb-4 flex items-center justify-center text-white font-bold text-title">
            RQ
          </div>
          <h1 className="text-title font-bold text-text-primary">ResearchQuest</h1>
          <p className="text-small text-text-secondary mt-2">
            Gamified research management
          </p>
        </div>
        
        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-small font-medium text-text-primary mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-bg-base border border-border-subtle rounded-md text-body focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="researcher@example.com"
            />
          </div>
          
          <div>
            <label className="block text-small font-medium text-text-primary mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 bg-bg-base border border-border-subtle rounded-md text-body focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="••••••••"
            />
          </div>
          
          {message && (
            <div className={`p-3 rounded-md text-small ${
              message.includes('error') || message.includes('Error')
                ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                : 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
            }`}>
              {message}
            </div>
          )}
          
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-3 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors font-semibold disabled:opacity-50"
          >
            {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp)
              setMessage('')
            }}
            className="text-small text-primary-500 hover:text-primary-600"
          >
            {isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
          </button>
        </div>
      </div>
    </div>
  )
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | undefined>(undefined)
  const [itemNotFound, setItemNotFound] = useState(false)
  const { setUser: setUserProfile, currentView, setCurrentView, selectedNote, selectedPaper, selectedIdea } = useAppStore()
  
  // Get hooks for CRUD operations
  const { papers, loading: papersLoading, searchPaperByDOI, searchPapersByQuery, createPaper, updatePaper } = usePapers(userId)
  const { ideas, loading: ideasLoading, updateIdea } = useIdeas(userId)
  
  useEffect(() => {
    // Check active sessions
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setUserId(session?.user?.id)
      setLoading(false)
    })
    
    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setUserId(session?.user?.id)
    })
    
    return () => subscription.unsubscribe()
  }, [])
  
  useEffect(() => {
    if (user) {
      // Fetch user profile
      supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setUserProfile(data)
          }
        })
    } else {
      setUserProfile(null)
    }
  }, [user, setUserProfile])
  
  // URL-based routing - handle initial load and navigation
  useEffect(() => {
    const handleRouteChange = () => {
      // Check if we were redirected from a 404 page
      const redirectPath = sessionStorage.getItem('redirectPath')
      if (redirectPath) {
        sessionStorage.removeItem('redirectPath')
        console.log('Restoring path from 404 redirect:', redirectPath)
        window.history.replaceState(null, '', redirectPath)
      }
      
      const path = window.location.pathname
      console.log('Route changed to:', path)
      
      // Handle root path
      if (path === '/' || path === '') {
        setCurrentView('notes')
        return
      }
      
      // Parse URL: /view or /view/itemId
      const pathParts = path.slice(1).split('/')
      const view = pathParts[0] as typeof currentView
      const itemId = pathParts[1]
      
      // Validate view
      if (['notes', 'papers', 'ideas', 'tasks', 'topics'].includes(view)) {
        console.log('Setting view to:', view)
        setCurrentView(view)
        
        // If there's an item ID in the URL, try to select it
        // This will be handled by a separate effect that watches the papers/ideas/notes arrays
        if (itemId) {
          console.log('Item ID in URL:', itemId)
          // The actual selection will happen in the effect below once data is loaded
        }
      } else {
        // Invalid route, redirect to notes
        console.log('Invalid route, redirecting to notes')
        window.history.replaceState(null, '', '/')
        setCurrentView('notes')
      }
    }
    
    // Handle initial load (critical for page refresh)
    handleRouteChange()
    
    // Listen for back/forward navigation
    window.addEventListener('popstate', handleRouteChange)
    
    return () => window.removeEventListener('popstate', handleRouteChange)
  }, [setCurrentView])
  
  // Handle selecting items from URL (when data is loaded)
  useEffect(() => {
    if (!userId) return
    
    const path = window.location.pathname
    const pathParts = path.slice(1).split('/')
    const view = pathParts[0]
    const itemId = pathParts[1]
    
    if (!itemId) {
      setItemNotFound(false)
      return
    }
    
    // Wait for data to load
    if (view === 'papers' && papersLoading) return
    if (view === 'ideas' && ideasLoading) return
    
    // Try to find and select the item based on URL
    if (view === 'papers' && papers.length >= 0) {
      const paper = papers.find(p => p.id === itemId)
      if (paper) {
        console.log('Selecting paper from URL:', itemId)
        useAppStore.getState().setSelectedPaper(paper)
        setItemNotFound(false)
      } else if (!papersLoading) {
        // Paper not found and data is loaded
        console.log('Paper not found:', itemId)
        setItemNotFound(true)
      }
    } else if (view === 'ideas' && ideas.length >= 0) {
      const idea = ideas.find(i => i.id === itemId)
      if (idea) {
        console.log('Selecting idea from URL:', itemId)
        useAppStore.getState().setSelectedIdea(idea)
        setItemNotFound(false)
      } else if (!ideasLoading) {
        // Idea not found and data is loaded
        console.log('Idea not found:', itemId)
        setItemNotFound(true)
      }
    }
  }, [userId, papers, ideas, papersLoading, ideasLoading, currentView])
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-base">
        <div className="text-text-primary">Loading...</div>
      </div>
    )
  }
  
  if (!user) {
    return <AuthScreen />
  }
  
  return (
    <div className="min-h-screen-dynamic bg-bg-base">
      {/* Toast Notifications */}
      <Toaster 
        position="top-right"
        richColors
        expand={false}
        duration={3000}
        theme={useAppStore.getState().effectiveTheme}
        closeButton
      />
      
      {/* Mobile Navigation */}
      <MobileMenu />
      
      {/* TopNav - Fixed positioning */}
      <TopNav />
      
      {/* Main Layout Container */}
      <div className="pt-16 flex min-h-screen-dynamic">
        {/* Left Sidebar - Hidden on mobile, 280px on desktop */}
        <aside className="hidden lg:flex lg:flex-col lg:w-70 bg-bg-surface border-r border-border-subtle">
          <LeftSidebar />
        </aside>
        
        {/* Main Content Area - Takes remaining space */}
        <main className="flex-1 overflow-auto">
          {currentView === 'tasks' ? (
            <div className="p-6">
              <TaskManager />
            </div>
          ) : currentView === 'notes' ? (
            selectedNote ? (
              <MarkdownEditor />
            ) : (
              <div className="p-6">
                <div className="max-w-4xl mx-auto text-center py-12">
                  <h2 className="text-title font-semibold text-text-primary mb-4">
                    Welcome to ResearchQuest
                  </h2>
                  <p className="text-body text-text-secondary">
                    Select a note from the sidebar or create a new one to get started.
                  </p>
                </div>
              </div>
            )
          ) : currentView === 'papers' ? (
            itemNotFound ? (
              <ItemNotFound itemType="paper" />
            ) : selectedPaper ? (
              <PaperDetailView
                paper={selectedPaper}
                onUpdate={updatePaper}
              />
            ) : (
              <AddPaperView
                onAdd={async (paperData) => {
                  const newPaper = await createPaper(paperData)
                  return newPaper
                }}
                searchByDOI={searchPaperByDOI}
                searchByQuery={searchPapersByQuery}
              />
            )
          ) : currentView === 'ideas' ? (
            itemNotFound ? (
              <ItemNotFound itemType="idea" />
            ) : selectedIdea ? (
              <IdeaDetailView
                idea={selectedIdea}
                onUpdate={updateIdea}
              />
            ) : (
              <div className="p-6">
                <div className="max-w-4xl mx-auto text-center py-12">
                  <h2 className="text-title font-semibold text-text-primary mb-4">
                    Ideas Workspace
                  </h2>
                  <p className="text-body text-text-secondary">
                    Select an idea from the sidebar or create a new one to capture your research ideas.
                  </p>
                </div>
              </div>
            )
          ) : currentView === 'topics' ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <h2 className="text-title font-semibold text-text-primary mb-4">
                  Topics Feature Coming Soon
                </h2>
                <p className="text-body text-text-secondary">
                  We're working on adding topic management to help you organize your research.
                </p>
              </div>
            </div>
          ) : null}
        </main>
        
        {/* Right Sidebar - Hidden on tablet and below, 320px on desktop */}
        <aside className="hidden xl:flex xl:flex-col xl:w-80 bg-bg-surface border-l border-border-subtle">
          <RightSidebar />
        </aside>
      </div>
    </div>
  )
}

export default App
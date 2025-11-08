import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { useAppStore } from './store/appStore'
import { TopNav } from './components/layout/TopNav'
import { LeftSidebar } from './components/layout/LeftSidebar'
import { RightSidebar } from './components/layout/RightSidebar'
import { MobileMenu } from './components/layout/MobileMenu'
import { MarkdownEditor } from './components/editor/MarkdownEditor'
import { TaskManager } from './components/tasks/TaskManager'
import { NoteList } from './components/entities/NoteList'
import { PaperList } from './components/entities/PaperList'
import { IdeaList } from './components/entities/IdeaList'
import { useNotes } from './hooks/useNotes'
import { usePapers } from './hooks/usePapers'
import { useIdeas } from './hooks/useIdeas'
import type { User } from '@supabase/supabase-js'

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
  const { setUser: setUserProfile, currentView, setCurrentView } = useAppStore()
  
  // Get hooks for entity management
  const { notes, createNote, updateNote, deleteNote } = useNotes(userId)
  const { papers, createPaper, updatePaper, deletePaper } = usePapers(userId)
  const { ideas, createIdea, updateIdea, deleteIdea } = useIdeas(userId)
  
  useEffect(() => {
    // Check active sessions
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    
    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    
    return () => subscription.unsubscribe()
  }, [])
  
  useEffect(() => {
    if (user) {
      setUserId(user.id)
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
  
  // URL-based routing
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname
      const view = path.slice(1) as typeof currentView
      if (['notes', 'papers', 'ideas', 'tasks', 'topics'].includes(view)) {
        setCurrentView(view)
      }
    }
    
    // Handle initial load
    handlePopState()
    
    // Listen for back/forward navigation
    window.addEventListener('popstate', handlePopState)
    
    return () => window.removeEventListener('popstate', handlePopState)
  }, [setCurrentView, currentView])
  
  // Update URL when view changes
  const handleViewChange = (newView: typeof currentView) => {
    setCurrentView(newView)
    const newUrl = newView === 'notes' ? '/' : `/${newView}`
    window.history.pushState(null, '', newUrl)
  }
  
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
            <div className="p-6">
              <div className="max-w-4xl mx-auto">
                {notes.length === 0 ? (
                  <div className="text-center py-12">
                    <h2 className="text-title font-semibold text-text-primary mb-4">
                      Welcome to ResearchQuest
                    </h2>
                    <p className="text-body text-text-secondary mb-6">
                      Create your first note to get started with your research.
                    </p>
                    <button
                      onClick={async () => {
                        const newNote = await createNote({
                          markdown_body: '# New Note\n\nStart writing your research notes here...',
                          tags: [],
                        })
                        // Note will be selected by the NoteList component
                      }}
                      className="px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium"
                    >
                      Create First Note
                    </button>
                  </div>
                ) : (
                  <MarkdownEditor />
                )}
              </div>
            </div>
          ) : currentView === 'papers' ? (
            <div className="p-6">
              <div className="max-w-4xl mx-auto">
                {papers.length === 0 ? (
                  <div className="text-center py-12">
                    <h2 className="text-title font-semibold text-text-primary mb-4">
                      Papers Library
                    </h2>
                    <p className="text-body text-text-secondary mb-6">
                      Add research papers to build your knowledge base.
                    </p>
                    <p className="text-caption text-text-tertiary">
                      Use the "New Paper" button in the left sidebar to add papers by DOI or search.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-6 md:grid-cols-2">
                    {papers.map((paper) => (
                      <div key={paper.id} className="p-6 bg-bg-surface rounded-lg border border-border-subtle">
                        <h3 className="text-lg font-semibold text-text-primary mb-2">
                          {paper.title}
                        </h3>
                        <p className="text-small text-text-secondary mb-2">
                          {paper.authors.join(', ')}
                        </p>
                        <p className="text-caption text-text-tertiary mb-4">
                          {paper.publication_date} • {paper.doi}
                        </p>
                        <span className={`inline-block px-2 py-1 rounded-full text-caption ${
                          paper.status === 'Read' ? 'bg-success-bg text-success' :
                          paper.status === 'Reading' ? 'bg-warning-bg text-warning' :
                          'bg-bg-base text-text-tertiary'
                        }`}>
                          {paper.status.replace('_', ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : currentView === 'ideas' ? (
            <div className="p-6">
              <div className="max-w-4xl mx-auto">
                {ideas.length === 0 ? (
                  <div className="text-center py-12">
                    <h2 className="text-title font-semibold text-text-primary mb-4">
                      Ideas Workspace
                    </h2>
                    <p className="text-body text-text-secondary mb-6">
                      Capture and develop your research ideas.
                    </p>
                    <p className="text-caption text-text-tertiary">
                      Use the "New Idea" button in the left sidebar to add your first idea.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-6 md:grid-cols-2">
                    {ideas.map((idea) => (
                      <div key={idea.id} className="p-6 bg-bg-surface rounded-lg border border-border-subtle">
                        <h3 className="text-lg font-semibold text-text-primary mb-2">
                          {idea.title}
                        </h3>
                        <p className="text-body text-text-secondary mb-4">
                          {idea.description}
                        </p>
                        <span className={`inline-block px-2 py-1 rounded-full text-caption ${
                          idea.stage === 'Mature' ? 'bg-success-bg text-success' :
                          idea.stage === 'Developing' ? 'bg-warning-bg text-warning' :
                          'bg-bg-base text-text-tertiary'
                        }`}>
                          {idea.stage}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
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

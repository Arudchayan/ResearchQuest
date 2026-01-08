import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { useAppStore } from './store/appStore'
import { useGamificationStore } from './store/gamificationStore'
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
import { AppLoadingSkeleton } from './components/ui/Skeleton'
import { Toaster } from 'sonner'
import type { User } from '@supabase/supabase-js'
import { usePapers } from './hooks/usePapers'
import { useIdeas } from './hooks/useIdeas'
import { useDataSync } from './hooks/useDataSync'
import { FocusWorkspace } from './components/focus/FocusWorkspace'
import { IdeasOverview } from './components/ideas/IdeasOverview'
import { OnboardingGuide } from './components/layout/OnboardingGuide'
import { CommandMenu } from './components/layout/CommandMenu'

export function AuthScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(false)
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

  const handlePasswordReset = async () => {
    if (!email) {
      setMessage('Enter your email address to receive a reset link.')
      return
    }

    setResetting(true)
    setMessage('')

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email)

      if (error) throw error

      setMessage('Password reset link sent! Check your email to continue.')
    } catch (error: any) {
      setMessage(error.message || 'Unable to send password reset email. Please try again.')
    } finally {
      setResetting(false)
    }
  }

  const handleOAuthLogin = async () => {
    setOauthLoading(true)
    setMessage('')

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) throw error
    } catch (error: any) {
      setMessage(
        error?.message ||
          'Unable to start Google sign-in. Please try again or use email/password.',
      )
    } finally {
      setOauthLoading(false)
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
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleOAuthLogin}
              disabled={oauthLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-border-subtle rounded-md text-body font-medium text-text-primary hover:border-primary-500 hover:text-primary-600 transition-colors disabled:opacity-60"
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 533.5 544.3"
                aria-hidden="true"
              >
                <path
                  fill="#4285f4"
                  d="M533.5 278.4c0-17.4-1.6-34.1-4.6-50.3H272v95.2h147.5c-6.4 34.7-25.7 64-54.7 83.6v69.4h88.5c51.8-47.8 80.2-118.2 80.2-197.9z"
                />
                <path
                  fill="#34a853"
                  d="M272 544.3c73.8 0 135.8-24.5 181.1-66.6l-88.5-69.4c-24.6 16.5-56.1 26-92.6 26-71.2 0-131.5-48-153.1-112.5H27.6v70.7c45 89.1 137.5 151.8 244.4 151.8z"
                />
                <path
                  fill="#fbbc05"
                  d="M118.9 322.8c-10.9-32.6-10.9-67.6 0-100.2V151.9H27.6c-46.5 92-46.5 201.1 0 293.1l91.3-70.2z"
                />
                <path
                  fill="#ea4335"
                  d="M272 107.7c39.9-.6 78.2 14.9 107.3 42.9l80-80C405.8 24.2 344.1-1.3 272 0 165.1 0 72.6 62.7 27.6 151.9l91.3 70.7C140.5 155.7 200.8 107.7 272 107.7z"
                />
              </svg>
              {oauthLoading ? 'Contacting Google…' : 'Continue with Google'}
            </button>

            <div className="flex items-center gap-3 text-small text-text-secondary">
              <span className="h-px flex-1 bg-border-subtle" aria-hidden="true" />
              <span>or use email</span>
              <span className="h-px flex-1 bg-border-subtle" aria-hidden="true" />
            </div>
          </div>

          <div>
            <label className="block text-small font-medium text-text-primary mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={254}
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
              maxLength={100}
              className="w-full px-4 py-3 bg-bg-base border border-border-subtle rounded-md text-body focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={handlePasswordReset}
              disabled={resetting}
              className="mt-2 text-small text-primary-500 hover:text-primary-600 disabled:opacity-60"
            >
              {resetting ? 'Sending reset link…' : 'Forgot password?'}
            </button>
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
  const {
    setUser: setUserProfile,
    currentView,
    setCurrentView,
    selectedNote,
    selectedPaper,
    selectedIdea,
    setSelectedIdea,
  } = useAppStore()
  const hydrateGamification = useGamificationStore(state => state.hydrateFromProfile)
  
  // Sync data centrally
  useDataSync(userId)

  // Get hooks for CRUD operations (data comes from store now)
  const { papers, loading: papersLoading, searchPaperByDOI, searchPapersByQuery, createPaper, updatePaper } = usePapers(userId)
  const { ideas, loading: ideasLoading, createIdea, updateIdea } = useIdeas(userId)
  
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
            hydrateGamification(data)
          }
        })
    } else {
      setUserProfile(null)
      hydrateGamification({ streak_freeze_tokens: 0, rest_days: 0, active_boost: null })
    }
  }, [user, setUserProfile, hydrateGamification])
  
  // URL-based routing - handle initial load and navigation
  useEffect(() => {
    const handleRouteChange = () => {
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
      if (['notes', 'papers', 'ideas', 'tasks', 'focus'].includes(view)) {
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
        useAppStore.getState().setSelectedIdea(null)
        setItemNotFound(true)
      }
    }
  }, [currentView, ideas, ideasLoading, papers, papersLoading, userId])
  
  if (loading) {
    return <AppLoadingSkeleton />
  }
  
  if (!user) {
    return <AuthScreen />
  }
  
  return (
    <div className="min-h-screen-dynamic bg-bg-base">
      {/* Global Command Menu */}
      <CommandMenu />

      {/* Toast Notifications */}
      <Toaster
        position="top-right"
        richColors
        expand={false}
        duration={2500}
        offset={16}
        visibleToasts={3}
        theme={useAppStore.getState().effectiveTheme}
        closeButton
        toastOptions={{ duration: 2500 }}
      />
      
      {/* Mobile Navigation */}
      <MobileMenu />
      
      {/* TopNav - Fixed positioning */}
      <TopNav />
      
      {/* Main Layout Container */}
      <div className="pt-16 flex min-h-screen-dynamic flex-col lg:flex-row">
        {/* Left Sidebar - Hidden on mobile, 280px on desktop */}
        <aside className="hidden lg:flex lg:flex-col lg:w-70 bg-bg-surface border-r border-border-subtle order-2 lg:order-1">
          <LeftSidebar />
        </aside>

        {/* Main Content Area - Takes remaining space */}
        <main className="flex-1 overflow-auto order-1 lg:order-2 min-h-[calc(100dvh-4rem)]">
          {currentView === 'tasks' ? (
            <div className="p-4 sm:p-6 space-y-6">
              <OnboardingGuide />
              <TaskManager />
            </div>
          ) : currentView === 'notes' ? (
            selectedNote ? (
              <MarkdownEditor />
            ) : (
              <div className="p-4 sm:p-6 space-y-6">
                <OnboardingGuide />
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
              <div className="p-4 sm:p-6 space-y-6">
                <OnboardingGuide />
                <ItemNotFound itemType="paper" />
              </div>
            ) : selectedPaper ? (
              <div className="p-4 sm:p-6 space-y-6">
                <OnboardingGuide />
                <PaperDetailView
                  paper={selectedPaper}
                  onUpdate={updatePaper}
                />
              </div>
            ) : (
              <div className="p-4 sm:p-6 space-y-6">
                <OnboardingGuide />
                <AddPaperView
                  onAdd={async (paperData) => {
                    const newPaper = await createPaper(paperData)
                    return newPaper
                  }}
                  searchByDOI={searchPaperByDOI}
                  searchByQuery={searchPapersByQuery}
                />
              </div>
            )
          ) : currentView === 'ideas' ? (
            itemNotFound ? (
              <div className="p-4 sm:p-6 space-y-6">
                <OnboardingGuide />
                <ItemNotFound
                  itemType="idea"
                  description="We couldn't find that idea. It may have been deleted or moved to another account."
                  onReturn={() => {
                    setItemNotFound(false)
                    setSelectedIdea(null)
                    window.history.replaceState(null, '', '/ideas')
                  }}
                />
              </div>
            ) : selectedIdea ? (
              <div className="p-4 sm:p-6 space-y-6">
                <OnboardingGuide />
                <IdeaDetailView
                  idea={selectedIdea}
                  onUpdate={updateIdea}
                />
              </div>
            ) : (
              <div className="p-4 sm:p-6 space-y-6">
                <OnboardingGuide />
                <IdeasOverview
                  ideas={ideas}
                  loading={ideasLoading}
                  onCreate={async (payload) => {
                    const created = await createIdea(payload)
                    if (created) {
                      setSelectedIdea(created)
                      window.history.pushState(null, '', `/ideas/${created.id}`)
                    }
                    return created ?? null
                  }}
                  onSelect={(idea) => {
                    setSelectedIdea(idea)
                    window.history.pushState(null, '', `/ideas/${idea.id}`)
                  }}
                />
              </div>
            )
          ) : currentView === 'focus' ? (
            <div className="p-4 sm:p-6 space-y-6">
              <OnboardingGuide storageKey="rq_focus_onboarding_bridge" />
              <FocusWorkspace userId={userId} />
            </div>
          ) : null}
        </main>
        
        {/* Right Sidebar - Hidden on tablet and below, 320px on desktop */}
        <aside className="hidden xl:flex xl:flex-col xl:w-80 bg-bg-surface border-l border-border-subtle order-3">
          <RightSidebar />
        </aside>
      </div>
    </div>
  )
}

export default App
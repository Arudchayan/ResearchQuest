import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { useAppStore } from './store/appStore'
import { useGamificationStore } from './store/gamificationStore'
import { AppShell } from './components/layout/v2/AppShell'
import { NotesView } from './components/notes/NotesView'
import { PapersView } from './components/papers/PapersView'
import { IdeasBoard } from './components/ideas/IdeasBoard'
import { TaskManager } from './components/tasks/TaskManager'
import { FocusWorkspace } from './components/focus/FocusWorkspace'
import { AppLoadingSkeleton } from './components/ui/Skeleton'
import { Toaster } from 'sonner'
import type { User } from '@supabase/supabase-js'
import { usePapers } from './hooks/usePapers'
import { useIdeas } from './hooks/useIdeas'
import { useDataSync } from './hooks/useDataSync'
import { OnboardingGuide } from './components/layout/OnboardingGuide'
import { CommandPalette } from './components/layout/CommandPalette'

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

  const handleTestLogin = async () => {
    setLoading(true)
    setMessage('')

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: 'arudchayan01@gmail.com',
        password: '3As278ePfWCBFLZ',
      })

      if (error) throw error
    } catch (error: any) {
      setMessage(error.message || 'An error occurred during test login')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 transition-colors">
      <div className="w-full max-w-md p-8 bg-white dark:bg-slate-950 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-blue-600/20">
            RQ
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">ResearchQuest</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">
            Your scientific research companion
          </p>
        </div>
        
        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleOAuthLogin}
              disabled={oauthLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 font-medium hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all disabled:opacity-60 bg-white dark:bg-slate-900"
            >
              <svg className="w-5 h-5" viewBox="0 0 533.5 544.3" aria-hidden="true">
                <path fill="#4285f4" d="M533.5 278.4c0-17.4-1.6-34.1-4.6-50.3H272v95.2h147.5c-6.4 34.7-25.7 64-54.7 83.6v69.4h88.5c51.8-47.8 80.2-118.2 80.2-197.9z" />
                <path fill="#34a853" d="M272 544.3c73.8 0 135.8-24.5 181.1-66.6l-88.5-69.4c-24.6 16.5-56.1 26-92.6 26-71.2 0-131.5-48-153.1-112.5H27.6v70.7c45 89.1 137.5 151.8 244.4 151.8z" />
                <path fill="#fbbc05" d="M118.9 322.8c-10.9-32.6-10.9-67.6 0-100.2V151.9H27.6c-46.5 92-46.5 201.1 0 293.1l91.3-70.2z" />
                <path fill="#ea4335" d="M272 107.7c39.9-.6 78.2 14.9 107.3 42.9l80-80C405.8 24.2 344.1-1.3 272 0 165.1 0 72.6 62.7 27.6 151.9l91.3 70.7C140.5 155.7 200.8 107.7 272 107.7z" />
              </svg>
              {oauthLoading ? 'Contacting Google…' : 'Continue with Google'}
            </button>

            <button
              type="button"
              onClick={handleTestLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg text-slate-500 dark:text-slate-400 font-medium hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all disabled:opacity-60"
            >
              🛠️ Use Test Login
            </button>

            <div className="flex items-center gap-3 text-sm text-slate-400">
              <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
              <span>or use email</span>
              <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={254}
              className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
              placeholder="researcher@example.com"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              maxLength={100}
              className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={handlePasswordReset}
              disabled={resetting}
              className="mt-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-60 font-medium"
            >
              {resetting ? 'Sending reset link…' : 'Forgot password?'}
            </button>
          </div>

          {message && (
            <div className={`p-3 rounded-lg text-sm font-medium ${
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
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 shadow-lg shadow-blue-600/20"
          >
            {loading ? 'Loading...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp)
              setMessage('')
            }}
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
          >
            {isSignUp ? 'Already have an account? Sign in' : 'New to ResearchQuest? Create account'}
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
    selectedPaper,
    selectedIdea,
    setSelectedIdea,
    setSelectedPaper
  } = useAppStore()
  const hydrateGamification = useGamificationStore(state => state.hydrateFromProfile)
  
  // Sync data centrally
  useDataSync(userId)

  // Get hooks for CRUD operations (data comes from store now)
  const { papers, loading: papersLoading } = usePapers(userId)
  const { ideas, loading: ideasLoading } = useIdeas(userId)
  
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
        setCurrentView(view)
      } else {
        // Invalid route, redirect to notes
        window.history.replaceState(null, '', '/')
        setCurrentView('notes')
      }
    }
    
    // Handle initial load
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
        useAppStore.getState().setSelectedPaper(paper)
        setItemNotFound(false)
      } else if (!papersLoading) {
        setItemNotFound(true)
      }
    } else if (view === 'ideas' && ideas.length >= 0) {
      const idea = ideas.find(i => i.id === itemId)
      if (idea) {
        useAppStore.getState().setSelectedIdea(idea)
        setItemNotFound(false)
      } else if (!ideasLoading) {
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
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <CommandPalette />

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
      
      <AppShell>
        {currentView === 'notes' ? (
          <NotesView />
        ) : currentView === 'papers' ? (
          <PapersView />
        ) : currentView === 'ideas' ? (
          <IdeasBoard />
        ) : currentView === 'tasks' ? (
          <div className="p-6 h-full overflow-auto">
            <OnboardingGuide />
            <TaskManager />
          </div>
        ) : currentView === 'focus' ? (
          <div className="p-6 h-full overflow-auto">
            <OnboardingGuide storageKey="rq_focus_onboarding_bridge" />
            <FocusWorkspace userId={userId} />
          </div>
        ) : null}
      </AppShell>
    </div>
  )
}

export default App
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
    <div className="min-h-screen flex items-center justify-center bg-bg-base p-4">
      <div className="w-full max-w-md p-8 bg-bg-surface rounded-lg shadow-lg border border-border-subtle">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-500 rounded-lg mx-auto mb-4 flex items-center justify-center text-white font-bold text-xl">
            RQ
          </div>
          <h1 className="text-2xl font-bold text-text-primary">ResearchQuest</h1>
          <p className="text-sm text-text-secondary mt-2">
            Gamified research management
          </p>
        </div>
        
        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-bg-base border border-border-subtle rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="researcher@example.com"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 bg-bg-base border border-border-subtle rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="••••••••"
            />
          </div>
          
          {message && (
            <div className={`p-3 rounded-md text-sm ${
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
            className="text-sm text-primary-500 hover:text-primary-600"
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
  const [editingNote, setEditingNote] = useState<any | null>(null)
  const [editingIdea, setEditingIdea] = useState<any | null>(null)
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
  
  // Simple navigation handler
  const handleNavigation = (view: typeof currentView) => {
    console.log('Navigation called:', view)
    setCurrentView(view)
  }
  
  // Add new content handlers
  const handleAddNew = async (type: string) => {
    console.log('Add new called:', type)
    if (type === 'note') {
      const newNote = await createNote({
        markdown_body: '# New Note\n\nStart writing your research notes here...',
        tags: [],
      })
      if (newNote) {
        setEditingNote(newNote)
      }
    } else if (type === 'idea') {
      const title = prompt('Enter idea title:')
      if (title) {
        const newIdea = await createIdea({
          title,
          stage: 'Seed',
        })
        if (newIdea) {
          setEditingIdea(newIdea)
        }
      }
    }
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
    <div className="min-h-screen bg-bg-base">
      {/* Top Navigation */}
      <TopNav />
      
      {/* Main Layout - Simple approach */}
      <div className="flex h-screen pt-16">
        {/* Left Sidebar */}
        <div className="w-80 bg-bg-surface border-r border-border-subtle">
          <div className="p-4 space-y-4 h-full overflow-y-auto">
            {/* Navigation */}
            <nav className="space-y-2">
              {[
                { id: 'notes', label: 'Notes', icon: '📝' },
                { id: 'papers', label: 'Papers', icon: '📚' },
                { id: 'ideas', label: 'Ideas', icon: '💡' },
                { id: 'tasks', label: 'Tasks', icon: '✅' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleNavigation(tab.id as typeof currentView)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-md transition-colors ${
                    currentView === tab.id
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-text-secondary hover:bg-bg-elevated'
                  }`}
                >
                  <span className="text-lg">{tab.icon}</span>
                  <span className="font-medium">{tab.label}</span>
                </button>
              ))}
            </nav>
            
            {/* Search */}
            <input
              type="text"
              placeholder="Search..."
              className="w-full px-4 py-2 bg-bg-base border border-border-subtle rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              onChange={(e) => console.log('Search:', e.target.value)}
            />
            
            {/* Add Button */}
            {currentView !== 'tasks' && (
              <button
                onClick={() => handleAddNew(currentView.slice(0, -1))}
                className="w-full px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors font-medium"
              >
                New {currentView.slice(0, -1)}
              </button>
            )}
            
            {/* Content List */}
            <div className="space-y-2">
              {currentView === 'notes' && notes.map((note) => (
                <button
                  key={note.id}
                  onClick={() => setEditingNote(note)}
                  className="w-full p-3 bg-bg-elevated rounded-md border hover:border-primary-500 transition-colors text-left"
                >
                  <h4 className="font-medium text-sm">
                    {note.title || note.markdown_body.split('\n')[0]?.replace(/^#+\s*/, '') || 'Untitled'}
                  </h4>
                </button>
              ))}
              {currentView === 'papers' && papers.map((paper) => (
                <div key={paper.id} className="p-3 bg-bg-elevated rounded-md border">
                  <h4 className="font-medium text-sm">{paper.title}</h4>
                  <p className="text-xs text-text-secondary">{paper.authors.join(', ')}</p>
                </div>
              ))}
              {currentView === 'ideas' && ideas.map((idea) => (
                <button
                  key={idea.id}
                  onClick={() => setEditingIdea(idea)}
                  className="w-full p-3 bg-bg-elevated rounded-md border hover:border-primary-500 transition-colors text-left"
                >
                  <h4 className="font-medium text-sm">{idea.title}</h4>
                  <p className="text-xs text-text-secondary">Stage: {idea.stage}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            {currentView === 'tasks' ? (
              <TaskManager />
            ) : currentView === 'notes' ? (
              <div>
                <h2 className="text-2xl font-bold mb-6">Notes</h2>
                {notes.length === 0 ? (
                  <div className="text-center py-12 text-text-secondary">
                    <p>No notes yet. Create your first note above!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {notes.map((note) => (
                      <div key={note.id} className="p-4 bg-bg-surface rounded-lg border">
                        <h3 className="font-semibold mb-2">
                          {note.title || note.markdown_body.split('\n')[0]?.replace(/^#+\s*/, '') || 'Untitled Note'}
                        </h3>
                        <div className="text-sm text-text-secondary whitespace-pre-wrap">
                          {note.markdown_body}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : currentView === 'papers' ? (
              <div>
                <h2 className="text-2xl font-bold mb-6">Papers</h2>
                {papers.length === 0 ? (
                  <div className="text-center py-12 text-text-secondary">
                    <p>No papers yet. Add papers to build your knowledge base!</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {papers.map((paper) => (
                      <div key={paper.id} className="p-4 bg-bg-surface rounded-lg border">
                        <h3 className="font-semibold mb-2">{paper.title}</h3>
                        <p className="text-sm text-text-secondary mb-2">
                          {paper.authors.join(', ')}
                        </p>
                        <p className="text-xs text-text-tertiary">
                          {paper.publication_date} • {paper.doi}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : currentView === 'ideas' ? (
              <div>
                <h2 className="text-2xl font-bold mb-6">Ideas</h2>
                {ideas.length === 0 ? (
                  <div className="text-center py-12 text-text-secondary">
                    <p>No ideas yet. Capture your research ideas above!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {ideas.map((idea) => (
                      <div key={idea.id} className="p-4 bg-bg-surface rounded-lg border">
                        <h3 className="font-semibold mb-2">{idea.title}</h3>
                        <p className="text-sm text-text-secondary mb-2">
                          {idea.description}
                        </p>
                        <span className="inline-block px-2 py-1 bg-primary-100 text-primary-700 rounded-full text-xs">
                          {idea.stage}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
        
        {/* Right Sidebar */}
        <div className="w-80 bg-bg-surface border-l border-border-subtle">
          <div className="p-4">
            <h3 className="font-semibold mb-4">Activity</h3>
            <div className="text-sm text-text-secondary">
              <p>Welcome to ResearchQuest!</p>
              <p className="mt-2">Start by creating your first note, paper, or idea.</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Note Editor Modal */}
      {editingNote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-surface rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b border-border-subtle flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">Edit Note</h2>
              <button
                onClick={() => setEditingNote(null)}
                className="text-text-secondary hover:text-text-primary transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Modal Body */}
            <div className="flex-1 overflow-auto p-4">
              <textarea
                value={editingNote.markdown_body}
                onChange={(e) => {
                  const newValue = e.target.value
                  setEditingNote({ ...editingNote, markdown_body: newValue })
                  updateNote(editingNote.id, { markdown_body: newValue })
                }}
                className="w-full h-full min-h-[400px] p-4 bg-bg-base border border-border-subtle rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                placeholder="Start writing..."
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Idea Editor Modal */}
      {editingIdea && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-surface rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b border-border-subtle flex items-center justify-between">
              <input
                type="text"
                value={editingIdea.title}
                onChange={(e) => {
                  const newTitle = e.target.value
                  setEditingIdea({ ...editingIdea, title: newTitle })
                  updateIdea(editingIdea.id, { title: newTitle })
                }}
                className="text-lg font-semibold text-text-primary bg-transparent border-none focus:outline-none flex-1"
                placeholder="Idea title..."
              />
              <button
                onClick={() => setEditingIdea(null)}
                className="text-text-secondary hover:text-text-primary transition-colors ml-4"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Modal Body */}
            <div className="flex-1 overflow-auto p-4">
              <textarea
                value={editingIdea.description || ''}
                onChange={(e) => {
                  const newValue = e.target.value
                  setEditingIdea({ ...editingIdea, description: newValue })
                  updateIdea(editingIdea.id, { description: newValue })
                }}
                className="w-full h-full min-h-[400px] p-4 bg-bg-base border border-border-subtle rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                placeholder="Describe your idea..."
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
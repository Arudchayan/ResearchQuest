import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ThemePreference, UserProfile, Note, Paper, Idea, TopicWithCounts, Task } from '../types/database'

interface AppState {
  // Theme
  theme: ThemePreference
  effectiveTheme: 'light' | 'dark'
  setTheme: (theme: ThemePreference) => void
  
  // User
  user: UserProfile | null
  setUser: (user: UserProfile | null) => void
  
  // Current view
  currentView: 'dashboard' | 'notes' | 'papers' | 'ideas' | 'tasks' | 'focus'
  setCurrentView: (view: 'dashboard' | 'notes' | 'papers' | 'ideas' | 'tasks' | 'focus') => void
  
  // Selected entity
  selectedNote: Note | null
  selectedPaper: Paper | null
  selectedIdea: Idea | null
  selectedTopic: TopicWithCounts | null
  setSelectedNote: (note: Note | null) => void
  setSelectedPaper: (paper: Paper | null) => void
  setSelectedIdea: (idea: Idea | null) => void
  setSelectedTopic: (topic: TopicWithCounts | null) => void

  // Entity collections (Global Cache)
  notes: Note[]
  papers: Paper[]
  ideas: Idea[]
  tasks: Task[]
  notesLoading: boolean
  papersLoading: boolean
  ideasLoading: boolean
  tasksLoading: boolean
  setNotes: (notes: Note[]) => void
  setPapers: (papers: Paper[]) => void
  setIdeas: (ideas: Idea[]) => void
  setTasks: (tasks: Task[]) => void
  setNotesLoading: (loading: boolean) => void
  setPapersLoading: (loading: boolean) => void
  setIdeasLoading: (loading: boolean) => void
  setTasksLoading: (loading: boolean) => void

  // Topics collection
  topics: TopicWithCounts[]
  setTopics: (topics: TopicWithCounts[]) => void
  upsertTopic: (topic: TopicWithCounts) => void
  removeTopic: (topicId: string) => void
  
  // UI state
  isMobileSidebarOpen: boolean
  isRightSidebarOpen: boolean
  isZenMode: boolean
  setIsMobileSidebarOpen: (open: boolean) => void
  setIsRightSidebarOpen: (open: boolean) => void
  toggleZenMode: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Theme
      theme: 'auto',
      effectiveTheme: 'light',
      setTheme: (theme) => {
        const effectiveTheme =
          theme === 'auto'
            ? window.matchMedia('(prefers-color-scheme: dark)').matches
              ? 'dark'
              : 'light'
            : theme
        
        // Apply theme to document
        document.documentElement.classList.remove('light', 'dark')
        document.documentElement.classList.add(effectiveTheme)
        
        set({ theme, effectiveTheme })
      },
      
      // User
      user: null,
      setUser: (user) => set({ user }),
      
      // Current view
      currentView: 'dashboard',
      setCurrentView: (currentView) => set({ currentView }),
      
      // Selected entities
      selectedNote: null,
      selectedPaper: null,
      selectedIdea: null,
      selectedTopic: null,
      setSelectedNote: (selectedNote) => set({ selectedNote }),
      setSelectedPaper: (selectedPaper) => set({ selectedPaper }),
      setSelectedIdea: (selectedIdea) => set({ selectedIdea }),
      setSelectedTopic: (selectedTopic) => set({ selectedTopic }),

      // Entity collections (Global Cache)
      notes: [],
      papers: [],
      ideas: [],
      tasks: [],
      notesLoading: false,
      papersLoading: false,
      ideasLoading: false,
      tasksLoading: false,
      setNotes: (notes) => set({ notes }),
      setPapers: (papers) => set({ papers }),
      setIdeas: (ideas) => set({ ideas }),
      setTasks: (tasks) => set({ tasks }),
      setNotesLoading: (notesLoading) => set({ notesLoading }),
      setPapersLoading: (papersLoading) => set({ papersLoading }),
      setIdeasLoading: (ideasLoading) => set({ ideasLoading }),
      setTasksLoading: (tasksLoading) => set({ tasksLoading }),

      // Topics collection state
      topics: [],
      setTopics: (topics) => set({ topics }),
      upsertTopic: (topic) =>
        set((state) => {
          const existingIndex = state.topics.findIndex(t => t.id === topic.id)
          if (existingIndex === -1) {
            return { topics: [topic, ...state.topics] }
          }
          const updated = [...state.topics]
          updated[existingIndex] = topic
          return { topics: updated }
        }),
      removeTopic: (topicId) =>
        set((state) => ({ topics: state.topics.filter(topic => topic.id !== topicId) })),
      
      // UI state
      isMobileSidebarOpen: false,
      isRightSidebarOpen: false,
      isZenMode: false,
      setIsMobileSidebarOpen: (isMobileSidebarOpen) => set({ isMobileSidebarOpen }),
      setIsRightSidebarOpen: (isRightSidebarOpen) => set({ isRightSidebarOpen }),
      toggleZenMode: () => set((state) => ({ isZenMode: !state.isZenMode })),
    }),
    {
      name: 'researchquest-storage',
      partialize: (state) => ({
        theme: state.theme,
      }),
    }
  )
)

// Initialize theme on load
if (typeof window !== 'undefined') {
  const store = useAppStore.getState()
  store.setTheme(store.theme)
  
  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const currentTheme = useAppStore.getState().theme
    if (currentTheme === 'auto') {
      useAppStore.getState().setTheme('auto')
    }
  })
}

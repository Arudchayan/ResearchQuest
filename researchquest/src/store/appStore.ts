import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ThemePreference, UserProfile, Note, Paper, Idea, Topic } from '../types/database'

interface AppState {
  // Theme
  theme: ThemePreference
  effectiveTheme: 'light' | 'dark'
  setTheme: (theme: ThemePreference) => void
  
  // User
  user: UserProfile | null
  setUser: (user: UserProfile | null) => void
  
  // Current view
  currentView: 'notes' | 'papers' | 'ideas' | 'tasks' | 'topics'
  setCurrentView: (view: 'notes' | 'papers' | 'ideas' | 'tasks' | 'topics') => void
  
  // Selected entity
  selectedNote: Note | null
  selectedPaper: Paper | null
  selectedIdea: Idea | null
  selectedTopic: Topic | null
  setSelectedNote: (note: Note | null) => void
  setSelectedPaper: (paper: Paper | null) => void
  setSelectedIdea: (idea: Idea | null) => void
  setSelectedTopic: (topic: Topic | null) => void
  
  // UI state
  isMobileSidebarOpen: boolean
  isRightSidebarOpen: boolean
  setIsMobileSidebarOpen: (open: boolean) => void
  setIsRightSidebarOpen: (open: boolean) => void
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
      currentView: 'notes',
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
      
      // UI state
      isMobileSidebarOpen: false,
      isRightSidebarOpen: false,
      setIsMobileSidebarOpen: (isMobileSidebarOpen) => set({ isMobileSidebarOpen }),
      setIsRightSidebarOpen: (isRightSidebarOpen) => set({ isRightSidebarOpen }),
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

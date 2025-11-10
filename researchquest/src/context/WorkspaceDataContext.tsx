import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { Idea, Note, Paper, CrossrefPaper } from '../types/database'
import type { PaperSearchOptions } from '../hooks/usePapers'

/* eslint-disable react-refresh/only-export-components */

export interface WorkspaceDataContextValue {
  notes: Note[]
  notesLoading: boolean
  createNote: (noteData: Partial<Note>) => Promise<Note | null>
  updateNote: (noteId: string, updates: Partial<Note>) => Promise<boolean>
  deleteNote: (noteId: string) => Promise<boolean>
  refreshNotes: () => Promise<void>
  papers: Paper[]
  papersLoading: boolean
  createPaper: (paperData: Partial<Paper>) => Promise<Paper | null>
  updatePaper: (paperId: string, updates: Partial<Paper>) => Promise<boolean>
  deletePaper: (paperId: string) => Promise<boolean>
  refreshPapers: () => Promise<void>
  searchPaperByDOI: (doi: string) => Promise<CrossrefPaper | null>
  searchPapersByQuery: (query: string, options?: PaperSearchOptions) => Promise<CrossrefPaper[]>
  ideas: Idea[]
  ideasLoading: boolean
  createIdea: (ideaData: Partial<Idea>) => Promise<Idea | null>
  updateIdea: (ideaId: string, updates: Partial<Idea>, previousStage?: Idea['stage']) => Promise<boolean>
  deleteIdea: (ideaId: string) => Promise<boolean>
  refreshIdeas: () => Promise<void>
}

const WorkspaceDataContext = createContext<WorkspaceDataContextValue | undefined>(undefined)

interface WorkspaceDataProviderProps {
  value: WorkspaceDataContextValue
  children: ReactNode
}

export function WorkspaceDataProvider({ value, children }: WorkspaceDataProviderProps) {
  return <WorkspaceDataContext.Provider value={value}>{children}</WorkspaceDataContext.Provider>
}

export function useWorkspaceData() {
  const context = useContext(WorkspaceDataContext)
  if (!context) {
    throw new Error('useWorkspaceData must be used within a WorkspaceDataProvider')
  }
  return context
}

/* eslint-enable react-refresh/only-export-components */

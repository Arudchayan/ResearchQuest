import { create } from "zustand";
import type { Note, Paper, Idea } from "../types/database";

export interface DashboardLibrarySnapshot {
  recentNotes: Note[];
  readingList: Paper[];
  activeIdeas: Idea[];
  counts: {
    notes: number;
    papers: number;
    ideas: number;
  };
  loading: boolean;
}

const createEmptyDashboardLibrary = (): DashboardLibrarySnapshot => ({
  recentNotes: [],
  readingList: [],
  activeIdeas: [],
  counts: {
    notes: 0,
    papers: 0,
    ideas: 0,
  },
  loading: false,
});

/**
 * Library slice: the notes / papers / ideas collections (global cache),
 * their selection, loading flags, and lightweight dashboard previews.
 */
export interface LibrarySlice {
  // Entity collections (Global Cache)
  notes: Note[];
  papers: Paper[];
  ideas: Idea[];
  notesLoading: boolean;
  papersLoading: boolean;
  ideasLoading: boolean;
  setNotes: (notes: Note[]) => void;
  setPapers: (papers: Paper[]) => void;
  setIdeas: (ideas: Idea[]) => void;
  setNotesLoading: (loading: boolean) => void;
  setPapersLoading: (loading: boolean) => void;
  setIdeasLoading: (loading: boolean) => void;

  // Selected entities
  selectedNote: Note | null;
  selectedPaper: Paper | null;
  selectedIdea: Idea | null;
  setSelectedNote: (note: Note | null) => void;
  setSelectedPaper: (paper: Paper | null) => void;
  setSelectedIdea: (idea: Idea | null) => void;

  // Lightweight dashboard previews/counts. These do not imply full collections are loaded.
  dashboardLibrary: DashboardLibrarySnapshot;
  setDashboardLibrary: (dashboardLibrary: DashboardLibrarySnapshot) => void;
  setDashboardLibraryLoading: (loading: boolean) => void;
  resetDashboardLibrary: () => void;
}

export const useLibraryStore = create<LibrarySlice>()((set) => ({
  // Entity collections (Global Cache)
  notes: [],
  papers: [],
  ideas: [],
  notesLoading: false,
  papersLoading: false,
  ideasLoading: false,
  setNotes: (notes) => set({ notes }),
  setPapers: (papers) => set({ papers }),
  setIdeas: (ideas) => set({ ideas }),
  setNotesLoading: (notesLoading) => set({ notesLoading }),
  setPapersLoading: (papersLoading) => set({ papersLoading }),
  setIdeasLoading: (ideasLoading) => set({ ideasLoading }),

  // Selected entities
  selectedNote: null,
  selectedPaper: null,
  selectedIdea: null,
  setSelectedNote: (selectedNote) => set({ selectedNote }),
  setSelectedPaper: (selectedPaper) => set({ selectedPaper }),
  setSelectedIdea: (selectedIdea) => set({ selectedIdea }),

  dashboardLibrary: createEmptyDashboardLibrary(),
  setDashboardLibrary: (dashboardLibrary) => set({ dashboardLibrary }),
  setDashboardLibraryLoading: (loading) =>
    set((state) => ({
      dashboardLibrary: {
        ...state.dashboardLibrary,
        loading,
      },
    })),
  resetDashboardLibrary: () =>
    set({ dashboardLibrary: createEmptyDashboardLibrary() }),
}));

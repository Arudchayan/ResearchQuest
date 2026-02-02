import { useState, useMemo, useCallback } from 'react'
import { Plus, Search, BookOpen, X, ArrowUpDown, Users } from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import { usePapers } from '../../hooks/usePapers'
import { AddPaperView } from '../entities/AddPaperView'
import { PaperDetailView } from '../entities/PaperDetailView'
import { PaperCard } from './PaperCard'
import { cn } from '../../lib/utils'
import * as Dialog from '@radix-ui/react-dialog'
import { OnboardingGuide } from '../layout/OnboardingGuide'
import type { Paper } from '../../types/database'

type SortOption =
  | 'updated_desc'
  | 'updated_asc'
  | 'created_desc'
  | 'created_asc'
  | 'title_asc'
  | 'title_desc'
  | 'year_desc'
  | 'year_asc'

export function PapersView() {
  const { papers, selectedPaper, setSelectedPaper } = useAppStore()
  const { createPaper, updatePaper, searchPaperByDOI, searchPapersByQuery } = usePapers(useAppStore.getState().user?.id)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOption, setSortOption] = useState<SortOption>('updated_desc')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)

  const handleSelectPaper = useCallback((paper: Paper) => {
    setSelectedPaper(paper)
  }, [setSelectedPaper])

  // Memoize filtered papers to avoid expensive recalculation on every render
  const filteredPapers = useMemo(() => {
    // Optimization: Calculate query lowercasing once outside the loop
    const query = searchQuery.toLowerCase()
    const filtered = papers.filter(paper => {
      return (
        (paper.title && paper.title.toLowerCase().includes(query)) ||
        (paper.authors && paper.authors.some(a => a.toLowerCase().includes(query)))
      )
    })

    return filtered.sort((a, b) => {
      switch (sortOption) {
        case 'updated_desc':
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        case 'updated_asc':
          return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
        case 'created_desc':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'created_asc':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'title_asc':
          return (a.title || '').localeCompare(b.title || '')
        case 'title_desc':
          return (b.title || '').localeCompare(a.title || '')
        case 'year_desc': {
          const yearA = a.publication_date ? new Date(a.publication_date).getFullYear() : 0
          const yearB = b.publication_date ? new Date(b.publication_date).getFullYear() : 0
          return yearB - yearA
        }
        case 'year_asc': {
          const yearA2 = a.publication_date ? new Date(a.publication_date).getFullYear() : 0
          const yearB2 = b.publication_date ? new Date(b.publication_date).getFullYear() : 0
          return yearA2 - yearB2
        }
        default:
          return 0
      }
    })
  }, [papers, searchQuery, sortOption])

  return (
    <div className="flex h-full bg-slate-50 dark:bg-slate-900 overflow-hidden">
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Research Library</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Manage and organize your research papers</p>
          </div>
          <button
            onClick={() => setIsAddDialogOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium"
          >
            <Plus className="w-5 h-5" />
            Add Paper
          </button>
        </div>

        <div className="p-4 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search library..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-slate-400" />
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer min-w-[180px]"
              aria-label="Sort papers"
            >
              <option value="updated_desc">Last Updated (Newest)</option>
              <option value="updated_asc">Last Updated (Oldest)</option>
              <option value="created_desc">Date Added (Newest)</option>
              <option value="created_asc">Date Added (Oldest)</option>
              <option value="title_asc">Title (A-Z)</option>
              <option value="title_desc">Title (Z-A)</option>
              <option value="year_desc">Publication Year (Newest)</option>
              <option value="year_asc">Publication Year (Oldest)</option>
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <OnboardingGuide />
          {filteredPapers.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 dark:text-white">No papers found</h3>
              <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-2">
                {searchQuery ? "Try adjusting your search terms." : "Start building your library by adding your first research paper."}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setIsAddDialogOpen(true)}
                  className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
                >
                  Add a paper now &rarr;
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredPapers.map((paper) => (
                <PaperCard
                  key={paper.id}
                  paper={paper}
                  onSelect={handleSelectPaper}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail Drawer (Sheet) */}
      {selectedPaper && (
        <div className="w-[500px] border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col h-full shadow-2xl relative z-20">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm">
            <h2 className="font-semibold text-slate-900 dark:text-white">Paper Details</h2>
            <button
              onClick={() => setSelectedPaper(null)}
              aria-label="Close details"
              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <PaperDetailView paper={selectedPaper} onUpdate={updatePaper} />
          </div>
        </div>
      )}

      {/* Add Paper Dialog */}
      <Dialog.Root open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-fade-in" />
          <Dialog.Content className="fixed left-[50%] top-[50%] max-h-[85vh] w-[90vw] max-w-[1000px] translate-x-[-50%] translate-y-[-50%] rounded-xl bg-white dark:bg-slate-950 p-0 shadow-2xl focus:outline-none z-50 overflow-hidden animate-slide-in border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
               <h2 className="text-lg font-semibold px-2">Add New Paper</h2>
               <Dialog.Close className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                 <X className="w-5 h-5" />
               </Dialog.Close>
            </div>
            <div className="overflow-y-auto max-h-[calc(85vh-60px)]">
              <AddPaperView
                onAdd={async (data) => {
                  const paper = await createPaper(data)
                  if (paper) setIsAddDialogOpen(false)
                  return paper
                }}
                searchByDOI={searchPaperByDOI}
                searchByQuery={searchPapersByQuery}
              />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}

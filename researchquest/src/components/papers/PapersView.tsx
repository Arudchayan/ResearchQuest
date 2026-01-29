import { useState } from 'react'
import { Plus, Search, BookOpen, ExternalLink, Calendar, Users, X } from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import { usePapers } from '../../hooks/usePapers'
import { AddPaperView } from '../entities/AddPaperView'
import { PaperDetailView } from '../entities/PaperDetailView'
import { cn } from '../../lib/utils'
import * as Dialog from '@radix-ui/react-dialog'
import { OnboardingGuide } from '../layout/OnboardingGuide'

export function PapersView() {
  const { papers, selectedPaper, setSelectedPaper } = useAppStore()
  const { createPaper, updatePaper, searchPaperByDOI, searchPapersByQuery } = usePapers(useAppStore.getState().user?.id)
  const [searchQuery, setSearchQuery] = useState('')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)

  const filteredPapers = papers.filter(paper => {
    const query = searchQuery.toLowerCase()
    return (
      (paper.title && paper.title.toLowerCase().includes(query)) ||
      (paper.authors && paper.authors.some(a => a.toLowerCase().includes(query)))
    )
  })

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

        <div className="p-4 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search library..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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
                <div
                  key={paper.id}
                  onClick={() => setSelectedPaper(paper)}
                  className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-5 cursor-pointer hover:border-blue-500 dark:hover:border-blue-500 transition-all hover:shadow-md group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    {paper.doi && (
                      <a
                        href={`https://doi.org/${paper.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-slate-400 hover:text-blue-600 flex items-center gap-1"
                      >
                        DOI <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  <h3 className="font-semibold text-slate-900 dark:text-white mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                    {paper.title}
                  </h3>

                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 line-clamp-2">
                    {paper.authors?.join(', ') || 'Unknown Authors'}
                  </p>

                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{paper.publication_date ? new Date(paper.publication_date).getFullYear() : 'N/A'}</span>
                    </div>
                  </div>
                </div>
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
              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
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

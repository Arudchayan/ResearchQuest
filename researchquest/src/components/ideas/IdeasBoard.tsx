import { useState } from 'react'
import { Plus, MoreHorizontal, Lightbulb, ArrowRight, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../../store/appStore'
import { useIdeas } from '../../hooks/useIdeas'
import { IdeaDetailView } from '../entities/IdeaDetailView'
import { IdeaStage } from '../../types/database'
import { cn } from '../../lib/utils'
import * as Dialog from '@radix-ui/react-dialog'
import { OnboardingGuide } from '../layout/OnboardingGuide'

const STAGES: { id: IdeaStage; label: string; color: string }[] = [
  { id: 'Seed', label: 'Seed', color: 'bg-emerald-500' },
  { id: 'Developing', label: 'Developing', color: 'bg-blue-500' },
  { id: 'Supported', label: 'Supported', color: 'bg-purple-500' },
  { id: 'Mature', label: 'Mature', color: 'bg-amber-500' },
]

export function IdeasBoard() {
  const { ideas, selectedIdea, setSelectedIdea } = useAppStore()
  const { createIdea, updateIdea } = useIdeas(useAppStore.getState().user?.id)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newIdeaTitle, setNewIdeaTitle] = useState('')
  const [newIdeaDesc, setNewIdeaDesc] = useState('')

  const handleCreate = async () => {
    if (!newIdeaTitle.trim()) return
    const idea = await createIdea({
      title: newIdeaTitle,
      description: newIdeaDesc,
      stage: 'Seed'
    })
    if (idea) {
      setNewIdeaTitle('')
      setNewIdeaDesc('')
      setIsCreateDialogOpen(false)
    }
  }

  const handleMoveStage = async (e: React.MouseEvent, ideaId: string, currentStage: IdeaStage) => {
    e.stopPropagation()
    const currentIndex = STAGES.findIndex(s => s.id === currentStage)
    const nextStage = STAGES[currentIndex + 1]
    if (nextStage) {
      await updateIdea(ideaId, { stage: nextStage.id })
    }
  }

  return (
    <div className="flex h-full bg-slate-50 dark:bg-slate-900 overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Idea Board</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Track the evolution of your research concepts</p>
          </div>
          <button
            onClick={() => setIsCreateDialogOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium"
          >
            <Plus className="w-5 h-5" />
            New Idea
          </button>
        </div>

        <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 flex flex-col">
          <div className="mb-4">
            <OnboardingGuide />
          </div>
          <div className="flex gap-6 h-full min-w-max">
            {STAGES.map((stage) => {
              const stageIdeas = ideas.filter(i => i.stage === stage.id)

              return (
                <div key={stage.id} className="w-80 flex flex-col h-full rounded-xl bg-slate-100/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                  <div className="p-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-t-xl sticky top-0 z-10">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-3 h-3 rounded-full", stage.color)} />
                      <h3 className="font-semibold text-slate-900 dark:text-white">{stage.label}</h3>
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs rounded-full font-medium">
                        {stageIdeas.length}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    <AnimatePresence mode="popLayout">
                      {stageIdeas.map((idea) => (
                        <motion.div
                          layoutId={idea.id}
                          key={idea.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          onClick={() => setSelectedIdea(idea)}
                          className="group bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md cursor-pointer transition-all hover:border-blue-400 dark:hover:border-blue-500"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-medium text-slate-900 dark:text-white line-clamp-2 leading-snug">
                              {idea.title}
                            </h4>
                            <button className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-600 transition-opacity">
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </div>

                          <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-3 mb-3">
                            {idea.description || "No description provided..."}
                          </p>

                          {stage.id !== 'Mature' && (
                            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-700/50">
                              <button
                                onClick={(e) => handleMoveStage(e, idea.id, idea.stage)}
                                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                Advance <ArrowRight className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    {stageIdeas.length === 0 && (
                      <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-slate-400">
                        <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No ideas yet</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Idea Detail Drawer */}
      {selectedIdea && (
        <div className="w-[450px] border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col h-full shadow-2xl relative z-20">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 dark:text-white">Idea Details</h2>
            <button
              onClick={() => setSelectedIdea(null)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <IdeaDetailView idea={selectedIdea} onUpdate={updateIdea} />
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog.Root open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-fade-in" />
          <Dialog.Content className="fixed left-[50%] top-[50%] max-h-[85vh] w-[90vw] max-w-[500px] translate-x-[-50%] translate-y-[-50%] rounded-xl bg-white dark:bg-slate-950 p-6 shadow-2xl focus:outline-none z-50 animate-slide-in border border-slate-200 dark:border-slate-800">
            <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Capture New Idea</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title</label>
                <input
                  autoFocus
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g. Quantum Entanglement in Biology"
                  value={newIdeaTitle}
                  onChange={(e) => setNewIdeaTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                <textarea
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-32 resize-none"
                  placeholder="Briefly describe your hypothesis..."
                  value={newIdeaDesc}
                  onChange={(e) => setNewIdeaDesc(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setIsCreateDialogOpen(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newIdeaTitle.trim()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                >
                  Create Idea
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}

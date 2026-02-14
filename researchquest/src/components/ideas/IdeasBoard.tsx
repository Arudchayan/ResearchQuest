import { useState, useRef, useEffect, useCallback } from "react";
import { Plus, Trash2, Lightbulb, ArrowRight, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "../../store/appStore";
import { useIdeas } from "../../hooks/useIdeas";
import { IdeaDetailView } from "../entities/IdeaDetailView";
import { IdeaStage, Idea } from "../../types/database";
import { cn } from "../../lib/utils";
import * as Dialog from "@radix-ui/react-dialog";
import { OnboardingGuide } from "../layout/OnboardingGuide";
import { toast } from "sonner";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { ListSkeleton } from "../ui/Skeleton";

const STAGES: { id: IdeaStage; label: string; color: string }[] = [
  { id: "Seed", label: "Seed", color: "bg-emerald-500" },
  { id: "Developing", label: "Developing", color: "bg-blue-500" },
  { id: "Supported", label: "Supported", color: "bg-purple-500" },
  { id: "Mature", label: "Mature", color: "bg-amber-500" },
];

export function IdeasBoard() {
  const { ideas, selectedIdea, setSelectedIdea, ideasLoading } = useAppStore();
  const { createIdea, updateIdea, deleteIdea, restoreIdea } = useIdeas(useAppStore.getState().user?.id);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newIdeaTitle, setNewIdeaTitle] = useState("");
  const [newIdeaDesc, setNewIdeaDesc] = useState("");
  const [ideaToDelete, setIdeaToDelete] = useState<Idea | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTitleFocused, setIsTitleFocused] = useState(false);

  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastDeletedRef = useRef<Idea | null>(null)

  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current)
      }
    }
  }, [])

  const handleDeleteWithUndo = useCallback(async (ideaId: string) => {
    const idea = ideas.find(i => i.id === ideaId)
    const success = await deleteIdea(ideaId)

    if (success && idea) {
      lastDeletedRef.current = idea
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current)
      }

      const toastId = toast.success('Idea deleted', {
        description: 'Undo within 6 seconds to restore it.',
        duration: 6000,
        action: {
          label: 'Undo',
          onClick: async () => {
            if (lastDeletedRef.current) {
              await restoreIdea(lastDeletedRef.current)
              lastDeletedRef.current = null
              if (undoTimeoutRef.current) {
                clearTimeout(undoTimeoutRef.current)
                undoTimeoutRef.current = null
              }
              toast.dismiss(toastId)
            }
          },
        },
      })

      undoTimeoutRef.current = setTimeout(() => {
        lastDeletedRef.current = null
        toast.dismiss(toastId)
        undoTimeoutRef.current = null
      }, 6000)
    }
    return success
  }, [deleteIdea, restoreIdea, ideas])

  const handleCreate = async () => {
    if (!newIdeaTitle.trim()) return;
    const idea = await createIdea({
      title: newIdeaTitle,
      description: newIdeaDesc,
      stage: "Seed",
    });
    if (idea) {
      setNewIdeaTitle("");
      setNewIdeaDesc("");
      setIsCreateDialogOpen(false);
    }
  };

  const handleMoveStage = async (
    e: React.MouseEvent,
    ideaId: string,
    currentStage: IdeaStage,
  ) => {
    e.stopPropagation();
    const currentIndex = STAGES.findIndex((s) => s.id === currentStage);
    const nextStage = STAGES[currentIndex + 1];
    if (nextStage) {
      await updateIdea(ideaId, { stage: nextStage.id });
    }
  };

  const confirmDelete = async () => {
    if (!ideaToDelete) return;
    setIsDeleting(true);
    try {
      await handleDeleteWithUndo(ideaToDelete.id);
    } finally {
      setIsDeleting(false);
      setIdeaToDelete(null);
    }
  };

  return (
    <div className="flex h-full bg-slate-50 dark:bg-slate-900 overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Idea Board
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Track the evolution of your research concepts
            </p>
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
              const stageIdeas = ideas.filter((i) => i.stage === stage.id);

              return (
                <div
                  key={stage.id}
                  className="w-80 flex flex-col h-full rounded-xl bg-slate-100/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800"
                >
                  <div className="p-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-t-xl sticky top-0 z-10">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn("w-3 h-3 rounded-full", stage.color)}
                      />
                      <h3 className="font-semibold text-slate-900 dark:text-white">
                        {stage.label}
                      </h3>
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs rounded-full font-medium">
                        {stageIdeas.length}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {ideasLoading ? (
                      <ListSkeleton count={3} itemType="idea" />
                    ) : (
                      <>
                        <AnimatePresence mode="popLayout">
                          {stageIdeas.map((idea) => (
                            <motion.div
                              layoutId={idea.id}
                              key={idea.id}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.9 }}
                              onClick={() => setSelectedIdea(idea)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  setSelectedIdea(idea);
                                }
                              }}
                              tabIndex={0}
                              className="group bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md cursor-pointer transition-all hover:border-blue-400 dark:hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <h4 className="font-medium text-slate-900 dark:text-white line-clamp-2 leading-snug">
                                  {idea.title}
                                </h4>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIdeaToDelete(idea);
                                  }}
                                  aria-label={`Delete ${idea.title}`}
                                  className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all rounded"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>

                              <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-3 mb-3">
                                {idea.description || "No description provided..."}
                              </p>

                              {stage.id !== "Mature" && (
                                <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-700/50">
                                  <button
                                    onClick={(e) =>
                                      handleMoveStage(e, idea.id, idea.stage)
                                    }
                                    aria-label="Advance idea to next stage"
                                    className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
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
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Idea Detail Drawer */}
      {selectedIdea && (
        <div className="w-[450px] border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col h-full shadow-2xl relative z-20">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 dark:text-white">
              Idea Details
            </h2>
            <button
              onClick={() => setSelectedIdea(null)}
              aria-label="Close details"
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <IdeaDetailView idea={selectedIdea} onUpdate={updateIdea} onDelete={handleDeleteWithUndo} />
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog.Root
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-fade-in" />
          <Dialog.Content
            className="fixed left-[50%] top-[50%] max-h-[85vh] w-[90vw] max-w-[500px] translate-x-[-50%] translate-y-[-50%] rounded-xl bg-white dark:bg-slate-950 p-6 shadow-2xl focus:outline-none z-50 animate-slide-in border border-slate-200 dark:border-slate-800"
            aria-describedby={undefined}
          >
            <Dialog.Title className="text-xl font-bold mb-4 text-slate-900 dark:text-white">
              Capture New Idea
            </Dialog.Title>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="create-idea-title"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Title
                </label>
                <input
                  id="create-idea-title"
                  autoFocus
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g. Quantum Entanglement in Biology"
                  value={newIdeaTitle}
                  onChange={(e) => setNewIdeaTitle(e.target.value)}
                  onFocus={() => setIsTitleFocused(true)}
                  onBlur={() => setIsTitleFocused(false)}
                  maxLength={255}
                />
                <div className="flex justify-end h-5 mt-1">
                  {isTitleFocused && (
                    <span className="text-xs text-slate-400 animate-in fade-in duration-200">
                      {newIdeaTitle.length}/255
                    </span>
                  )}
                </div>
              </div>
              <div>
                <label
                  htmlFor="create-idea-description"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Description
                </label>
                <textarea
                  id="create-idea-description"
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-32 resize-none"
                  placeholder="Briefly describe your hypothesis..."
                  value={newIdeaDesc}
                  onChange={(e) => setNewIdeaDesc(e.target.value)}
                  maxLength={5000}
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

      <ConfirmDialog
        isOpen={Boolean(ideaToDelete)}
        onClose={() => {
          if (!isDeleting) {
            setIdeaToDelete(null);
          }
        }}
        onConfirm={() => {
          void confirmDelete();
        }}
        title="Delete idea"
        message={`Are you sure you want to delete "${ideaToDelete?.title || "Untitled Idea"}"? You can undo for a short time after deleting.`}
        confirmText="Delete"
        cancelText="Cancel"
        isLoading={isDeleting}
      />
    </div>
  );
}

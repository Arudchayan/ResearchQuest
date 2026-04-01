import { useAppStore } from "../../store/appStore";
import { useShallow } from "zustand/react/shallow";
import { TopicList } from "./TopicList";
import { TopicDetailView } from "./TopicDetailView";
import { Hash, Plus } from "lucide-react";
import { useState } from "react";
import { useTopics } from "../../hooks/useTopics";
import { toast } from "sonner";

export function TopicsView() {
  const { user, selectedTopic, setSelectedTopic } = useAppStore(
    useShallow((state) => ({
      user: state.user,
      selectedTopic: state.selectedTopic,
      setSelectedTopic: state.setSelectedTopic,
    }))
  );

  const { topics, loading, upsertTopic, removeTopic } = useTopics(user?.id);
  const [isCreating, setIsCreating] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");

  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicName.trim()) return;

    try {
      const success = await upsertTopic({ name: newTopicName.trim() });
      if (success) {
        setNewTopicName("");
        setIsCreating(false);
        toast.success("Topic created");
      }
    } catch (error) {
      toast.error("Failed to create topic");
    }
  };

  const handleUpdateTopic = async (topicId: string, updates: { name?: string; description?: string }) => {
    return await upsertTopic({ id: topicId, ...updates });
  };

  const handleDeleteTopic = async (topicId: string) => {
    const success = await removeTopic(topicId);
    if (success && selectedTopic?.id === topicId) {
      setSelectedTopic(null);
    }
    return success;
  };

  return (
    <div className="h-full flex flex-col md:flex-row bg-white dark:bg-slate-950">
      {/* List Panel */}
      <div
        className={`w-full md:w-80 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-col transition-all duration-300 ${
          selectedTopic ? "hidden md:flex" : "flex"
        }`}
      >
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Hash className="w-5 h-5 text-blue-500" />
              Topics
            </h1>
            <button
              onClick={() => setIsCreating(!isCreating)}
              className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20 rounded-md transition-colors"
              aria-label="New Topic"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {isCreating && (
            <form onSubmit={handleCreateTopic} className="flex gap-2">
              <input
                type="text"
                value={newTopicName}
                onChange={(e) => setNewTopicName(e.target.value)}
                placeholder="Topic name..."
                className="flex-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <button
                type="submit"
                disabled={!newTopicName.trim()}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                Add
              </button>
            </form>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <TopicList
            topics={topics}
            loading={loading}
            onSelectTopic={setSelectedTopic}
            onDeleteTopic={handleDeleteTopic}
          />
        </div>
      </div>

      {/* Detail Panel */}
      <div className="flex-1 min-w-0 bg-white dark:bg-slate-950 overflow-y-auto">
        {selectedTopic ? (
          <TopicDetailView
            topic={selectedTopic}
            onUpdate={handleUpdateTopic}
            onDelete={handleDeleteTopic}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 space-y-4 p-8">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-2xl flex items-center justify-center mb-4">
              <Hash className="w-8 h-8 text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-lg font-medium text-slate-900 dark:text-slate-100">
              Select a topic
            </p>
            <p className="text-sm max-w-sm text-center">
              Choose a topic from the list to view its details, connected notes, papers, and ideas.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

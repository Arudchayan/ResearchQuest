import { useAppStore } from "../../store/appStore";
import { useShallow } from "zustand/react/shallow";
import { TopicList } from "./TopicList";
import { TopicDetailView } from "./TopicDetailView";
import { Hash, Plus, Download, FileText, Table, FileJson, Search, X, ArrowUpDown } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useState, useMemo, useRef } from "react";
import { useTopics } from "../../hooks/useTopics";
import { toast } from "sonner";
import { convertTopicsToCSV, convertTopicsToJSON, convertTopicsToMarkdown, downloadFile } from "../../utils/export";
import { logger } from "../../utils/logger";

type SortOption =
  | "name_asc"
  | "name_desc"
  | "created_desc"
  | "created_asc"
  | "updated_desc"
  | "updated_asc"
  | "count_desc";

export function TopicsView() {
  const { user, selectedTopic, setSelectedTopic } = useAppStore(
    useShallow((state) => ({
      user: state.user,
      selectedTopic: state.selectedTopic,
      setSelectedTopic: state.setSelectedTopic,
    }))
  );

  const { topics, loading, createTopic, updateTopic, deleteTopic } = useTopics(user?.id);
  const [isCreating, setIsCreating] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("updated_desc");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredTopics = useMemo(() => {
    let result = topics;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(topic =>
        topic.name.toLowerCase().includes(query) ||
        (topic.description && topic.description.toLowerCase().includes(query))
      );
    }

    return [...result].sort((a, b) => {
      switch (sortOption) {
        case "name_asc":
          return a.name.localeCompare(b.name);
        case "name_desc":
          return b.name.localeCompare(a.name);
        case "created_desc":
          return b.created_at > a.created_at ? 1 : b.created_at < a.created_at ? -1 : 0;
        case "created_asc":
          return a.created_at > b.created_at ? 1 : a.created_at < b.created_at ? -1 : 0;
        case "updated_desc":
          return b.updated_at > a.updated_at ? 1 : b.updated_at < a.updated_at ? -1 : 0;
        case "updated_asc":
          return a.updated_at > b.updated_at ? 1 : a.updated_at < b.updated_at ? -1 : 0;
        case "count_desc":
          const aCount = a.note_count + a.paper_count + a.idea_count;
          const bCount = b.note_count + b.paper_count + b.idea_count;
          return bCount - aCount;
        default:
          return 0;
      }
    });
  }, [topics, searchQuery, sortOption]);

  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicName.trim()) return;

    try {
      const success = await createTopic({ name: newTopicName.trim() });
      if (success) {
        setNewTopicName("");
        setIsCreating(false);
        // toast.success("Topic created"); // createTopic already shows a toast
      }
    } catch (error) {
      toast.error("Failed to create topic");
    }
  };

  const handleUpdateTopic = async (topicId: string, updates: { name?: string; description?: string }) => {
    return await updateTopic(topicId, updates);
  };

  const handleDeleteTopic = async (topicId: string) => {
    const success = await deleteTopic(topicId);
    if (success && selectedTopic?.id === topicId) {
      setSelectedTopic(null);
    }
    return success;
  };

  const handleExport = (format: "markdown" | "csv" | "json") => {
    if (filteredTopics.length === 0) {
      toast.error("No topics to export");
      return;
    }

    const timestamp = new Date().toISOString().split("T")[0];
    let content = "";
    let filename = "";
    let type = "";

    try {
      switch (format) {
        case "markdown":
          content = convertTopicsToMarkdown(filteredTopics);
          filename = `research-topics-${timestamp}.md`;
          type = "text/markdown";
          break;
        case "csv":
          content = convertTopicsToCSV(filteredTopics);
          filename = `research-topics-${timestamp}.csv`;
          type = "text/csv";
          break;
        case "json":
          content = convertTopicsToJSON(filteredTopics);
          filename = `research-topics-${timestamp}.json`;
          type = "application/json";
          break;
      }

      downloadFile(content, filename, type);
      toast.success(
        `Exported ${filteredTopics.length} topics as ${format.toUpperCase()}`
      );
    } catch (err) {
      logger.error("Export failed", err);
      toast.error("Failed to export topics");
    }
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
            <div className="flex items-center gap-2">
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md transition-colors"
                    title="Export topics"
                    aria-label="Export topics"
                  >
                    <Download className="w-5 h-5" aria-hidden="true" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    className="min-w-[180px] bg-white dark:bg-slate-950 rounded-lg shadow-lg border border-slate-200 dark:border-slate-800 p-1 z-50 animate-in fade-in-0 zoom-in-95"
                    align="start"
                    sideOffset={5}
                  >
                    <DropdownMenu.Item
                      onSelect={() => handleExport("markdown")}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer outline-none"
                    >
                      <FileText className="w-4 h-4" />
                      Markdown (.md)
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onSelect={() => handleExport("csv")}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer outline-none"
                    >
                      <Table className="w-4 h-4" />
                      CSV (.csv)
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onSelect={() => handleExport("json")}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer outline-none"
                    >
                      <FileJson className="w-4 h-4" />
                      JSON (.json)
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>

              <button
                onClick={() => setIsCreating(!isCreating)}
                className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20 rounded-md transition-colors"
                aria-label="New Topic"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
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
          <div className="flex flex-col gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-10 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Search topics"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Clear search"
                >
                  <X className="w-3 h-3" aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                aria-label="Sort topics"
              >
                <option value="updated_desc">Last Updated (Newest)</option>
                <option value="updated_asc">Last Updated (Oldest)</option>
                <option value="created_desc">Date Created (Newest)</option>
                <option value="created_asc">Date Created (Oldest)</option>
                <option value="name_asc">Name (A-Z)</option>
                <option value="name_desc">Name (Z-A)</option>
                <option value="count_desc">Most Connected</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <TopicList
            topics={filteredTopics}
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

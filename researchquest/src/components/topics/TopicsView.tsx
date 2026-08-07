import { useAppStore } from "../../store/appStore";
import { useShallow } from "zustand/react/shallow";
import { TopicList } from "./TopicList";
import { TopicDetailView } from "./TopicDetailView";
import { ArrowLeft, ArrowUpDown, Download, FileJson, FileText, Hash, Plus, Search, Table, X } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useTopics } from "../../hooks/useTopics";
import { toast } from "sonner";
import { convertTopicsToCSV, convertTopicsToJSON, convertTopicsToMarkdown, downloadFile } from "../../utils/export";
import { logger } from "../../utils/logger";
import { Button } from "../ui/button";
import { EmptyState } from "../ui/EmptyState";
import { InlineError } from "../ui/ErrorFallback";
import { UNDO_WINDOW_MS } from "../../lib/constants";

type SortOption =
  | "name_asc"
  | "name_desc"
  | "created_desc"
  | "created_asc"
  | "updated_desc"
  | "updated_asc"
  | "count_desc";

export function TopicsView() {
  const { user, selectedTopic, setSelectedTopic, dataSyncErrors } = useAppStore(
    useShallow((state) => ({
      user: state.user,
      selectedTopic: state.selectedTopic,
      setSelectedTopic: state.setSelectedTopic,
      dataSyncErrors: state.dataSyncErrors,
    }))
  );

  const { topics, loading, createTopic, updateTopic, deleteTopic } = useTopics(user?.id, { owner: false });
  const topicsSyncError = dataSyncErrors?.topics ?? null;
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmittingTopic, setIsSubmittingTopic] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("updated_desc");
  const [hiddenTopicIds, setHiddenTopicIds] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ⚡ PERFORMANCE OPTIMIZATION: Pre-compute derived text fields for faster searching
  const searchableTopics = useMemo(() => {
    return (topics || []).map((topic) => ({
      topic,
      searchText: [topic.name || "", topic.description || ""]
        .join(" ")
        .toLowerCase(),
    }));
  }, [topics]);

  const filteredTopics = useMemo(() => {
    // Optimization: Skip filtering if query is empty, no hidden topics, and sort order matches default
    if (!searchQuery && hiddenTopicIds.size === 0 && sortOption === "updated_desc") {
      return topics || [];
    }

    let resultTopics = topics || [];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();

      resultTopics = searchableTopics
        .filter((st) => st.searchText.includes(query))
        .map((st) => st.topic);
    }

    const visibleTopics =
      hiddenTopicIds.size > 0
        ? resultTopics.filter((topic) => !hiddenTopicIds.has(topic.id))
        : resultTopics;

    return [...visibleTopics].sort((a, b) => {
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
        case "count_desc": {
          const aCount = a.note_count + a.paper_count + a.idea_count;
          const bCount = b.note_count + b.paper_count + b.idea_count;
          return bCount - aCount;
        }
        default:
          return 0;
      }
    });
  }, [topics, searchQuery, sortOption, hiddenTopicIds, searchableTopics]);

  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicName.trim() || isSubmittingTopic) return;
    setIsSubmittingTopic(true);
    try {
      const topic = await createTopic({ name: newTopicName.trim() });
      if (topic) {
        setNewTopicName("");
        setIsCreating(false);
      }
    } finally {
      setIsSubmittingTopic(false);
    }
  };

  const handleUpdateTopic = async (topicId: string, updates: { name?: string; description?: string }) => {
    return await updateTopic(topicId, updates);
  };

  const pendingDeletionsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    return () => {
      // Clear all timeouts on unmount and execute the deletions immediately
      pendingDeletionsRef.current.forEach((timeoutId, topicId) => {
        clearTimeout(timeoutId);
        void deleteTopic(topicId);
      });
    };
  }, [deleteTopic]);

  const handleDeleteWithUndo = useCallback(
    async (topicId: string) => {
      const currentTopics = Object.values(useAppStore.getState().topics);
      const topic = currentTopics.find((t) => t.id === topicId);
      if (!topic) return false;

      // Optimistically hide the topic
      setHiddenTopicIds((prev) => {
        const next = new Set(prev);
        next.add(topicId);
        return next;
      });

      const shouldRestoreSelection =
        useAppStore.getState().selectedTopic?.id === topicId;
      if (shouldRestoreSelection) {
        setSelectedTopic(null);
      }

      // If there's an existing pending deletion for this topic (shouldn't happen, but safe), clear it
      const existingTimeout = pendingDeletionsRef.current.get(topicId);
      if (existingTimeout !== undefined) {
        clearTimeout(existingTimeout);
      }

      const toastId = toast.success("Topic deleted", {
        description: "Undo within 6 seconds to restore it.",
        duration: UNDO_WINDOW_MS,
        action: {
          label: "Undo",
          onClick: () => {
            // Cancel deletion
            const timeoutId = pendingDeletionsRef.current.get(topicId);
            if (timeoutId !== undefined) {
              clearTimeout(timeoutId);
              pendingDeletionsRef.current.delete(topicId);
            }

            // Restore visibility
            setHiddenTopicIds((prev) => {
              const next = new Set(prev);
              next.delete(topicId);
              return next;
            });

            if (shouldRestoreSelection) {
              setSelectedTopic(topic);
            }
            toast.dismiss(toastId);
          },
        },
      });

      // Schedule the actual deletion
      const timeoutId = setTimeout(() => {
        pendingDeletionsRef.current.delete(topicId);

        // Remove from hidden state before actual deletion to avoid flashing if Supabase takes time
        setHiddenTopicIds((prev) => {
          const next = new Set(prev);
          next.delete(topicId);
          return next;
        });

        // Execute real DB deletion
        void deleteTopic(topicId);
        toast.dismiss(toastId);
      }, UNDO_WINDOW_MS);

      pendingDeletionsRef.current.set(topicId, timeoutId);

      return true; // Optimistic success
    },
    [deleteTopic, setSelectedTopic],
  );

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
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-bg-base md:flex-row">
      {/* List Panel */}
      <div
        className={`flex min-h-0 w-full flex-1 flex-shrink-0 flex-col border-b border-border-subtle bg-bg-elevated/60 transition-colors duration-theme md:h-full md:w-80 md:flex-none md:border-b-0 md:border-r ${
          selectedTopic ? "hidden md:flex" : "flex"
        }`}
      >
        <div className="space-y-4 border-b border-border-subtle p-4">
          <div className="flex items-center justify-between">
            <h1 className="flex items-center gap-2 font-serif text-subtitle font-bold text-text-primary">
              <Hash className="h-5 w-5 text-primary-500" />
              Topics
            </h1>
            <div className="flex items-center gap-2">
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    title="Export topics"
                    aria-label="Export topics"
                  >
                    <Download className="w-5 h-5" aria-hidden="true" />
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    className="z-dropdown min-w-44 rounded-surface border border-border-subtle bg-bg-surface p-1 shadow-md animate-in fade-in-0 zoom-in-95"
                    align="start"
                    sideOffset={5}
                  >
                    <DropdownMenu.Item
                      onSelect={() => handleExport("markdown")}
                      className="flex cursor-pointer items-center gap-2 rounded-control px-3 py-2 text-small text-text-secondary outline-none transition-colors hover:bg-bg-elevated hover:text-text-primary focus-visible:bg-bg-elevated"
                    >
                      <FileText className="w-4 h-4" />
                      Markdown (.md)
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onSelect={() => handleExport("csv")}
                      className="flex cursor-pointer items-center gap-2 rounded-control px-3 py-2 text-small text-text-secondary outline-none transition-colors hover:bg-bg-elevated hover:text-text-primary focus-visible:bg-bg-elevated"
                    >
                      <Table className="w-4 h-4" />
                      CSV (.csv)
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onSelect={() => handleExport("json")}
                      className="flex cursor-pointer items-center gap-2 rounded-control px-3 py-2 text-small text-text-secondary outline-none transition-colors hover:bg-bg-elevated hover:text-text-primary focus-visible:bg-bg-elevated"
                    >
                      <FileJson className="w-4 h-4" />
                      JSON (.json)
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>

              <Button
                type="button"
                onClick={() => setIsCreating(!isCreating)}
                variant="default"
                size="icon"
                aria-label={isCreating ? "Close new topic form" : "New Topic"}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {isCreating && (
            <form onSubmit={handleCreateTopic} className="flex min-w-0 gap-2" aria-busy={isSubmittingTopic}>
              <input
                type="text"
                value={newTopicName}
                onChange={(e) => setNewTopicName(e.target.value)}
                placeholder="Topic name..."
                aria-label="Topic name"
                className="min-h-11 min-w-0 flex-1 rounded-control border border-border-moderate bg-bg-surface px-3 py-2 text-small text-text-primary shadow-sm placeholder:text-text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-60 md:min-h-0"
                autoFocus
                disabled={isSubmittingTopic}
              />
              <Button
                type="submit"
                variant="default"
                size="sm"
                disabled={!newTopicName.trim() || isSubmittingTopic}
                className="shrink-0"
              >
                {isSubmittingTopic ? "Adding…" : "Add"}
              </Button>
            </form>
          )}
          <div className="flex flex-col gap-2">
            <div className="relative">
              <label htmlFor="topics-search-input" className="sr-only">Search topics</label>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" aria-hidden="true" />
              <input
                id="topics-search-input"
                ref={searchInputRef}
                type="search"
                placeholder="Search topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="min-h-11 w-full rounded-control border border-border-moderate bg-bg-surface py-2 pl-10 pr-12 text-small text-text-primary shadow-sm placeholder:text-text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus md:min-h-0"
                aria-label="Search topics"
              />
              {searchQuery && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setSearchQuery("");
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-1 top-1/2 -translate-y-1/2"
                  aria-label="Clear search"
                >
                  <X className="w-3 h-3" aria-hidden="true" />
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 flex-shrink-0 text-text-tertiary" aria-hidden="true" />
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="min-h-11 w-full cursor-pointer rounded-control border border-border-moderate bg-bg-surface px-3 py-2 text-small text-text-primary shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus md:min-h-0"
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

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {topicsSyncError && <InlineError message={topicsSyncError.message} />}
          <TopicList
            topics={filteredTopics}
            loading={loading}
            highlightQuery={searchQuery}
            onSelectTopic={setSelectedTopic}
            onDeleteTopic={handleDeleteWithUndo}
          />
        </div>
      </div>

      {/* Detail Panel */}
      <div className={`min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-bg-surface ${selectedTopic ? "flex" : "hidden md:flex"}`}>
        {selectedTopic ? (
          <>
            <div className="flex shrink-0 items-center gap-3 border-b border-border-subtle bg-bg-surface p-4 md:hidden">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setSelectedTopic(null)}
                aria-label="Back to topics"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
              <span className="font-serif text-small font-semibold text-text-primary">
                Topics
              </span>
            </div>
            <TopicDetailView
              topic={selectedTopic}
              onUpdate={handleUpdateTopic}
              onDelete={handleDeleteWithUndo}
            />
          </>
        ) : (
          <EmptyState
            className="h-full min-h-0"
            icon={<Hash className="h-6 w-6" />}
            title="Select a topic"
            description="Choose a topic from the list to view its details, connected notes, papers, and ideas."
          />
        )}
      </div>
    </div>
  );
}

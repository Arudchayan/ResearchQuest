import { useAppStore } from "../../store/appStore";
import { useShallow } from "zustand/react/shallow";
import { TopicList } from "./TopicList";
import { TopicDetailView } from "./TopicDetailView";
import { Hash, Plus, Download, FileText, Table, FileJson, Search, X, ArrowUpDown } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useTopics } from "../../hooks/useTopics";
import type { TopicWithCounts } from "../../types/database";
import { toast } from "sonner";
import { convertTopicsToCSV, convertTopicsToJSON, convertTopicsToMarkdown, downloadFile } from "../../utils/export";
import { logger } from "../../utils/logger";
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

  const { topics, loading, createTopic, updateTopic, deleteTopic } = useTopics(user?.id);
  const topicsSyncError = dataSyncErrors?.topics ?? null;
  const [isCreating, setIsCreating] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("updated_desc");
  const [hiddenTopicIds, setHiddenTopicIds] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Performance: Pre-compute derived text fields for faster searching
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

    const resultTopics = [];
    const query = searchQuery?.toLowerCase() || "";
    const hasHidden = hiddenTopicIds.size > 0;
    const safeSearchableTopics = searchableTopics || [];

    for (let i = 0; i < safeSearchableTopics.length; i++) {
      const st = safeSearchableTopics[i];
      if (hasHidden && hiddenTopicIds.has(st.topic.id)) {
        continue;
      }
      if (query && !st.searchText.includes(query)) {
        continue;
      }
      resultTopics.push(st.topic);
    }

    return resultTopics.sort((a, b) => {
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

      const currentSelected = useAppStore.getState().selectedTopic;
      if (currentSelected?.id === topicId) {
        setSelectedTopic(null);
      }

      // If there's an existing pending deletion for this topic (shouldn't happen, but safe), clear it
      if (pendingDeletionsRef.current.has(topicId)) {
        clearTimeout(pendingDeletionsRef.current.get(topicId)!);
      }

      const toastId = toast.success("Topic deleted", {
        description: "Undo within 6 seconds to restore it.",
        duration: UNDO_WINDOW_MS,
        action: {
          label: "Undo",
          onClick: () => {
            // Cancel deletion
            const timeoutId = pendingDeletionsRef.current.get(topicId);
            if (timeoutId) {
              clearTimeout(timeoutId);
              pendingDeletionsRef.current.delete(topicId);
            }

            // Restore visibility
            setHiddenTopicIds((prev) => {
              const next = new Set(prev);
              next.delete(topicId);
              return next;
            });

            // Optionally restore selection if it was the only thing unselected?
            // Since we cleared it above, we could set it back.
            setSelectedTopic(topic);
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

  const handleExport = useCallback((format: "markdown" | "csv" | "json") => {
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
  }, [filteredTopics]);

  useEffect(() => {
    const handleExportShortcut = () => {
      handleExport("markdown");
    };

    document.addEventListener("export-current-view", handleExportShortcut);
    return () => {
      document.removeEventListener("export-current-view", handleExportShortcut);
    };
  }, [handleExport]);

  return (
    <div className="h-full flex flex-col md:flex-row bg-bg-base text-text-primary overflow-hidden">
      {/* List Panel */}
      <div
        className={`w-full md:w-80 flex-shrink-0 border-r border-border-subtle bg-bg-surface flex flex-col transition-all duration-300 ${
          selectedTopic ? "hidden md:flex" : "flex"
        }`}
      >
        <div className="p-4 border-b border-border-subtle space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <span className="icon-tile bg-accent-soft text-accent-strong">
                <Hash className="h-4 w-4" aria-hidden="true" />
              </span>
              <h1 className="truncate font-serif text-xl font-bold text-text-primary">
                Topics
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    className="icon-btn rounded-lg"
                    title="Export topics"
                    aria-label="Export topics"
                  >
                    <Download className="w-5 h-5" aria-hidden="true" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    className="min-w-[180px] bg-bg-surface rounded-lg shadow-lg border border-border-moderate p-1 z-50 animate-in fade-in-0 zoom-in-95"
                    align="start"
                    sideOffset={5}
                  >
                    <DropdownMenu.Item
                      onSelect={() => handleExport("markdown")}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-small text-text-secondary hover:bg-bg-elevated hover:text-text-primary cursor-pointer outline-none"
                    >
                      <FileText className="w-4 h-4" />
                      Markdown (.md)
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onSelect={() => handleExport("csv")}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-small text-text-secondary hover:bg-bg-elevated hover:text-text-primary cursor-pointer outline-none"
                    >
                      <Table className="w-4 h-4" />
                      CSV (.csv)
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onSelect={() => handleExport("json")}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-small text-text-secondary hover:bg-bg-elevated hover:text-text-primary cursor-pointer outline-none"
                    >
                      <FileJson className="w-4 h-4" />
                      JSON (.json)
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>

              <button
                onClick={() => setIsCreating(!isCreating)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent-strong shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lift"
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
                aria-label="Topic name"
                className="flex-1 h-10 rounded-lg border border-border-moderate bg-bg-base px-3 text-small text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent"
                autoFocus
              />
              <button
                type="submit"
                disabled={!newTopicName.trim()}
                className="h-10 rounded-lg bg-accent-strong px-3.5 text-small font-semibold text-accent-contrast shadow-lift transition-all hover:-translate-y-0.5 hover:opacity-95 disabled:translate-y-0 disabled:opacity-50"
              >
                Add
              </button>
            </form>
          )}
          <div className="flex flex-col gap-2">
            <div className="relative">
              <label htmlFor="topics-search-input" className="sr-only">Search topics</label>
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-text-tertiary" />
              <input
                id="topics-search-input"
                ref={searchInputRef}
                type="text"
                placeholder="Search topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 rounded-lg border border-border-moderate bg-bg-base pl-9 pr-10 text-small text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent"
                aria-label="Search topics"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    searchInputRef.current?.focus();
                  }}
                  className="icon-btn absolute right-1.5 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full"
                  aria-label="Clear search"
                >
                  <X className="w-3 h-3" aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-text-tertiary flex-shrink-0" />
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="w-full h-10 rounded-lg border border-border-moderate bg-bg-base px-3 text-small text-text-primary focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
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
      <div className="flex-1 min-w-0 bg-bg-surface overflow-y-auto">
        {selectedTopic ? (
          <TopicDetailView
            topic={selectedTopic}
            onUpdate={handleUpdateTopic}
            onDelete={handleDeleteWithUndo}
          />
        ) : (
          <div className="hero-ambient h-full flex flex-col items-center justify-center text-text-secondary space-y-4 p-8">
            <div className="icon-tile h-16 w-16 rounded-xl bg-accent-soft text-accent-strong">
              <Hash className="h-7 w-7" aria-hidden="true" />
            </div>
            <p className="text-lg font-medium text-text-primary">
              Select a topic
            </p>
            <p className="text-small max-w-sm text-center">
              Choose a topic from the list to view its details, connected notes, papers, and ideas.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

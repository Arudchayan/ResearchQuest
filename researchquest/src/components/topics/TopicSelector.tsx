import { useEffect, useMemo, useState, useId } from "react";
import { Plus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import { useTopics } from "../../hooks/useTopics";
import type { TopicEntityType, TopicWithCounts } from "../../types/database";
import { useAppStore } from "../../store/appStore";

interface TopicSelectorProps {
  entityId: string | null;
  entityType: TopicEntityType;
}

export function TopicSelector({ entityId, entityType }: TopicSelectorProps) {
  const selectId = useId();
  const inputId = useId();
  const storeUserId = useAppStore((state) => state.user?.id);
  const [userId, setUserId] = useState<string | undefined>(storeUserId);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");

  useEffect(() => {
    if (storeUserId) {
      setUserId(storeUserId);
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id);
    });
  }, [storeUserId]);

  const {
    topics,
    loading,
    attachTopicToEntity,
    detachTopicFromEntity,
    getTopicIdsForEntity,
    createTopic,
  } = useTopics(userId);

  useEffect(() => {
    const fetchSelected = async () => {
      if (!entityId) {
        setSelectedIds([]);
        return;
      }
      setLoadingLinks(true);
      const ids = await getTopicIdsForEntity(entityId, entityType);
      setSelectedIds(ids);
      setLoadingLinks(false);
    };

    void fetchSelected();
  }, [entityId, entityType, getTopicIdsForEntity]);
  // Pre-computing a lookup Map reduces the time complexity of finding a topic by ID
  // from O(N) to O(1). When used inside a loop (like rendering selected topics),
  // this prevents O(N*M) performance bottlenecks during hydration or rendering.
  // Impact: Significantly reduces CPU overhead and memory churn for large topic lists.
  const topicsMap = useMemo(
    () => new Map(topics.map((t) => [t.id, t])),
    [topics],
  );
  // Using a Set for selectedIds lookup reduces time complexity from O(N*M) to O(N+M).
  // Impact: Faster filtering of available topics when many topics are selected.
  const selectedIdsSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const availableTopics = useMemo(
    () => topics.filter((topic) => !selectedIdsSet.has(topic.id)),
    [selectedIdsSet, topics],
  );

  const handleAttach = async (topic: TopicWithCounts) => {
    if (!entityId) {
      toast.error("Save this item before adding topics");
      return;
    }
    const success = await attachTopicToEntity(topic.id, entityId, entityType);
    if (success) {
      setSelectedIds((prev) => [...prev, topic.id]);
    }
  };

  const handleDetach = async (topicId: string) => {
    if (!entityId) return;
    const success = await detachTopicFromEntity(topicId, entityId, entityType);
    if (success) {
      setSelectedIds((prev) => prev.filter((id) => id !== topicId));
    }
  };

  const handleCreate = async () => {
    if (!newTopicName.trim()) {
      toast.error("Topic name is required");
      return;
    }
    setCreating(true);
    const topic = await createTopic({ name: newTopicName.trim() });
    setCreating(false);
    setNewTopicName("");
    if (topic && entityId) {
      await handleAttach(topic);
    }
  };

  return (
    <div className="bg-bg-surface border border-border-subtle rounded-lg p-4 space-y-3">
      <div role="status" aria-live="polite" className="sr-only">
        {selectedIds.length === 0 ? "No topics linked yet." : ""}
      </div>
      <div className="flex items-center justify-between">
        <h3 className="text-small font-semibold text-text-primary">Topics</h3>
        {(loading || loadingLinks) && (
          <Loader2 className="w-4 h-4 animate-spin text-text-tertiary" />
        )}
      </div>

      {selectedIds.length === 0 ? (
        <p className="text-caption text-text-tertiary">No topics linked yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {selectedIds.map((topicId) => {
            const topic = topicsMap.get(topicId);
            if (!topic) return null;
            return (
              <span
                key={topic.id}
                className="inline-flex items-center gap-2 bg-primary-500/10 text-primary-600 dark:text-primary-400 px-3 py-1 rounded-full text-caption"
              >
                {topic.name}
                <button
                  type="button"
                  aria-label={`Remove ${topic.name}`}
                  onClick={() => void handleDetach(topic.id)}
                  className="text-text-tertiary hover:text-destructive"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {availableTopics.length > 0 && (
        <div>
          <label
            htmlFor={selectId}
            className="block text-caption text-text-secondary mb-1"
          >
            Add an existing topic
          </label>
          <div className="flex gap-2">
            <select
              id={selectId}
              className="flex-1 px-3 py-2 rounded-md border border-border-subtle bg-bg-base text-small"
              onChange={(event) => {
                const topic = topicsMap.get(event.target.value);
                if (topic) {
                  void handleAttach(topic);
                  event.target.value = "";
                }
              }}
            >
              <option value="">Select topic...</option>
              {availableTopics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="pt-3 border-t border-border-subtle">
        <label
          htmlFor={inputId}
          className="block text-caption text-text-secondary mb-1"
        >
          Create and link new topic
        </label>
        <div className="flex gap-2">
          <input
            id={inputId}
            value={newTopicName}
            onChange={(event) => setNewTopicName(event.target.value)}
            placeholder="e.g. Literature Review"
            maxLength={50}
            className="flex-1 px-3 py-2 rounded-md border border-border-subtle bg-bg-base text-small"
          />
          <button
            onClick={() => void handleCreate()}
            disabled={creating || !newTopicName.trim()}
            className="inline-flex items-center gap-2 px-3 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors disabled:opacity-60"
          >
            {creating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

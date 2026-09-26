import { useState } from "react";
import { PlugZap, Plus, RefreshCw, Trash2 } from "lucide-react";
import {
  FEED_SOURCE_KINDS,
  useFeedSources,
  type FeedSourceKind,
} from "../../hooks/useFeedSources";
import { cn } from "../../lib/utils";

function sourceUrlOf(config: unknown): string | null {
  if (
    typeof config === "object" &&
    config !== null &&
    "url" in config &&
    typeof (config as { url?: unknown }).url === "string"
  ) {
    return (config as { url: string }).url;
  }
  return null;
}

export function FeedSourcesPanel({ userId }: { userId: string | undefined }) {
  const {
    sources,
    loading,
    error,
    busyId,
    refreshSources,
    addSource,
    removeSource,
    setSourceEnabled,
  } = useFeedSources(userId);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<FeedSourceKind>("rss");
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    setAdding(true);
    try {
      const created = await addSource({ name, kind, url });
      if (created) {
        setName("");
        setUrl("");
        setKind("rss");
      }
    } finally {
      setAdding(false);
    }
  };

  return (
    <section
      className="surface-card p-4 sm:p-5"
      aria-label="Feed sources"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="inline-flex items-center gap-2 text-small font-semibold text-text-primary">
            <PlugZap className="h-4 w-4 text-accent-strong" aria-hidden="true" />
            Sources
          </h2>
          <p className="mt-1 text-caption text-text-secondary">
            Alpha: sources are tracked metadata only — no automatic ingest
            runs yet. Triage stays manual.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshSources()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border-moderate bg-bg-surface px-2.5 py-1.5 text-caption font-medium text-text-secondary shadow-sm transition-colors hover:border-border-strong hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Reload
        </button>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_9rem_1fr_auto]">
        <label className="sr-only" htmlFor="feed-source-name">
          Source name
        </label>
        <input
          id="feed-source-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Source name (e.g. arXiv cs.CL)"
          className="rounded-lg border border-border-moderate bg-bg-surface px-3 py-2 text-small text-text-primary placeholder:text-text-tertiary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        />
        <label className="sr-only" htmlFor="feed-source-kind">
          Source kind
        </label>
        <select
          id="feed-source-kind"
          value={kind}
          onChange={(event) => setKind(event.target.value as FeedSourceKind)}
          className="rounded-lg border border-border-moderate bg-bg-surface px-3 py-2 text-small text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          {FEED_SOURCE_KINDS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="feed-source-url">
          Source URL (optional)
        </label>
        <input
          id="feed-source-url"
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://… (optional)"
          className="rounded-lg border border-border-moderate bg-bg-surface px-3 py-2 text-small text-text-primary placeholder:text-text-tertiary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        />
        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={adding || !name.trim()}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-text-primary px-3 py-2 text-small font-medium text-bg-base shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add
        </button>
      </div>

      <div className="mt-4">
        {loading ? (
          <p className="text-small text-text-secondary" role="status">
            Loading sources…
          </p>
        ) : error ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-bg-elevated p-3">
            <p className="text-small text-text-secondary">{error}</p>
            <button
              type="button"
              onClick={() => void refreshSources()}
              className="rounded-lg border border-border-moderate bg-bg-surface px-2.5 py-1 text-caption font-medium text-text-secondary hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              Retry
            </button>
          </div>
        ) : sources.length === 0 ? (
          <p className="text-small text-text-secondary" role="status">
            No sources yet. Add one above to track where leads should come
            from.
          </p>
        ) : (
          <ul className="divide-y divide-border-subtle rounded-lg border border-border-subtle">
            {sources.map((source) => (
              <li
                key={source.id}
                className="flex items-center justify-between gap-3 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-small font-medium text-text-primary">
                    {source.name}
                  </p>
                  <p className="truncate text-caption text-text-tertiary">
                    {source.kind}
                    {sourceUrlOf(source.config)
                      ? ` · ${sourceUrlOf(source.config)}`
                      : ""}
                    {!source.enabled ? " · disabled" : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={source.enabled}
                    aria-label={`${source.enabled ? "Disable" : "Enable"} ${source.name}`}
                    disabled={busyId === source.id}
                    onClick={() =>
                      void setSourceEnabled(source.id, !source.enabled)
                    }
                    className={cn(
                      "relative h-6 w-11 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
                      source.enabled ? "bg-accent" : "bg-border-strong",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
                        source.enabled ? "left-[1.375rem]" : "left-0.5",
                      )}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeSource(source.id)}
                    disabled={busyId === source.id}
                    aria-label={`Remove ${source.name}`}
                    className="rounded-lg border border-border-moderate bg-bg-surface p-1.5 text-text-secondary shadow-sm transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

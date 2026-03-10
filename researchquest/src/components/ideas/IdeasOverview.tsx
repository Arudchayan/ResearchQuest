import { useMemo, useState } from "react";
import { Lightbulb, Sparkles, Plus, Loader2, ArrowRight } from "lucide-react";
import type { Idea, IdeaStage } from "../../types/database";

interface IdeasOverviewProps {
  ideas: Idea[];
  loading: boolean;
  onCreate: (payload: Partial<Idea>) => Promise<Idea | null>;
  onSelect: (idea: Idea) => void;
}

const STAGES: IdeaStage[] = ["Seed", "Developing", "Supported", "Mature"];

function formatUpdatedAt(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ideaDescriptionPreview(description?: string) {
  if (!description) {
    return "No description yet — outline the core insight during your next editing pass.";
  }
  return description.length > 160
    ? `${description.slice(0, 157)}…`
    : description;
}

export function IdeasOverview({
  ideas,
  loading,
  onCreate,
  onSelect,
}: IdeasOverviewProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [stage, setStage] = useState<IdeaStage>("Seed");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const stageBuckets = useMemo(() => {
    return STAGES.reduce<Record<IdeaStage, Idea[]>>(
      (acc, currentStage) => {
        acc[currentStage] = ideas
          .filter((idea) => idea.stage === currentStage)
          .sort((a, b) =>
            // Optimization: Use direct string comparison for ISO dates
            b.updated_at > a.updated_at ? 1 : b.updated_at < a.updated_at ? -1 : 0
          );
        return acc;
      },
      {
        Seed: [],
        Developing: [],
        Supported: [],
        Mature: [],
      },
    );
  }, [ideas]);

  const activeCount = ideas.filter(
    (idea) => idea.stage === "Seed" || idea.stage === "Developing",
  ).length;

  const ideaHighlights = useMemo(() => {
    if (ideas.length === 0) {
      return {
        headline: "Start your idea garden",
        detail:
          "Capture the sparks that show up during reading and experiments. Name the idea and add a quick description to anchor it.",
      };
    }

    if (activeCount > 0) {
      return {
        headline: `${activeCount} idea${activeCount === 1 ? "" : "s"} in discovery`,
        detail:
          "Prioritise the Seed and Developing ideas to maintain momentum. Pull one into focus and outline the next validation step.",
      };
    }

    return {
      headline: "Ideas ready for synthesis",
      detail:
        "Most ideas are in later stages. Schedule time to polish outcomes or publish findings.",
    };
  }, [activeCount, ideas.length]);

  const handleCreateIdea = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      setError("A title helps you recognise the idea later.");
      return;
    }
    setSubmitting(true);
    setError("");

    const created = await onCreate({
      title: title.trim(),
      description: description.trim() ? description.trim() : undefined,
      stage,
    });

    if (created) {
      setTitle("");
      setDescription("");
      setStage("Seed");
    } else {
      setError("Unable to create idea. Please try again.");
    }

    setSubmitting(false);
  };

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col gap-3">
        <div className="inline-flex items-center gap-2 text-primary-500 font-semibold uppercase tracking-wide text-sm">
          <Lightbulb className="w-4 h-4" />
          Ideas Workspace
        </div>
        <h1 className="text-3xl font-bold text-text-primary">
          Shape and evolve your research ideas
        </h1>
        <p className="text-text-secondary max-w-3xl">
          Use the idea board to capture sparks, nurture promising leads, and
          track which concepts are ready for validation or publication.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAGES.map((stageName) => (
          <div
            key={stageName}
            className="bg-bg-surface border border-border-subtle rounded-xl p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-text-secondary">
                {stageName}
              </span>
              <span className="text-lg font-bold text-text-primary">
                {stageBuckets[stageName].length}
              </span>
            </div>
            <p className="text-caption text-text-tertiary mt-1">
              {stageName === "Seed" &&
                "Fresh hypotheses waiting for exploration"}
              {stageName === "Developing" &&
                "Ideas being validated and connected"}
              {stageName === "Supported" &&
                "Concepts with evidence or linked notes"}
              {stageName === "Mature" && "Ready to share, publish, or archive"}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_1fr]">
        <div className="bg-bg-surface border border-border-subtle rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-full bg-primary-500/10 text-primary-600 flex items-center justify-center">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-text-primary">
                Capture a new idea
              </h2>
              <p className="text-sm text-text-secondary">
                Log the concept quickly, then evolve it in detail view.
              </p>
            </div>
          </div>
          <form onSubmit={handleCreateIdea} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-text-secondary mb-1">
                Idea title
              </label>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Adaptive question ranking for literature reviews"
                className="w-full px-4 py-2.5 border border-border-subtle rounded-lg bg-bg-base text-body focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-text-secondary mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What problem does this idea solve? How might you test it?"
                rows={3}
                className="w-full px-4 py-2.5 border border-border-subtle rounded-lg bg-bg-base text-body focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <label className="text-sm font-semibold text-text-secondary">
                  Stage
                </label>
                <select
                  value={stage}
                  onChange={(event) =>
                    setStage(event.target.value as IdeaStage)
                  }
                  className="px-3 py-2 border border-border-subtle rounded-md bg-bg-base text-sm"
                >
                  {STAGES.map((stageOption) => (
                    <option key={stageOption} value={stageOption}>
                      {stageOption}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-500 text-white rounded-lg font-semibold hover:bg-primary-600 transition-colors disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Add idea
              </button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </form>
        </div>

        <div className="bg-primary-500/10 border border-primary-500/20 rounded-2xl shadow-inner p-6 space-y-3">
          <div className="flex items-center gap-2 text-primary-600 font-semibold text-sm uppercase tracking-wide">
            <Sparkles className="w-4 h-4" />
            Momentum insight
          </div>
          <h3 className="text-xl font-semibold text-primary-700 dark:text-primary-300">
            {ideaHighlights.headline}
          </h3>
          <p className="text-sm text-primary-700/80 dark:text-primary-200/80 leading-relaxed">
            {ideaHighlights.detail}
          </p>
        </div>
      </div>

      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold text-text-primary">
            Idea board
          </h2>
          <p className="text-sm text-text-secondary">
            Click an idea card to dive deeper, link notes, or update the stage.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-4">
          {STAGES.map((stageName) => (
            <div
              key={stageName}
              className="bg-bg-surface border border-border-subtle rounded-2xl shadow-sm p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-text-secondary">
                  {stageName}
                </span>
                <span className="text-caption text-text-tertiary">
                  {stageBuckets[stageName].length} item
                  {stageBuckets[stageName].length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="space-y-3">
                {stageBuckets[stageName].length === 0 ? (
                  <div className="text-caption text-text-tertiary bg-bg-base/60 border border-border-subtle/60 rounded-lg p-3">
                    {stageName === "Seed" &&
                      "Use the capture form above to plant your first seed idea."}
                    {stageName === "Developing" &&
                      "Move a seed here once you have next steps or supporting notes."}
                    {stageName === "Supported" &&
                      "Promote ideas with linked evidence to spotlight growing momentum."}
                    {stageName === "Mature" &&
                      "Graduated ideas rest here—add a summary or share the outcome."}
                  </div>
                ) : (
                  stageBuckets[stageName].slice(0, 4).map((idea) => (
                    <button
                      key={idea.id}
                      onClick={() => onSelect(idea)}
                      className="w-full text-left bg-bg-base/60 hover:bg-primary-500/10 border border-border-subtle/60 hover:border-primary-400 rounded-lg p-3 transition-colors"
                    >
                      <p className="text-sm font-semibold text-text-primary line-clamp-2">
                        {idea.title}
                      </p>
                      <p className="text-caption text-text-tertiary mt-1">
                        Updated {formatUpdatedAt(idea.updated_at)}
                      </p>
                      <p className="text-caption text-text-secondary mt-2 line-clamp-3">
                        {ideaDescriptionPreview(idea.description)}
                      </p>
                      <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary-500">
                        Open details <ArrowRight className="w-3 h-3" />
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {loading && (
        <div className="fixed inset-0 bg-bg-base/60 backdrop-blur-sm flex items-center justify-center z-10">
          <div className="bg-bg-surface border border-border-subtle rounded-xl px-6 py-4 shadow-lg flex items-center gap-3 text-text-secondary">
            <Loader2 className="w-5 h-5 animate-spin" />
            Syncing ideas…
          </div>
        </div>
      )}
    </div>
  );
}

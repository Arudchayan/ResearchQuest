import { Command } from "cmdk";
import { useShallow } from "zustand/react/shallow";
import { BookOpen, Search, Lightbulb, Hash, Plus } from "lucide-react";
import { usePapers } from "../../hooks/usePapers";
import { useAppStore } from "../../store/appStore";
import { extractYear } from "../../utils/citation";
import type { Paper } from "../../types/database";

interface CitationPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (citation: string) => void;
  /**
   * Item 75: called with the linked entity id (paper, idea, or topic) so
   * callers can persist a linked_entity_ids row instead of text-only.
   * useBacklinks reads linked_entity_ids, so without this the link is invisible.
   */
  onLinkEntity?: (entityId: string) => void;
}

export function CitationPicker({
  open,
  onOpenChange,
  onSelect,
  onLinkEntity,
}: CitationPickerProps) {
  const userId = useAppStore(useShallow((state) => state.user?.id));
  const ideas = useAppStore(useShallow((state) => state.ideas ?? []));
  const topics = useAppStore(useShallow((state) =>
    state.topics ? Object.values(state.topics) : [],
  ));
  const setCurrentView = useAppStore(useShallow((state) => state.setCurrentView));
  const { papers, loading } = usePapers(userId);

  const handleAddPaper = () => {
    onOpenChange(false);
    setCurrentView?.("papers");
    window.history.pushState(null, "", "/papers?tab=manual");
  };

  const handleSelect = (paper: Paper) => {
    const year = extractYear(paper.publication_date);

    let firstAuthor = "Anonymous";
    if (paper.authors && paper.authors.length > 0) {
      // Parse "Last, First" or "First Last"
      // Simple heuristic: split by comma if exists, else space
      const author = paper.authors[0];
      if (author) {
        if (author.includes(",")) {
          const commaParts = author.split(",");
          firstAuthor = commaParts[0] ? commaParts[0].trim() : "Anonymous";
        } else {
          const parts = author.split(" ");
          const lastName = parts[parts.length - 1];
          firstAuthor = lastName ?? "Anonymous";
        }
      }
    }

    const authorText =
      paper.authors?.length > 1 ? `${firstAuthor} et al.` : firstAuthor;
    const citationText = `(${authorText}, ${year})`;
    const link = paper.doi
      ? `https://doi.org/${paper.doi}`
      : paper.source_url || "";

    // Markdown link format: [(Smith et al., 2023)](https://doi.org/...)
    // If no link, just text: (Smith et al., 2023)
    const markdownCitation = link ? `[${citationText}](${link})` : citationText;

    onSelect(markdownCitation);
    onLinkEntity?.(paper.id);
    onOpenChange(false);
  };

  const handleSelectIdea = (idea: { id: string; title: string }) => {
    onSelect(`[[${idea.title}]]`);
    onLinkEntity?.(idea.id);
    onOpenChange(false);
  };

  const handleSelectTopic = (topic: { id: string; name: string }) => {
    onSelect(`#${topic.name}`);
    onLinkEntity?.(topic.id);
    onOpenChange(false);
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Insert Citation"
    >
      <div
        className="flex items-center border-b border-border-subtle px-3"
        cmdk-input-wrapper=""
      >
        <Search className="w-5 h-5 text-text-tertiary mr-2" />
        <Command.Input
          placeholder="Search papers, ideas, and topics..."
          autoFocus
        />
      </div>

      <Command.List>
        <Command.Empty role="status" aria-live="polite">
          {loading ? (
            "Loading library..."
          ) : (
            <span className="flex flex-col items-center gap-2 py-2">
              <span>No matches found.</span>
              <button
                type="button"
                onClick={handleAddPaper}
                className="inline-flex items-center gap-1.5 rounded-control bg-primary-500 px-3 py-1.5 text-small font-medium text-white hover:bg-primary-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add paper
              </button>
            </span>
          )}
        </Command.Empty>

        <Command.Group heading="Papers">
          {papers.map((paper) => (
            <Command.Item
              key={paper.id}
              value={`paper ${paper.title} ${paper.authors?.join(" ") || ""} ${extractYear(paper.publication_date)}`}
              onSelect={() => handleSelect(paper)}
            >
              <BookOpen className="w-4 h-4 text-primary-500 flex-shrink-0" />
              <div className="flex flex-col overflow-hidden">
                <span className="truncate font-medium">{paper.title}</span>
                <span className="text-xs text-text-tertiary truncate">
                  {paper.authors?.join(", ") || "Unknown Author"} •{" "}
                  {extractYear(paper.publication_date)}
                </span>
              </div>
            </Command.Item>
          ))}
        </Command.Group>

        {ideas.length > 0 && (
          <Command.Group heading="Ideas">
            {ideas.map((idea) => (
              <Command.Item
                key={idea.id}
                value={`idea ${idea.title}`}
                onSelect={() => handleSelectIdea(idea)}
              >
                <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <div className="flex flex-col overflow-hidden">
                  <span className="truncate font-medium">{idea.title}</span>
                  <span className="text-xs text-text-tertiary truncate">
                    Idea • {idea.stage}
                  </span>
                </div>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {topics.length > 0 && (
          <Command.Group heading="Topics">
            {topics.map((topic) => (
              <Command.Item
                key={topic.id}
                value={`topic ${topic.name}`}
                onSelect={() => handleSelectTopic(topic)}
              >
                <Hash className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <div className="flex flex-col overflow-hidden">
                  <span className="truncate font-medium">{topic.name}</span>
                  <span className="text-xs text-text-tertiary truncate">
                    Topic
                  </span>
                </div>
              </Command.Item>
            ))}
          </Command.Group>
        )}
      </Command.List>
    </Command.Dialog>
  );
}

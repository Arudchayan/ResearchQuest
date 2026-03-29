import { Command } from "cmdk";
import { useShallow } from "zustand/react/shallow";
import { BookOpen, Search } from "lucide-react";
import { usePapers } from "../../hooks/usePapers";
import { useAppStore } from "../../store/appStore";
import { extractYear } from "../../utils/citation";
import type { Paper } from "../../types/database";

interface CitationPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (citation: string) => void;
}

export function CitationPicker({
  open,
  onOpenChange,
  onSelect,
}: CitationPickerProps) {
  const userId = useAppStore(useShallow((state) => state.user?.id));
  const { papers, loading } = usePapers(userId);

  const handleSelect = (paper: Paper) => {
    const year = extractYear(paper.publication_date);

    let firstAuthor = "Anonymous";
    if (paper.authors && paper.authors.length > 0) {
      // Parse "Last, First" or "First Last"
      // Simple heuristic: split by comma if exists, else space
      const author = paper.authors[0];
      if (author.includes(",")) {
        firstAuthor = author.split(",")[0].trim();
      } else {
        const parts = author.split(" ");
        firstAuthor = parts[parts.length - 1]; // Assume last word is last name
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
          placeholder="Search papers by title, author, or year..."
          autoFocus
        />
      </div>

      <Command.List>
        <Command.Empty>
          {loading ? "Loading library..." : "No papers found."}
        </Command.Empty>

        <Command.Group heading="Library">
          {papers.map((paper) => (
            <Command.Item
              key={paper.id}
              value={`${paper.title} ${paper.authors?.join(" ") || ""} ${extractYear(paper.publication_date)}`}
              onSelect={() => handleSelect(paper)}
            >
              <BookOpen className="w-4 h-4 text-blue-500 flex-shrink-0" />
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
      </Command.List>
    </Command.Dialog>
  );
}

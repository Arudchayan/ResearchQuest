import { Lightbulb } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { FormDialog } from "../ui/FormDialog";

interface AddIdeaDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: { title: string; description?: string }) => void;
  isLoading?: boolean;
}

export function AddIdeaDialog({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: AddIdeaDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Reset form when opening
  useEffect(() => {
    if (isOpen) {
      setTitle("");
      setDescription("");
      // Focus first input
      setTimeout(() => {
        firstInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isLoading) return;

    onConfirm({
      title: title.trim(),
      description: description.trim() || undefined,
    });
  };

  return (
    <FormDialog
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      title="New Idea"
      description="Capture a new concept, hypothesis, or research direction."
      icon={<Lightbulb className="h-5 w-5 text-accent-strong" aria-hidden="true" />}
      submitText="Create Idea"
      isLoading={isLoading}
      isSubmitDisabled={!title.trim()}
    >
      <div>
        <label
          htmlFor="idea-title"
          className="block text-small font-medium text-text-primary mb-1.5"
        >
          Title <span aria-hidden="true">*</span>
        </label>
        <input
          ref={firstInputRef}
          id="idea-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="E.g., Neural network pruning technique"
          className="w-full h-10 rounded-lg border border-border-moderate bg-bg-base px-3.5 text-body text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent transition-shadow"
          required
          disabled={isLoading}
          maxLength={255}
        />
      </div>

      <div>
        <label
          htmlFor="idea-description"
          className="block text-small font-medium text-text-primary mb-1.5"
        >
          Description
        </label>
        <textarea
          id="idea-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional details about this idea..."
          rows={4}
          className="w-full rounded-lg border border-border-moderate bg-bg-base px-3.5 py-2.5 text-body text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent resize-none transition-shadow"
          disabled={isLoading}
          maxLength={5000}
        />
      </div>
    </FormDialog>
  );
}

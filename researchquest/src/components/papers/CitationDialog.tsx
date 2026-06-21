import { logger } from "../../utils/logger";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import { X, Copy, Check } from "lucide-react";
import { useState, useEffect } from "react";
import type { Paper } from "../../types/database";
import {
  generateBibTeX,
  generateAPA,
  generateMLA,
  generateChicago,
  generateHarvard,
} from "../../utils/citation";
import { toast } from "sonner";

interface CitationDialogProps {
  paper: Paper;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

type CitationFormat = "bibtex" | "apa" | "mla" | "chicago" | "harvard";

export function CitationDialog({
  paper,
  isOpen,
  onOpenChange,
}: CitationDialogProps) {
  const [format, setFormat] = useState<CitationFormat>("bibtex");
  const [citation, setCitation] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCopied(false);
      updateCitation(format);
    }
  }, [isOpen, paper, format, updateCitation]);

  const updateCitation = useCallback((fmt: CitationFormat) => {
    let text = "";
    switch (fmt) {
      case "bibtex":
        text = generateBibTeX(paper);
        break;
      case "apa":
        text = generateAPA(paper);
        break;
      case "mla":
        text = generateMLA(paper);
        break;
      case "chicago":
        text = generateChicago(paper);
        break;
      case "harvard":
        text = generateHarvard(paper);
        break;
    }
    setCitation(text);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(citation);
      setCopied(true);
      toast.success(
        `${format === "bibtex" ? "BibTeX" : format.toUpperCase()} copied to clipboard`,
      );
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy to clipboard");
      logger.error("Clipboard error", err);
    }
  };

  const handleTabChange = (val: string) => {
    setFormat(val as CitationFormat);
    setCopied(false);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-fade-in" />
        <Dialog.Content
          className="fixed left-[50%] top-[50%] max-h-[85vh] w-[90vw] max-w-[600px] translate-x-[-50%] translate-y-[-50%] rounded-xl bg-bg-surface shadow-2xl focus:outline-none z-50 animate-slide-in border border-border-subtle flex flex-col overflow-hidden"
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between p-6 pb-2">
            <Dialog.Title className="text-lg font-semibold text-text-primary">
              Cite Paper
            </Dialog.Title>
            <Dialog.Close
              className="p-2 hover:bg-bg-elevated rounded-full transition-colors"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5 text-text-tertiary" aria-hidden="true" />
            </Dialog.Close>
          </div>

          <Tabs.Root
            value={format}
            onValueChange={handleTabChange}
            className="flex flex-col flex-1"
          >
            <div className="px-6 border-b border-border-subtle">
              <Tabs.List className="flex gap-4 overflow-x-auto no-scrollbar">
                {["bibtex", "apa", "mla", "chicago", "harvard"].map((fmt) => (
                  <Tabs.Trigger
                    key={fmt}
                    value={fmt}
                    className="pb-3 px-1 text-sm font-medium text-text-secondary data-[state=active]:text-primary-600 dark:data-[state=active]:text-primary-400 data-[state=active]:border-b-2 data-[state=active]:border-primary-600 dark:data-[state=active]:border-primary-400 transition-all outline-none capitalize whitespace-nowrap hover:text-text-primary"
                  >
                    {fmt === "bibtex" ? "BibTeX" : fmt.toUpperCase()}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
            </div>

            <div className="p-6 pt-4 flex-1">
              <div className="relative">
                <pre className="w-full p-4 bg-bg-elevated border border-border-subtle rounded-lg text-sm font-mono text-text-secondary overflow-x-auto whitespace-pre-wrap max-h-[400px]">
                  {citation}
                </pre>
                <button
                  onClick={handleCopy}
                  className="absolute top-2 right-2 p-2 bg-bg-surface border border-border-subtle rounded-md shadow-sm hover:bg-bg-base transition-colors"
                  title="Copy to clipboard"
                  aria-label="Copy citation to clipboard"

                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-500" aria-hidden="true" />
                  ) : (
                    <Copy className="w-4 h-4 text-text-tertiary" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
          </Tabs.Root>

          <div className="flex justify-end gap-2 p-6 pt-0">
            <Dialog.Close className="px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-elevated rounded-lg transition-colors">
              Close
            </Dialog.Close>
            <button
              onClick={handleCopy}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors flex items-center gap-2"
            >
              {copied ? (
                <Check className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              {copied
                ? "Copied!"
                : `Copy ${format === "bibtex" ? "BibTeX" : format.toUpperCase()}`}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

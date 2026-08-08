import { logger } from "../../utils/logger";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import { X, Copy, Check, Quote } from "lucide-react";
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
  }, [isOpen, paper, format]);

  const updateCitation = (fmt: CitationFormat) => {
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
          className="fixed left-[50%] top-[50%] max-h-[85vh] w-[90vw] max-w-[600px] translate-x-[-50%] translate-y-[-50%] rounded-xl bg-bg-surface shadow-lift focus:outline-none z-50 animate-slide-in border border-border-moderate flex flex-col overflow-hidden"
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between p-6 pb-2">
            <div className="flex items-center gap-3">
              <span className="icon-tile bg-violet-soft text-violet-strong">
                <Quote className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="section-kicker">Citation</p>
                <Dialog.Title className="mt-1 font-serif text-lg font-semibold text-text-primary">
                  Cite Paper
                </Dialog.Title>
              </div>
            </div>
            <Dialog.Close
              className="icon-btn"
              aria-label="Close dialog"
            >
              <X className="h-4 w-4 text-text-tertiary" aria-hidden="true" />
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
                    className="border-b-2 border-transparent px-1 pb-3 text-sm font-medium text-text-secondary capitalize whitespace-nowrap outline-none transition-all hover:text-text-primary data-[state=active]:border-accent data-[state=active]:text-accent-strong"
                  >
                    {fmt === "bibtex" ? "BibTeX" : fmt.toUpperCase()}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
            </div>

            <div className="p-6 pt-4 flex-1">
              <div className="relative">
                <pre className="w-full max-h-[400px] overflow-x-auto rounded-lg border border-border-subtle bg-bg-elevated p-4 text-sm font-mono text-text-secondary whitespace-pre-wrap">
                  {citation}
                </pre>
                <button
                  onClick={handleCopy}
                  className="icon-btn absolute right-2 top-2 h-9 w-9 bg-bg-surface"
                  title="Copy to clipboard"
                  aria-label="Copy citation to clipboard"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-success" aria-hidden="true" />
                  ) : (
                    <Copy className="h-4 w-4 text-text-tertiary" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
          </Tabs.Root>

          <div className="flex justify-end gap-2 border-t border-border-subtle p-6">
            <Dialog.Close className="inline-flex h-10 items-center justify-center rounded-lg border border-border-moderate bg-bg-surface px-4 text-sm font-semibold text-text-secondary shadow-sm transition-all hover:-translate-y-0.5 hover:border-border-strong hover:bg-bg-elevated hover:text-text-primary hover:shadow-lift">
              Close
            </Dialog.Close>
            <button
              onClick={handleCopy}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-text-primary px-4 text-sm font-semibold text-bg-base shadow-lift transition-transform hover:-translate-y-0.5 hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
            >
              {copied ? (
                <Check className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4" aria-hidden="true" />
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

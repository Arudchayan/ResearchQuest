import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import {
  analyzeTarget,
  categoryLabel,
  type AdversarialFinding,
  type AdversarialReview,
  type ReviewTarget,
} from "../../utils/adversarialAnalysis";
import { performDeepResearch } from "../../utils/deepResearch";
import { useAppStore } from "../../store/appStore";
import type { Note, Paper, Idea, TopicWithCounts } from "../../types/database";

interface AdversarialReviewPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: ReviewTarget;
}

const SEVERITY_STYLES: Record<AdversarialFinding["severity"], string> = {
  high: "bg-coral-soft text-coral-strong border border-coral/20",
  medium: "bg-gold-soft text-gold-strong border border-gold/20",
  low: "bg-blue-soft text-blue-strong border border-blue/20",
};

function FindingCard({ finding }: { finding: AdversarialFinding }) {
  return (
    <div className="surface-card p-4">
      <div className="flex items-start gap-3">
        <span className={`status-chip mt-0.5 shrink-0 ${SEVERITY_STYLES[finding.severity]}`}>
          {finding.severity}
        </span>
        <div className="min-w-0">
          <div className="text-small font-semibold text-text-primary">
            {categoryLabel(finding.category)} · {finding.title}
          </div>
          <p className="mt-1 text-small text-text-secondary">{finding.detail}</p>
          <p className="mt-2 flex items-start gap-1.5 text-caption text-accent-strong">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {finding.suggestion}
          </p>
        </div>
      </div>
    </div>
  );
}

export function AdversarialReviewPanel({
  open,
  onOpenChange,
  target,
}: AdversarialReviewPanelProps) {
  const notes = useAppStore((state) => state.notes);
  const papers = useAppStore((state) => state.papers);
  const ideas = useAppStore((state) => state.ideas);
  const topics = Object.values(useAppStore((state) => state.topics)) as TopicWithCounts[];

  const [review, setReview] = useState<AdversarialReview | null>(null);
  const [deepMode, setDeepMode] = useState(false);
  const [deepLoading, setDeepLoading] = useState(false);
  const [deepResult, setDeepResult] = useState<{
    reasoningSteps: string[];
    summary: string;
    suggestedKeywords: string[];
  } | null>(null);

  const runAnalysis = () => {
    setReview(analyzeTarget(target, notes, papers, ideas, topics));
  };

  const runDeepResearch = async () => {
    setDeepLoading(true);
    setDeepMode(true);
    try {
      const result = await performDeepResearch(target.title);
      setDeepResult({
        reasoningSteps: result.reasoningSteps,
        summary: result.summary,
        suggestedKeywords: result.suggestedKeywords,
      });
    } catch {
      setDeepResult({
        reasoningSteps: [],
        summary: "Deep research is unavailable in this environment.",
        suggestedKeywords: [],
      });
    } finally {
      setDeepLoading(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[min(92vw,48rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border-subtle bg-bg-surface shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border-subtle bg-bg-surface/95 px-6 py-4 backdrop-blur">
            <div className="flex items-center gap-3">
              <span className="icon-tile bg-coral-soft text-coral-strong">
                <ShieldAlert className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <Dialog.Title className="font-serif text-lg font-bold text-text-primary">
                  Adversarial review
                </Dialog.Title>
                <Dialog.Description className="text-caption text-text-tertiary">
                  {target.type === "idea" ? "Idea stress test" : "Paper stress test"}
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button className="icon-btn" aria-label="Close adversarial review">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          <div className="px-6 py-6">
            <div className="mb-5 rounded-xl border border-border-subtle bg-bg-elevated p-4">
              <div className="text-caption font-semibold uppercase tracking-wider text-text-secondary">
                Under review
              </div>
              <p className="mt-1 font-serif text-base font-bold text-text-primary">
                {target.title}
              </p>
            </div>

            {!review && !deepMode && (
              <div className="surface-card flex flex-col items-center gap-4 p-8 text-center">
                <span className="icon-tile h-14 w-14 bg-coral-soft text-coral-strong">
                  <ShieldAlert className="h-6 w-6" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-serif text-lg font-bold text-text-primary">
                    Stress test this record
                  </p>
                  <p className="mx-auto mt-1 max-w-sm text-small text-text-secondary">
                    Check assumptions, counterarguments, evidence gaps, and risks
                    before relying on it.
                  </p>
                </div>
                <button
                  onClick={runAnalysis}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-text-primary px-5 text-sm font-semibold text-bg-base shadow-lift transition-transform hover:-translate-y-0.5"
                >
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  Run adversarial analysis
                </button>
              </div>
            )}

            {review && !deepMode && (
              <div className="animate-rise space-y-6">
                <div className="flex flex-col items-center gap-4 rounded-xl border border-border-subtle bg-bg-elevated p-5 sm:flex-row sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative flex h-20 w-20 items-center justify-center">
                      <svg width="80" height="80" className="-rotate-90">
                        <circle
                          cx="40"
                          cy="40"
                          r="34"
                          fill="none"
                          stroke="var(--bg-layer-3)"
                          strokeWidth="7"
                        />
                        <circle
                          cx="40"
                          cy="40"
                          r="34"
                          fill="none"
                          stroke={review.score >= 75 ? "var(--success)" : review.score >= 55 ? "var(--gold)" : "var(--coral)"}
                          strokeWidth="7"
                          strokeLinecap="round"
                          strokeDasharray={2 * Math.PI * 34}
                          strokeDashoffset={2 * Math.PI * 34 * (1 - review.score / 100)}
                        />
                      </svg>
                      <span className="absolute font-serif text-xl font-bold text-text-primary">
                        {review.score}
                      </span>
                    </div>
                    <div>
                      <div className="text-small font-semibold text-text-primary">
                        Confidence score
                      </div>
                      <p className="mt-1 max-w-sm text-caption text-text-secondary">
                        {review.summary}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={runDeepResearch}
                    disabled={deepLoading}
                    className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-border-moderate bg-bg-surface px-4 text-small font-semibold text-text-primary transition-colors hover:border-accent disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4 text-accent-strong" aria-hidden="true" />
                    Deeper research
                  </button>
                </div>

                {review.findings.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-small font-bold uppercase tracking-wider text-text-primary">
                      Findings
                    </h3>
                    <div className="space-y-3">
                      {review.findings.map((finding) => (
                        <FindingCard key={finding.id} finding={finding} />
                      ))}
                    </div>
                  </div>
                )}

                {review.strengths.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-small font-bold uppercase tracking-wider text-text-primary">
                      Strengths
                    </h3>
                    <div className="space-y-2">
                      {review.strengths.map((strength) => (
                        <div
                          key={strength}
                          className="flex items-start gap-2.5 rounded-lg border border-success/20 bg-success-bg p-3 text-small text-success"
                        >
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                          {strength}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {deepMode && (
              <div className="animate-rise space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-small font-bold uppercase tracking-wider text-text-primary">
                    Deep research
                  </h3>
                  <button
                    onClick={() => setDeepMode(false)}
                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-small font-medium text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary"
                  >
                    Back to findings
                  </button>
                </div>
                {deepLoading ? (
                  <div className="flex flex-col items-center gap-3 rounded-xl border border-border-subtle bg-bg-elevated p-10 text-center">
                    <Loader2 className="h-7 w-7 animate-spin text-accent-strong" aria-hidden="true" />
                    <p className="text-small text-text-secondary">Running deep research…</p>
                  </div>
                ) : deepResult ? (
                  <div className="space-y-5">
                    <div className="rounded-xl border border-border-subtle bg-bg-elevated p-4">
                      <div className="mb-2 flex items-center gap-2 text-caption font-semibold uppercase tracking-wider text-accent-strong">
                        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                        Synthesis
                      </div>
                      <p className="text-small text-text-secondary">{deepResult.summary}</p>
                    </div>
                    {deepResult.reasoningSteps.length > 0 && (
                      <div>
                        <h4 className="mb-3 text-caption font-bold uppercase tracking-wider text-text-primary">
                          Reasoning steps
                        </h4>
                        <ol className="space-y-2.5">
                          {deepResult.reasoningSteps.map((step, index) => (
                            <li key={step} className="flex items-start gap-3">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-caption font-bold text-accent-strong">
                                {index + 1}
                              </span>
                              <span className="text-small text-text-secondary">{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                    {deepResult.suggestedKeywords.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {deepResult.suggestedKeywords.map((keyword) => (
                          <span
                            key={keyword}
                            className="rounded-full border border-border-subtle bg-bg-elevated px-2.5 py-1 text-caption text-text-secondary"
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="surface-card p-6 text-center">
                    <AlertTriangle className="mx-auto h-6 w-6 text-coral-strong" aria-hidden="true" />
                    <p className="mt-2 text-small text-text-secondary">Deep research could not run.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

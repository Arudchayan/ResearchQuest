import * as Dialog from "@radix-ui/react-dialog";
import {
  AlertTriangle,
  CheckCircle2,
  FileJson,
  FileText,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import {
  auditToMarkdown,
  auditWorkspace,
  categoryLabel,
  type WorkspaceAudit,
  type WorkspaceAuditFinding,
} from "../../utils/adversarialAnalysis";
import { downloadFile } from "../../utils/export";
import { useAppStore } from "../../store/appStore";

interface WorkspaceAuditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SEVERITY_STYLES: Record<string, string> = {
  high: "bg-coral-soft text-coral-strong border border-coral/20",
  medium: "bg-gold-soft text-gold-strong border border-gold/20",
  low: "bg-blue-soft text-blue-strong border border-blue/20",
};

const CATEGORY_BARS: Record<string, string> = {
  assumption: "bg-gold",
  counterargument: "bg-blue",
  evidence_gap: "bg-coral",
  risk: "bg-violet",
};

function AuditFindingRow({ item }: { item: WorkspaceAuditFinding }) {
  return (
    <div className="surface-card p-4">
      <div className="flex items-start gap-3">
        <span className={`status-chip mt-0.5 shrink-0 ${SEVERITY_STYLES[item.finding.severity]}`}>
          {item.finding.severity}
        </span>
        <div className="min-w-0">
          <div className="text-caption font-bold uppercase tracking-wider text-text-tertiary">
            {item.entityType} · {categoryLabel(item.finding.category)}
          </div>
          <div className="mt-0.5 text-small font-semibold text-text-primary">
            {item.entityTitle}
          </div>
          <p className="mt-1 text-small text-text-secondary">{item.finding.title}</p>
          <p className="mt-1 text-caption text-text-tertiary">{item.finding.detail}</p>
        </div>
      </div>
    </div>
  );
}

export function WorkspaceAuditDialog({
  open,
  onOpenChange,
}: WorkspaceAuditDialogProps) {
  const notes = useAppStore((state) => state.notes);
  const papers = useAppStore((state) => state.papers);
  const ideas = useAppStore((state) => state.ideas);
  const topics = Object.values(useAppStore((state) => state.topics));

  const audit: WorkspaceAudit = auditWorkspace(notes, papers, ideas, topics);
  const totalFindings =
    audit.severityCounts.high + audit.severityCounts.medium + audit.severityCounts.low;
  const scoreColor =
    audit.score >= 78 ? "var(--success)" : audit.score >= 55 ? "var(--gold)" : "var(--coral)";
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - audit.score / 100);

  const handleExportMarkdown = () => {
    downloadFile(
      auditToMarkdown(audit),
      `researchquest-audit-${new Date().toISOString().slice(0, 10)}.md`,
      "text/markdown",
    );
  };

  const handleExportJson = () => {
    downloadFile(
      JSON.stringify(audit, null, 2),
      `researchquest-audit-${new Date().toISOString().slice(0, 10)}.json`,
      "application/json",
    );
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[min(92vw,52rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border-subtle bg-bg-surface shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border-subtle bg-bg-surface/95 px-6 py-4 backdrop-blur">
            <div className="flex items-center gap-3">
              <span className="icon-tile bg-accent-soft text-accent-strong">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <Dialog.Title className="font-serif text-lg font-bold text-text-primary">
                  Workspace health audit
                </Dialog.Title>
                <Dialog.Description className="text-caption text-text-tertiary">
                  Adversarial review across your entire library
                </Dialog.Description>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportMarkdown}
                className="icon-btn bg-bg-elevated text-text-secondary hover:bg-bg-surface hover:text-text-primary"
                aria-label="Export audit as Markdown"
                title="Export as Markdown"
              >
                <FileText className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                onClick={handleExportJson}
                className="icon-btn bg-bg-elevated text-text-secondary hover:bg-bg-surface hover:text-text-primary"
                aria-label="Export audit as JSON"
                title="Export as JSON"
              >
                <FileJson className="h-4 w-4" aria-hidden="true" />
              </button>
              <Dialog.Close asChild>
                <button className="icon-btn" aria-label="Close workspace audit">
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </Dialog.Close>
            </div>
          </div>

          <div className="px-6 py-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,18rem)_1fr]">
              <div className="flex flex-col items-center gap-4 rounded-xl border border-border-subtle bg-bg-elevated p-6 text-center">
                <div className="relative flex h-28 w-28 items-center justify-center">
                  <svg width="112" height="112" className="-rotate-90">
                    <circle
                      cx="56"
                      cy="56"
                      r={radius}
                      fill="none"
                      stroke="var(--bg-layer-3)"
                      strokeWidth="10"
                    />
                    <circle
                      cx="56"
                      cy="56"
                      r={radius}
                      fill="none"
                      stroke={scoreColor}
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={offset}
                      className="transition-[stroke-dashoffset] duration-1000 ease-out"
                    />
                  </svg>
                  <div className="absolute font-serif text-3xl font-bold text-text-primary">
                    {audit.score}
                  </div>
                </div>
                <div>
                  <div className="text-small font-semibold text-text-primary">Health score</div>
                  <p className="mt-1 text-caption text-text-secondary">{audit.summary}</p>
                </div>
                <div className="grid w-full grid-cols-3 gap-2">
                  <div className="rounded-lg bg-coral-soft px-2 py-2">
                    <div className="text-lg font-bold text-coral-strong">{audit.severityCounts.high}</div>
                    <div className="text-caption text-coral-strong">High</div>
                  </div>
                  <div className="rounded-lg bg-gold-soft px-2 py-2">
                    <div className="text-lg font-bold text-gold-strong">{audit.severityCounts.medium}</div>
                    <div className="text-caption text-gold-strong">Medium</div>
                  </div>
                  <div className="rounded-lg bg-blue-soft px-2 py-2">
                    <div className="text-lg font-bold text-blue-strong">{audit.severityCounts.low}</div>
                    <div className="text-caption text-blue-strong">Low</div>
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-xl border border-border-subtle bg-bg-elevated p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-small font-bold uppercase tracking-wider text-text-primary">
                      Issue categories
                    </h3>
                    <span className="text-caption text-text-tertiary">
                      {totalFindings} total findings
                    </span>
                  </div>
                  <div className="space-y-3">
                    {(Object.keys(audit.categoryCounts) as Array<keyof typeof audit.categoryCounts>).map(
                      (category) => {
                        const count = audit.categoryCounts[category];
                        const max = Math.max(1, ...Object.values(audit.categoryCounts));
                        return (
                          <div key={category} className="flex items-center gap-3">
                            <span className="w-28 shrink-0 text-caption font-medium text-text-secondary">
                              {categoryLabel(category)}
                            </span>
                            <div className="progress-track h-2 flex-1">
                              <div
                                className={`h-full rounded-full ${CATEGORY_BARS[category] ?? "bg-accent"}`}
                                style={{ width: `${(count / max) * 100}%` }}
                              />
                            </div>
                            <span className="w-6 shrink-0 text-right text-caption font-semibold text-text-primary">
                              {count}
                            </span>
                          </div>
                        );
                      },
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border-subtle bg-bg-elevated p-4">
                  <span className="icon-tile bg-success-bg text-success">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="text-small font-medium text-text-primary">Strengths</span>
                  <div className="flex flex-1 flex-wrap gap-2">
                    {audit.strengths.length > 0 ? (
                      audit.strengths.map((strength) => (
                        <span
                          key={strength}
                          className="rounded-full border border-success/20 bg-success-bg px-2.5 py-1 text-caption text-success"
                        >
                          {strength}
                        </span>
                      ))
                    ) : (
                      <span className="text-caption text-text-tertiary">
                        Add more connected research to surface strengths.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-7">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-small font-bold uppercase tracking-wider text-text-primary">
                  Priority findings
                </h3>
                <span className="status-chip bg-accent-soft text-accent-strong">
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                  Sorted by severity
                </span>
              </div>
              {audit.findings.length === 0 ? (
                <div className="surface-card flex flex-col items-center gap-3 p-8 text-center">
                  <ShieldCheck className="h-7 w-7 text-success" aria-hidden="true" />
                  <p className="font-serif text-base font-bold text-text-primary">
                    No significant adversarial findings
                  </p>
                  <p className="max-w-md text-small text-text-secondary">
                    Every paper and idea in the workspace passed the automated stress test.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {audit.findings.map((item) => (
                    <AuditFindingRow key={item.id} item={item} />
                  ))}
                </div>
              )}
              {audit.findings.length === 12 && (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-elevated p-3 text-caption text-text-tertiary">
                  <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Showing the top 12 findings. Export the report for the complete list.
                </div>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

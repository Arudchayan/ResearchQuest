import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  FileText,
  Gauge,
  Hash,
  Lightbulb,
  ShieldCheck,
} from "lucide-react";
import {
  auditWorkspace,
  categoryLabel,
  type AdversarialFinding,
  type WorkspaceAudit,
  type WorkspaceAuditFinding,
} from "../../utils/adversarialAnalysis";
import { useAppStore } from "../../store/appStore";
import { cn } from "../../lib/utils";

type EntityFilter = "all" | "paper" | "idea" | "note" | "topic";
type SeverityFilter = "all" | "high" | "medium" | "low";

const SEVERITY_STYLES: Record<AdversarialFinding["severity"], string> = {
  high: "bg-coral-soft text-coral-strong border border-coral/20",
  medium: "bg-gold-soft text-gold-strong border border-gold/20",
  low: "bg-blue-soft text-blue-strong border border-blue/20",
};

const ENTITY_ICONS: Record<EntityFilter, typeof BookOpen> = {
  all: Gauge,
  paper: BookOpen,
  idea: Lightbulb,
  note: FileText,
  topic: Hash,
};

function FindingRow({ item }: { item: WorkspaceAuditFinding }) {
  return (
    <div className="surface-card p-4">
      <div className="flex items-start gap-3">
        <span className={`status-chip mt-0.5 shrink-0 ${SEVERITY_STYLES[item.finding.severity]}`}>
          {item.finding.severity}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-caption font-bold uppercase tracking-wider text-text-tertiary">
              {item.entityType} · {categoryLabel(item.finding.category)}
            </span>
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

export function AnalysisView() {
  const notes = useAppStore((state) => state.notes);
  const papers = useAppStore((state) => state.papers);
  const ideas = useAppStore((state) => state.ideas);
  const topics = Object.values(useAppStore((state) => state.topics));
  const [entityFilter, setEntityFilter] = useState<EntityFilter>("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");

  const audit: WorkspaceAudit = useMemo(
    () => auditWorkspace(notes, papers, ideas, topics),
    [notes, papers, ideas, topics],
  );

  const filtered = audit.findings.filter(
    (item) =>
      (entityFilter === "all" || item.entityType === entityFilter) &&
      (severityFilter === "all" || item.finding.severity === severityFilter),
  );

  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - audit.score / 100);
  const scoreColor =
    audit.score >= 78 ? "var(--success)" : audit.score >= 55 ? "var(--gold)" : "var(--coral)";

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6 md:p-10">
      <section className="hero-ambient surface-panel overflow-hidden p-7 md:p-10">
        <div className="relative z-10 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <span className="icon-tile bg-coral-soft text-coral-strong">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="section-kicker">Adversarial Analysis</span>
            </div>
            <h1 className="font-serif text-title font-bold text-text-primary md:text-hero">
              Stress test the workspace.
            </h1>
            <p className="mt-4 max-w-2xl text-body-lg text-text-secondary">
              Assumptions, counterarguments, evidence gaps, and risks across
              papers, ideas, notes, and topics.
            </p>
          </div>
          <div className="flex items-center gap-5 rounded-2xl border border-border-subtle bg-bg-surface/80 p-6 shadow-card backdrop-blur">
            <div className="relative flex h-36 w-36 items-center justify-center">
              <svg width="140" height="140" className="-rotate-90">
                <circle
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  stroke="var(--bg-elevated)"
                  strokeWidth="12"
                />
                <circle
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  stroke={scoreColor}
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  className="transition-[stroke-dashoffset] duration-1000 ease-out"
                />
              </svg>
              <div className="absolute text-center">
                <div className="font-serif text-4xl font-bold text-text-primary">
                  {audit.score}
                </div>
                <div className="text-caption text-text-tertiary">Health</div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <span className="text-caption font-medium text-text-secondary">High</span>
                <span className="text-lg font-bold text-coral-strong">{audit.severityCounts.high}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-caption font-medium text-text-secondary">Medium</span>
                <span className="text-lg font-bold text-gold-strong">{audit.severityCounts.medium}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-caption font-medium text-text-secondary">Low</span>
                <span className="text-lg font-bold text-blue-strong">{audit.severityCounts.low}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Entity counts */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Audited records">
        {(
          [
            ["paper", "Papers", audit.entityCounts.papers, BookOpen],
            ["idea", "Ideas", audit.entityCounts.ideas, Lightbulb],
            ["note", "Notes", audit.entityCounts.notes, FileText],
            ["topic", "Topics", audit.entityCounts.topics, Hash],
          ] as const
        ).map(([key, label, count, Icon]) => (
          <div key={key} className="surface-card flex items-center gap-4 p-5">
            <span className="icon-tile bg-accent-soft text-accent-strong">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <div className="font-serif text-2xl font-bold text-text-primary">{count}</div>
              <div className="text-caption text-text-tertiary">{label} audited</div>
            </div>
          </div>
        ))}
      </section>

      {/* Filters + findings */}
      <section className="surface-panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-subtle px-6 py-5">
          <div>
            <h2 className="font-serif text-lg font-bold text-text-primary">Findings</h2>
            <p className="mt-0.5 text-caption text-text-tertiary">
              {filtered.length} shown · {audit.findings.length} top-ranked overall
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(Object.keys(ENTITY_ICONS) as EntityFilter[]).map((filter) => {
              const Icon = ENTITY_ICONS[filter];
              return (
                <button
                  key={filter}
                  onClick={() => setEntityFilter(filter)}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-small font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
                    entityFilter === filter
                      ? "bg-accent-soft text-accent-strong"
                      : "bg-bg-elevated text-text-secondary hover:text-text-primary",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {filter === "all" ? "All" : `${filter[0].toUpperCase()}${filter.slice(1)}s`}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            {(["all", "high", "medium", "low"] as SeverityFilter[]).map((filter) => (
              <button
                key={filter}
                onClick={() => setSeverityFilter(filter)}
                className={cn(
                  "inline-flex h-8 items-center rounded-full border px-3 text-caption font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
                  severityFilter === filter
                    ? "border-accent/30 bg-accent-soft text-accent-strong"
                    : "border-border-subtle bg-bg-elevated text-text-secondary hover:text-text-primary",
                )}
              >
                {filter === "all" ? "All" : filter}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 p-6">
          {filtered.length === 0 ? (
            <div className="surface-card flex flex-col items-center gap-3 p-10 text-center">
              <ShieldCheck className="h-8 w-8 text-success" aria-hidden="true" />
              <p className="font-serif text-lg font-bold text-text-primary">
                No findings in this view
              </p>
              <p className="max-w-md text-small text-text-secondary">
                Adjust the filters or add more connected research to surface
                deeper adversarial findings.
              </p>
            </div>
          ) : (
            filtered.map((item) => <FindingRow key={item.id} item={item} />)
          )}
        </div>
      </section>

      {audit.findings.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-border-subtle bg-bg-elevated p-4 text-small text-text-secondary">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold-strong" aria-hidden="true" />
          <p>
            These are automated adversarial signals, not verdicts. Resolve the
            high-severity items first, then use the exportable audit from the
            dashboard for a complete record.
          </p>
        </div>
      )}
    </div>
  );
}

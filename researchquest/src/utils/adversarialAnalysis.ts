import type { Idea, Note, Paper, TopicWithCounts } from "../types/database";

export type AdversarialCategory =
  | "assumption"
  | "counterargument"
  | "evidence_gap"
  | "risk";

export interface AdversarialFinding {
  id: string;
  severity: "high" | "medium" | "low";
  category: AdversarialCategory;
  title: string;
  detail: string;
  suggestion: string;
}

export interface AdversarialReview {
  entityTitle: string;
  score: number;
  summary: string;
  findings: AdversarialFinding[];
  strengths: string[];
}

export interface WorkspaceAuditFinding {
  id: string;
  entityType: "paper" | "idea" | "note" | "topic";
  entityId: string;
  entityTitle: string;
  finding: AdversarialFinding;
}

export interface WorkspaceAudit {
  score: number;
  summary: string;
  entityCounts: {
    papers: number;
    ideas: number;
    notes: number;
    topics: number;
  };
  severityCounts: Record<AdversarialFinding["severity"], number>;
  categoryCounts: Record<AdversarialCategory, number>;
  findings: WorkspaceAuditFinding[];
  strengths: string[];
  generatedAt: string;
}

export interface ConfidenceBadge {
  score: number;
  label: "Strong" | "Moderate" | "Needs work";
  tone: "success" | "gold" | "coral";
}

export interface ReviewTarget {
  type: "idea" | "paper";
  title: string;
  description?: string;
  stage?: string;
  status?: string;
  authors?: string[];
  abstract?: string;
  publicationDate?: string;
  sourceUrl?: string;
  linkedNoteIds?: string[];
  linkedPaperIds?: string[];
}

const ABSOLUTE_CLAIMS =
  /\b(always|never|definitively|proves?|guarantees?|obviously|certainly|undeniably|impossible|all)\b/i;

function categoryLabel(category: AdversarialCategory): string {
  switch (category) {
    case "assumption":
      return "Assumption";
    case "counterargument":
      return "Counterargument";
    case "evidence_gap":
      return "Evidence gap";
    case "risk":
      return "Risk";
  }
}

function findSimilarTitle(
  title: string,
  candidates: Array<{ id: string; title: string }>,
  excludeId?: string,
): { id: string; title: string } | null {
  const normalized = title.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  const tokens = new Set(normalized.split(/\s+/).filter((token) => token.length > 3));
  if (tokens.size === 0) return null;

  for (const candidate of candidates) {
    if (excludeId && candidate.id === excludeId) continue;
    const candidateTokens = new Set(
      candidate.title
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, "")
        .split(/\s+/)
        .filter((token) => token.length > 3),
    );
    let overlap = 0;
    tokens.forEach((token) => {
      if (candidateTokens.has(token)) overlap++;
    });
    if (overlap >= Math.min(2, tokens.size)) {
      return candidate;
    }
  }
  return null;
}

function makeFinding(
  severity: AdversarialFinding["severity"],
  category: AdversarialCategory,
  title: string,
  detail: string,
  suggestion: string,
): AdversarialFinding {
  return {
    id: `${category}-${severity}-${title.length}-${Math.random().toString(36).slice(2, 6)}`,
    severity,
    category,
    title,
    detail,
    suggestion,
  };
}

export function analyzeIdea(
  idea: Idea,
  notes: Note[],
  papers: Paper[],
  ideas: Idea[],
): AdversarialReview {
  const findings: AdversarialFinding[] = [];
  const strengths: string[] = [];
  const linkedNotes = (idea.linked_note_ids ?? []).filter((id) =>
    notes.some((note) => note.id === id),
  ).length;
  const linkedPapers = (idea.linked_paper_ids ?? []).filter((id) =>
    papers.some((paper) => paper.id === id),
  ).length;
  const linkCount = linkedNotes + linkedPapers;
  const descriptionLength = idea.description?.trim().length ?? 0;

  if (ABSOLUTE_CLAIMS.test(idea.title)) {
    findings.push(
      makeFinding(
        "high",
        "assumption",
        "Absolute claim in the idea title",
        `The title uses language such as "${idea.title.match(ABSOLUTE_CLAIMS)?.[0]}" that overstates certainty before evidence is gathered.`,
        "Rephrase the hypothesis so a contrary result remains possible.",
      ),
    );
  }

  if (linkCount === 0) {
    findings.push(
      makeFinding(
        "high",
        "evidence_gap",
        "No linked evidence yet",
        "This idea is not connected to any note or paper. There is nothing in the workspace that currently supports or challenges it.",
        "Attach one note capturing the motivation and one paper that either supports or opposes the idea.",
      ),
    );
  } else if (linkCount === 1) {
    findings.push(
      makeFinding(
        "medium",
        "evidence_gap",
        "Single-source support",
        "Only one linked source stands behind this idea. Single-source support is vulnerable to selection bias.",
        "Find at least one independent source, ideally from a different method or venue.",
      ),
    );
  } else {
    strengths.push("Multiple linked sources provide a starting evidence base.");
  }

  if (idea.stage === "Mature" && linkCount < 2) {
    findings.push(
      makeFinding(
        "high",
        "risk",
        "Mature stage with thin evidence",
        "The idea is marked Mature but is supported by fewer than two linked sources.",
        "Downgrade the stage or add the missing supporting sources before treating it as mature.",
      ),
    );
  }

  if (idea.stage === "Seed" && descriptionLength < 80) {
    findings.push(
      makeFinding(
        "medium",
        "assumption",
        "Under-specified seed",
        "The description is short, so the scope, population, and success criteria are ambiguous.",
        "Expand the description with the research question, method sketch, and expected outcome.",
      ),
    );
  }

  if (idea.stage !== "Mature") {
    findings.push(
      makeFinding(
        "low",
        "counterargument",
        "Missing devil's advocate",
        "No counterargument is recorded for the current stage. Research ideas strengthen when their strongest objection is explicit.",
        "Write a short note with the best argument against the idea, then link it.",
      ),
    );
  }

  const duplicate = findSimilarTitle(idea.title, ideas, idea.id);
  if (duplicate) {
    findings.push(
      makeFinding(
        "medium",
        "counterargument",
        "Possible duplicate idea",
        `"${duplicate.title}" covers similar ground. Parallel ideas can split evidence and create confusion.`,
        "Merge or clearly differentiate the two ideas in their descriptions.",
      ),
    );
  }

  if (linkedPapers > 0) {
    strengths.push("The idea is grounded in the paper library.");
  }
  if (descriptionLength > 200) {
    strengths.push("The description is detailed enough to guide next steps.");
  }

  const score = Math.max(
    20,
    Math.min(
      98,
      72 +
        Math.min(18, linkCount * 6) -
        findings.filter((finding) => finding.severity === "high").length * 10 -
        findings.filter((finding) => finding.severity === "medium").length * 4,
    ),
  );

  return {
    entityTitle: idea.title,
    score,
    summary: buildSummary(score, findings.length),
    findings: findings.slice(0, 6),
    strengths,
  };
}

export function analyzePaper(
  paper: Paper,
  notes: Note[],
  ideas: Idea[],
  papers: Paper[],
): AdversarialReview {
  const findings: AdversarialFinding[] = [];
  const strengths: string[] = [];
  const mentioned = notes.filter((note) =>
    (note.linked_entity_ids ?? []).includes(paper.id),
  ).length;
  const supportedIdeas = ideas.filter((idea) =>
    (idea.linked_paper_ids ?? []).includes(paper.id),
  ).length;

  if (!paper.abstract || paper.abstract.trim().length < 60) {
    findings.push(
      makeFinding(
        "high",
        "evidence_gap",
        "Abstract or summary is missing",
        "Without an abstract, the paper's claims and methods are hard to evaluate during triage.",
        "Capture a 3-4 sentence summary of the methods and headline result.",
      ),
    );
  }

  if (!paper.source_url && !paper.doi) {
    findings.push(
      makeFinding(
        "high",
        "evidence_gap",
        "No verifiable source link",
        "The paper has neither a URL nor a DOI, so the record cannot be independently verified.",
        "Add the DOI or publisher URL to the paper record.",
      ),
    );
  }

  if (paper.publication_date) {
    const year = Number(paper.publication_date.slice(0, 4));
    const currentYear = new Date().getFullYear();
    if (Number.isFinite(year) && currentYear - year > 5) {
      findings.push(
        makeFinding(
          "medium",
          "risk",
          "Publication is more than five years old",
          `The paper was published in ${year}. Fast-moving fields can render older claims incomplete.`,
          "Check for a newer review or follow-up that updates the conclusions.",
        ),
      );
    }
  }

  if (!paper.authors || paper.authors.length === 0) {
    findings.push(
      makeFinding(
        "medium",
        "evidence_gap",
        "Authors are not recorded",
        "Missing authorship makes provenance and credit tracking difficult.",
        "Populate the author list from the DOI or publisher page.",
      ),
    );
  } else {
    strengths.push("Authorship is recorded.");
  }

  if (mentioned === 0 && supportedIdeas === 0) {
    findings.push(
      makeFinding(
        "low",
        "counterargument",
        "Paper is not yet connected",
        "No note or idea references this paper, so its influence on the workspace is unknown.",
        "Link it to a synthesis note or use it to support or challenge an active idea.",
      ),
    );
  } else if (mentioned > 0) {
    strengths.push("The paper is cited from the note library.");
  }

  const duplicate = findSimilarTitle(paper.title, papers, paper.id);
  if (duplicate) {
    findings.push(
      makeFinding(
        "medium",
        "counterargument",
        "Possible duplicate paper",
        `"${duplicate.title}" may be the same or closely related work.`,
        "Compare DOIs and abstracts, then merge duplicates.",
      ),
    );
  }

  const score = Math.max(
    20,
    Math.min(
      98,
      74 +
        (paper.abstract ? 8 : 0) +
        (paper.doi || paper.source_url ? 8 : 0) -
        findings.filter((finding) => finding.severity === "high").length * 10 -
        findings.filter((finding) => finding.severity === "medium").length * 4,
    ),
  );

  return {
    entityTitle: paper.title,
    score,
    summary: buildSummary(score, findings.length),
    findings: findings.slice(0, 6),
    strengths,
  };
}

export function analyzeTarget(
  target: ReviewTarget,
  notes: Note[],
  papers: Paper[],
  ideas: Idea[],
  _topics: TopicWithCounts[],
): AdversarialReview {
  const base =
    target.type === "idea"
      ? analyzeIdea(
          {
            id: target.title,
            user_id: "",
            title: target.title,
            description: target.description,
            stage: (target.stage as Idea["stage"]) ?? "Seed",
            linked_note_ids: target.linkedNoteIds ?? [],
            linked_paper_ids: target.linkedPaperIds ?? [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          notes,
          papers,
          ideas,
        )
      : analyzePaper(
          {
            id: target.title,
            user_id: "",
            title: target.title,
            authors: target.authors ?? [],
            abstract: target.abstract,
            publication_date: target.publicationDate,
            source_url: target.sourceUrl,
            status: (target.status as Paper["status"]) ?? "To Read",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          notes,
          ideas,
          papers,
        );

  return base;
}

export function auditWorkspace(
  notes: Note[],
  papers: Paper[],
  ideas: Idea[],
  topics: TopicWithCounts[],
): WorkspaceAudit {
  const findings: WorkspaceAuditFinding[] = [];
  const severityCounts: Record<AdversarialFinding["severity"], number> = {
    high: 0,
    medium: 0,
    low: 0,
  };
  const categoryCounts: Record<AdversarialCategory, number> = {
    assumption: 0,
    counterargument: 0,
    evidence_gap: 0,
    risk: 0,
  };
  const strengths: string[] = [];

  const seenFindings = new Set<string>();

  papers.forEach((paper) => {
    const review = analyzePaper(paper, notes, ideas, papers);
    review.findings.forEach((finding) => {
      const key = `${paper.id}:${finding.category}:${finding.title}`;
      if (seenFindings.has(key)) return;
      seenFindings.add(key);
      findings.push({
        id: `${paper.id}-${finding.id}`,
        entityType: "paper",
        entityId: paper.id,
        entityTitle: paper.title,
        finding,
      });
      severityCounts[finding.severity]++;
      categoryCounts[finding.category]++;
    });
    review.strengths.forEach((strength) => {
      if (!strengths.includes(`Paper: ${strength}`)) {
        strengths.push(`Paper: ${strength}`);
      }
    });
  });

  ideas.forEach((idea) => {
    const review = analyzeIdea(idea, notes, papers, ideas);
    review.findings.forEach((finding) => {
      const key = `${idea.id}:${finding.category}:${finding.title}`;
      if (seenFindings.has(key)) return;
      seenFindings.add(key);
      findings.push({
        id: `${idea.id}-${finding.id}`,
        entityType: "idea",
        entityId: idea.id,
        entityTitle: idea.title,
        finding,
      });
      severityCounts[finding.severity]++;
      categoryCounts[finding.category]++;
    });
    review.strengths.forEach((strength) => {
      if (!strengths.includes(`Idea: ${strength}`)) {
        strengths.push(`Idea: ${strength}`);
      }
    });
  });

  notes.forEach((note) => {
    const noteText = `${note.title ?? ""} ${note.markdown_body}`.trim();
    const wordCount = noteText.split(/\s+/).filter(Boolean).length;
    const linkedCount = (note.linked_entity_ids ?? []).length;

    if (wordCount < 20) {
      findings.push({
        id: `${note.id}-note-thin`,
        entityType: "note",
        entityId: note.id,
        entityTitle: note.title || "Untitled Note",
        finding: makeFinding(
          "medium",
          "evidence_gap",
          "Thin note content",
          "The note contains very little content, so it does not yet contribute meaningfully to synthesis.",
          "Expand the note with the source, claim, and why it matters.",
        ),
      });
      severityCounts.medium++;
      categoryCounts.evidence_gap++;
    }

    if (linkedCount === 0 && wordCount >= 20) {
      findings.push({
        id: `${note.id}-note-unlinked`,
        entityType: "note",
        entityId: note.id,
        entityTitle: note.title || "Untitled Note",
        finding: makeFinding(
          "low",
          "counterargument",
          "Unlinked note",
          "The note has substance but is not connected to papers or ideas.",
          "Link it to the paper or idea it synthesizes.",
        ),
      });
      severityCounts.low++;
      categoryCounts.counterargument++;
    }
  });

  topics.forEach((topic) => {
    const totalItems = topic.note_count + topic.paper_count + topic.idea_count;
    if (totalItems === 0) {
      findings.push({
        id: `${topic.id}-topic-empty`,
        entityType: "topic",
        entityId: topic.id,
        entityTitle: topic.name,
        finding: makeFinding(
          "low",
          "evidence_gap",
          "Empty topic",
          "The topic has no attached notes, papers, or ideas.",
          "Attach at least one record or remove the topic to reduce clutter.",
        ),
      });
      severityCounts.low++;
      categoryCounts.evidence_gap++;
    } else if (totalItems === 1) {
      findings.push({
        id: `${topic.id}-topic-single`,
        entityType: "topic",
        entityId: topic.id,
        entityTitle: topic.name,
        finding: makeFinding(
          "medium",
          "risk",
          "Single-item topic",
          "A topic with a single record can create false structure and hides thin coverage.",
          "Add supporting records or merge the topic into a related one.",
        ),
      });
      severityCounts.medium++;
      categoryCounts.risk++;
    }
  });

  if (papers.length > 0 && notes.length === 0) {
    strengths.push("The library is populated; add notes to strengthen synthesis.");
  }
  if (papers.some((paper) => paper.status === "Reading" || paper.status === "Read")) {
    strengths.push("Reading progress is being tracked on the library.");
  }
  if (notes.length >= 5) {
    strengths.push("The note library is substantial enough to support synthesis.");
  }
  if (topics.length > 0 && papers.length + ideas.length + notes.length > 0) {
    strengths.push("The workspace is organized into topics.");
  }

  findings.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.finding.severity] - order[b.finding.severity];
  });

  const totalEntities = papers.length + ideas.length + notes.length + topics.length;
  const penalty =
    severityCounts.high * 12 + severityCounts.medium * 5 + severityCounts.low * 2;
  const score = Math.max(
    15,
    Math.min(
      98,
      totalEntities === 0
        ? 55
        : 88 -
            penalty +
            Math.min(10, Math.round(papers.length * 0.4)) +
            Math.min(8, Math.round(notes.length * 0.25)),
    ),
  );

  let summary = "The workspace is in strong shape. Resolve the remaining low-severity notes before making major claims.";
  if (score < 60) {
    summary = "The workspace has material evidence gaps and unaddressed risks. Run focused reviews on the weakest records.";
  } else if (score < 80) {
    summary = "The workspace is generally healthy, but several records need evidence or counterargument work.";
  }

  return {
    score,
    summary,
    entityCounts: {
      papers: papers.length,
      ideas: ideas.length,
      notes: notes.length,
      topics: topics.length,
    },
    severityCounts,
    categoryCounts,
    findings: findings.slice(0, 12),
    strengths: strengths.slice(0, 5),
    generatedAt: new Date().toISOString(),
  };
}

export function auditToMarkdown(audit: WorkspaceAudit): string {
  const lines = [
    "# ResearchQuest Workspace Audit",
    "",
    `Generated: ${new Date(audit.generatedAt).toLocaleString()}`,
    `Health score: ${audit.score}/100`,
    "",
    "## Summary",
    "",
    audit.summary,
    "",
    "## Severity",
    "",
    `- High: ${audit.severityCounts.high}`,
    `- Medium: ${audit.severityCounts.medium}`,
    `- Low: ${audit.severityCounts.low}`,
    "",
    "## Findings",
    "",
  ];
  audit.findings.forEach((item, index) => {
    lines.push(
      `${index + 1}. **[${item.finding.severity.toUpperCase()}] ${item.entityType}: ${item.entityTitle}**`,
      `   - ${item.finding.title}`,
      `   - ${item.finding.detail}`,
      `   - Suggestion: ${item.finding.suggestion}`,
      "",
    );
  });
  if (audit.strengths.length > 0) {
    lines.push("## Strengths", "");
    audit.strengths.forEach((strength) => lines.push(`- ${strength}`));
    lines.push("");
  }
  return lines.join("\n");
}

function buildSummary(score: number, findingCount: number): string {
  if (score >= 85) {
    return "The record is well supported and internally consistent. Address the remaining low-severity notes before relying on it heavily.";
  }
  if (score >= 65) {
    return "The record is usable but has material gaps that should be resolved before strong claims are made.";
  }
  return `${findingCount} adversarial issues need attention before this record can support confident conclusions.`;
}

export function getPaperConfidence(paper: Paper): ConfidenceBadge {
  let score = 46;
  if (paper.abstract && paper.abstract.trim().length >= 60) score += 16;
  if (paper.authors && paper.authors.length > 0) score += 8;
  if (paper.doi || paper.source_url) score += 12;
  if (paper.status === "Reading" || paper.status === "Read") score += 8;
  if (paper.publication_date) {
    const year = Number(paper.publication_date.slice(0, 4));
    if (Number.isFinite(year) && new Date().getFullYear() - year <= 5) score += 6;
  }
  const clamped = Math.max(10, Math.min(100, score));
  if (clamped >= 78) {
    return { score: clamped, label: "Strong", tone: "success" };
  }
  if (clamped >= 55) {
    return { score: clamped, label: "Moderate", tone: "gold" };
  }
  return { score: clamped, label: "Needs work", tone: "coral" };
}

export function getIdeaConfidence(idea: Idea): ConfidenceBadge {
  let score = 40;
  if ((idea.description ?? "").trim().length >= 80) score += 14;
  if ((idea.linked_paper_ids ?? []).length > 0) score += 10;
  if ((idea.linked_note_ids ?? []).length > 0) score += 8;
  if (idea.stage === "Supported" || idea.stage === "Mature") score += 12;
  if (idea.stage === "Mature") score += 6;
  const clamped = Math.max(10, Math.min(100, score));
  if (clamped >= 78) {
    return { score: clamped, label: "Strong", tone: "success" };
  }
  if (clamped >= 55) {
    return { score: clamped, label: "Moderate", tone: "gold" };
  }
  return { score: clamped, label: "Needs work", tone: "coral" };
}

export { categoryLabel };

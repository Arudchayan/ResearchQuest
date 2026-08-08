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

function buildSummary(score: number, findingCount: number): string {
  if (score >= 85) {
    return "The record is well supported and internally consistent. Address the remaining low-severity notes before relying on it heavily.";
  }
  if (score >= 65) {
    return "The record is usable but has material gaps that should be resolved before strong claims are made.";
  }
  return `${findingCount} adversarial issues need attention before this record can support confident conclusions.`;
}

export { categoryLabel };

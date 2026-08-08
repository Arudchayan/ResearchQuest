import { describe, expect, it } from "vitest";
import {
  analyzeIdea,
  analyzePaper,
  categoryLabel,
} from "../../utils/adversarialAnalysis";
import type { Idea, Note, Paper } from "../../types/database";

const now = new Date().toISOString();

function makeIdea(overrides: Partial<Idea> = {}): Idea {
  return {
    id: "idea-test",
    user_id: "user-test",
    title: "Testable idea about research tools",
    description:
      "A concrete proposal with a population, method sketch, and expected outcome for evaluation.",
    stage: "Supported",
    linked_note_ids: [],
    linked_paper_ids: [],
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function makePaper(overrides: Partial<Paper> = {}): Paper {
  return {
    id: "paper-test",
    user_id: "user-test",
    title: "A Well-Sourced Empirical Study",
    authors: ["First Author", "Second Author"],
    doi: "10.1000/test.paper",
    source_url: "https://example.com/paper",
    abstract:
      "A sufficiently detailed abstract describing the method, sample, and headline result of the study.",
    status: "Reading",
    topic_ids: [],
    publication_date: "2024-01-01",
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "note-test",
    user_id: "user-test",
    title: "Synthesis note",
    markdown_body: "# Synthesis",
    tags: [],
    linked_entity_ids: [],
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

describe("adversarialAnalysis", () => {
  it("flags absolute claims in idea titles", () => {
    const review = analyzeIdea(
      makeIdea({ title: "This approach always works for every researcher" }),
      [],
      [],
      [],
    );
    expect(
      review.findings.some((finding) => finding.category === "assumption"),
    ).toBe(true);
    expect(review.score).toBeLessThan(70);
  });

  it("flags ideas with no linked evidence", () => {
    const review = analyzeIdea(makeIdea(), [], [], []);
    expect(
      review.findings.some((finding) => finding.category === "evidence_gap"),
    ).toBe(true);
  });

  it("rewards ideas with linked evidence", () => {
    const review = analyzeIdea(
      makeIdea({
        linked_note_ids: ["note-a", "note-b"],
        linked_paper_ids: ["paper-a"],
      }),
      [
        makeNote({ id: "note-a" }),
        makeNote({ id: "note-b" }),
      ],
      [makePaper({ id: "paper-a" })],
      [],
    );
    expect(review.score).toBeGreaterThanOrEqual(70);
    expect(review.strengths.length).toBeGreaterThan(0);
  });

  it("detects likely duplicate ideas", () => {
    const review = analyzeIdea(
      makeIdea({ id: "idea-a", title: "Research tools for scholars" }),
      [],
      [],
      [makeIdea({ id: "idea-b", title: "Research tools for academics" })],
    );
    expect(
      review.findings.some((finding) => finding.title.includes("duplicate")),
    ).toBe(true);
  });

  it("flags papers without abstract or source", () => {
    const review = analyzePaper(
      makePaper({ abstract: "", doi: undefined, source_url: undefined }),
      [],
      [],
      [],
    );
    expect(review.findings.length).toBeGreaterThanOrEqual(2);
    expect(review.score).toBeLessThan(60);
  });

  it("scores well-supported papers highly", () => {
    const review = analyzePaper(makePaper(), [makeNote({ linked_entity_ids: ["paper-test"] })], [], []);
    expect(review.score).toBeGreaterThanOrEqual(75);
    expect(review.strengths.length).toBeGreaterThan(0);
  });

  it("provides readable category labels", () => {
    expect(categoryLabel("assumption")).toBe("Assumption");
    expect(categoryLabel("counterargument")).toBe("Counterargument");
    expect(categoryLabel("evidence_gap")).toBe("Evidence gap");
    expect(categoryLabel("risk")).toBe("Risk");
  });
});

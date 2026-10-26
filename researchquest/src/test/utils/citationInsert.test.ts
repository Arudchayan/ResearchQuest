import { describe, expect, it } from "vitest";
import { citationInsertText } from "../../utils/citationInsert";

const CITE = "(Henrich et al., 2010)";

/** Apply the insert helper the same way the editor dispatch does. */
function apply(
  doc: string,
  from: number,
  citation: string,
  to = from,
): string {
  const insert = citationInsertText(doc, from, citation);
  return `${doc.slice(0, from)}${insert}${doc.slice(to)}`;
}

describe("citationInsertText", () => {
  it("puts the citation on its own line before a heading at the start of the note", () => {
    const doc =
      "## Wins\n- Completed the RAG reading task.\n- Added insights to two papers.";

    const next = apply(doc, 0, CITE);

    expect(next.startsWith(`${CITE}\n## Wins`)).toBe(true);
    expect(next).toContain("\n## Wins\n");
    expect(next).not.toContain(`${CITE}## Wins`);
  });

  it("puts the citation on its own line before a list item", () => {
    const doc = "## Wins\n- Completed the RAG reading task.";
    const listStart = doc.indexOf("-");

    const next = apply(doc, listStart, CITE);

    expect(next).toBe(`## Wins\n${CITE}\n- Completed the RAG reading task.`);
  });

  it("leaves a mid-line insert unchanged", () => {
    const doc = "See the WEIRD sample for details.";
    const from = doc.indexOf("WEIRD");

    expect(apply(doc, from, CITE)).toBe(
      `See the ${CITE}WEIRD sample for details.`,
    );
  });

  it("inserts into an empty note without adding a blank line", () => {
    expect(apply("", 0, CITE)).toBe(CITE);
  });

  it("puts the citation on its own line before a blockquote", () => {
    const doc = '> "The goal is to make the invisible work of research visible."';
    expect(apply(doc, 0, CITE)).toBe(`${CITE}\n${doc}`);
  });

  it("puts the citation on its own line before a fence", () => {
    const doc = "```ts\nconst n = 1;\n```";
    expect(apply(doc, 0, CITE)).toBe(`${CITE}\n${doc}`);
  });
});

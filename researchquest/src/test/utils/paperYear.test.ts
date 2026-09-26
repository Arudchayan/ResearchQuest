import { describe, it, expect } from "vitest";
import {
  buildPaperPayload,
  buildPaperPayloadFromBibTeX,
} from "../../utils/paperUtils";
import type { CrossrefPaper } from "../../types/database";
import type { BibTeXEntry } from "../../utils/bibtexParser";

const baseCrossref: CrossrefPaper = {
  doi: "10.1234/abc",
  title: "T",
  authors: ["John Doe"],
  abstract: "abs",
  publicationDate: null,
  sourceUrl: "https://example.com",
  containerTitle: "",
  publisher: "",
  type: "",
};

describe("buildPaperPayload year mirror", () => {
  it("mirrors a clean 4-digit year to Jan 1", () => {
    const out = buildPaperPayload({ ...baseCrossref, publicationDate: 2023 });
    expect(out.publication_date).toBe("2023-01-01");
  });

  it("omits non-4-digit years instead of passing them through", () => {
    for (const bad of [99, 20235, 0]) {
      const out = buildPaperPayload({
        ...baseCrossref,
        publicationDate: bad,
      });
      expect(out.publication_date).toBeUndefined();
    }
    const out = buildPaperPayload({
      ...baseCrossref,
      publicationDate: "Winter 1999" as unknown as number,
    });
    expect(out.publication_date).toBeUndefined();
  });

  it("leaves publication_date unset when null", () => {
    const out = buildPaperPayload({ ...baseCrossref, publicationDate: null });
    expect(out.publication_date).toBeUndefined();
  });
});

describe("buildPaperPayloadFromBibTeX year mirror", () => {
  const entry = (year?: string): BibTeXEntry => ({
    id: "k",
    type: "article",
    ...(year === undefined ? {} : { year }),
  });

  it("mirrors a clean 4-digit year to Jan 1", () => {
    expect(buildPaperPayloadFromBibTeX(entry("2023")).publication_date).toBe(
      "2023-01-01",
    );
  });

  it("omits non-4-digit years instead of passing them through", () => {
    for (const bad of ["Winter 1999", "n.d.", "23", "2023-05-01", ""]) {
      expect(
        buildPaperPayloadFromBibTeX(entry(bad)).publication_date,
      ).toBeUndefined();
    }
    expect(
      buildPaperPayloadFromBibTeX(entry(undefined)).publication_date,
    ).toBeUndefined();
  });
});

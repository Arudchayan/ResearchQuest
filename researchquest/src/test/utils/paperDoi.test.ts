import { describe, expect, it } from "vitest";
import { doisMatch, findLibraryPaperByDoi, normalizeDoi } from "../../utils/paperUtils";

describe("normalizeDoi spelling variants", () => {
  it.each([
    ["10.1234/ABC", "10.1234/abc"],
    ["  10.1234/abc  ", "10.1234/abc"],
    ["https://doi.org/10.1234/abc", "10.1234/abc"],
    ["http://dx.doi.org/10.1234/abc", "10.1234/abc"],
    ["doi:10.1234/abc", "10.1234/abc"],
    ["DOI: 10.1234/ABC", "10.1234/abc"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeDoi(input)).toBe(expected);
  });

  it("matches resolver/uppercase variants of the same DOI", () => {
    expect(doisMatch("https://doi.org/10.1234/ABC", "doi:10.1234/abc")).toBe(
      true,
    );
    expect(doisMatch("10.1234/abc", "10.9999/other")).toBe(false);
    expect(doisMatch("", "")).toBe(false);
  });
});

describe("findLibraryPaperByDoi", () => {
  const papers = [
    { id: "paper-0007", doi: "10.48550/arXiv.2210.03629" },
    { id: "other", doi: "10.1234/other" },
    { id: "no-doi" },
  ];

  it.each([
    "10.48550/arXiv.2210.03629",
    "10.48550/ARXIV.2210.03629",
    "https://doi.org/10.48550/arxiv.2210.03629",
    "doi:10.48550/arXiv.2210.03629",
  ])("finds the library paper when the DOI is spelled as %s", (doi) => {
    expect(findLibraryPaperByDoi(papers, doi)?.id).toBe("paper-0007");
  });

  it("returns undefined for a DOI that is not in the library", () => {
    expect(findLibraryPaperByDoi(papers, "10.9999/new")).toBeUndefined();
  });

  it("returns undefined for empty or missing DOI input", () => {
    expect(findLibraryPaperByDoi(papers, "")).toBeUndefined();
    expect(findLibraryPaperByDoi(papers, "   ")).toBeUndefined();
    expect(findLibraryPaperByDoi(papers, undefined)).toBeUndefined();
  });
});

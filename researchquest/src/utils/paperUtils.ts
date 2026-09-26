import type { CrossrefPaper, PaperDraft } from "../types/database";
import { isValidUrl } from "../utils/security";
import type { BibTeXEntry } from "../utils/bibtexParser";

/** Lowercase, strip resolver prefixes and a leading `doi:` so spelling variants match. */
export function normalizeDoi(doi: string): string {
  let value = doi.trim().toLowerCase();
  value = value.replace(/^https?:\/\/(dx\.)?doi\.org\//, "");
  value = value.replace(/^doi:\s*/, "");
  return value;
}

export function doisMatch(left: string, right: string): boolean {
  const a = normalizeDoi(left);
  const b = normalizeDoi(right);
  return a.length > 0 && a === b;
}

export const buildPaperPayload = (paper: CrossrefPaper) => {
  const paperData: PaperDraft = {
    title: paper.title,
    authors: Array.isArray(paper.authors) ? paper.authors : [],
  };

  if (paper.doi && paper.doi.trim()) paperData.doi = paper.doi.trim();
  if (paper.sourceUrl && paper.sourceUrl.trim() && isValidUrl(paper.sourceUrl))
    paperData.source_url = paper.sourceUrl.trim();
  if (paper.abstract && paper.abstract.trim())
    paperData.abstract = paper.abstract.trim();
  if (paper.publicationDate) {
    const year = paper.publicationDate.toString();
    // Only mirror clean 4-digit years; omit anything else.
    if (/^\d{4}$/.test(year)) paperData.publication_date = `${year}-01-01`;
  }

  return paperData;
};

export const buildPaperPayloadFromBibTeX = (entry: BibTeXEntry) => {
  const paperData: PaperDraft = {
    title: entry.title || "Untitled",
    authors: entry.authors || [],
  };

  if (entry.doi && entry.doi.trim()) paperData.doi = entry.doi.trim();
  if (entry.url && entry.url.trim()) {
    const url = entry.url.trim();
    if (isValidUrl(url)) {
      paperData.source_url = url;
    }
  }
  if (entry.abstract && entry.abstract.trim())
    paperData.abstract = entry.abstract.trim();
  if (entry.year) {
    const year = entry.year.toString();
    // Only mirror clean 4-digit years; omit anything else.
    if (/^\d{4}$/.test(year)) paperData.publication_date = `${year}-01-01`;
  }

  return paperData;
};

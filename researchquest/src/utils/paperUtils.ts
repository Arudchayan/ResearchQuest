import type { CrossrefPaper } from "../types/database";
import { isValidUrl } from "../utils/security";
import type { BibTeXEntry } from "../utils/bibtexParser";

export const buildPaperPayload = (paper: CrossrefPaper) => {
  const paperData: any = {
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
    paperData.publication_date = /^\d{4}$/.test(year)
      ? `${year}-01-01`
      : year;
  }

  return paperData;
};

export const buildPaperPayloadFromBibTeX = (entry: BibTeXEntry) => {
  const paperData: any = {
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
    paperData.publication_date = /^\d{4}$/.test(year)
      ? `${year}-01-01`
      : year;
  }

  return paperData;
};

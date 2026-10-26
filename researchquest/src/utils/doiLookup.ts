import type { CrossrefPaper } from "../types/database";
import { doisMatch, normalizeDoi } from "./paperUtils";

const CROSSREF_WORKS_BASE = "https://api.crossref.org/works";

interface CrossrefAuthor {
  given?: string;
  family?: string;
}

interface CrossrefDateParts {
  "date-parts"?: number[][];
}

interface CrossrefWork {
  DOI?: string;
  title?: string[] | string;
  author?: CrossrefAuthor[];
  abstract?: string;
  published?: CrossrefDateParts;
  issued?: CrossrefDateParts;
  URL?: string;
  "container-title"?: string[] | string;
  publisher?: string;
  type?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function firstString(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
}

function yearFromDateParts(value: unknown): number | null {
  if (!isRecord(value) || !Array.isArray(value["date-parts"])) return null;
  const year = value["date-parts"][0]?.[0];
  return typeof year === "number" && Number.isFinite(year) ? year : null;
}

export function buildCrossrefWorkUrl(doi: string): string {
  return `${CROSSREF_WORKS_BASE}/${encodeURIComponent(normalizeDoi(doi))}`;
}

export function formatCrossrefWork(
  work: CrossrefWork | null | undefined,
): CrossrefPaper | null {
  if (!work) return null;
  const doi = typeof work.DOI === "string" ? work.DOI : "";
  const title = firstString(work.title);
  if (!doi && !title) return null;
  return {
    doi,
    title: title || "Untitled",
    authors:
      work.author?.map((author) =>
        `${author.given || ""} ${author.family || ""}`.trim(),
      ).filter(Boolean) || [],
    abstract: typeof work.abstract === "string" ? work.abstract : "",
    publicationDate:
      yearFromDateParts(work.published) ?? yearFromDateParts(work.issued),
    sourceUrl: work.URL || (doi ? `https://doi.org/${doi}` : ""),
    containerTitle: firstString(work["container-title"]),
    publisher: work.publisher || "",
    type: work.type || "article",
  };
}

function extractCrossrefWork(payload: unknown): CrossrefWork | null {
  if (!isRecord(payload)) return null;
  if (isRecord(payload.message)) {
    return payload.message as CrossrefWork;
  }
  if (typeof payload.DOI === "string" || payload.title != null) {
    return payload as CrossrefWork;
  }
  return null;
}

export async function lookupDoiFromCrossref(
  doi: string,
  fetchFn: typeof fetch = fetch,
): Promise<CrossrefPaper | null> {
  const requestedDoi = normalizeDoi(doi);
  if (!requestedDoi) return null;

  const response = await fetchFn(buildCrossrefWorkUrl(requestedDoi), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return null;

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return null;
  }

  const paper = formatCrossrefWork(extractCrossrefWork(payload));
  if (!paper) return null;
  if (paper.doi && !doisMatch(paper.doi, requestedDoi)) return null;
  return paper;
}

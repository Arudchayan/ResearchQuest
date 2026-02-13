import { Paper } from '../types/database';

/**
 * Extracts the year from a date string or year string.
 */
export function extractYear(dateString?: string): string {
  if (!dateString) return 'n.d.';
  const dateYear = new Date(dateString).getFullYear();
  if (!isNaN(dateYear)) {
    return dateYear.toString();
  }
  // Try to extract year from string if date parsing fails or it's just a year string
  const match = dateString.match(/\d{4}/);
  return match ? match[0] : 'n.d.';
}

/**
 * Parses an author name string into parts.
 * Very basic implementation: assumes "First Middle Last" format.
 */
function parseAuthor(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return { last: '', first: '', middle: '' };
  if (parts.length === 1) return { last: parts[0], first: '', middle: '' };

  const last = parts[parts.length - 1];
  const first = parts[0];
  const middle = parts.slice(1, parts.length - 1).join(' ');
  return { last, first, middle };
}

/**
 * Formats authors for APA style.
 * Format: Last, F. M.
 */
function formatAuthorsAPA(authors: string[]): string {
  if (!authors || authors.length === 0) return 'Anonymous';

  const formatted = authors.map(author => {
    const { last, first, middle } = parseAuthor(author);
    const firstInitial = first && first.length > 0 ? `${first[0]}.` : '';
    const middleInitial = middle && middle.length > 0 ? ` ${middle[0]}.` : '';
    const initials = `${firstInitial}${middleInitial}`;
    return initials ? `${last}, ${initials}` : last;
  });

  if (formatted.length === 1) return formatted[0];
  if (formatted.length === 2) return `${formatted[0]} & ${formatted[1]}`;
  if (formatted.length <= 20) {
    return `${formatted.slice(0, -1).join(', ')}, & ${formatted[formatted.length - 1]}`;
  }
  // For > 20 authors (APA 7th), list first 19, ..., last author
  return `${formatted.slice(0, 19).join(', ')} ... ${formatted[formatted.length - 1]}`;
}

/**
 * Formats authors for MLA style.
 * Format: Last, First M.
 * 1 author: Last, First.
 * 2 authors: Last, First, and First Last.
 * 3+ authors: Last, First, et al.
 */
function formatAuthorsMLA(authors: string[]): string {
  if (!authors || authors.length === 0) return 'Anonymous';

  const firstAuthor = parseAuthor(authors[0]);
  const firstRest = [firstAuthor.first, firstAuthor.middle].filter(Boolean).join(' ');
  const firstFormatted = firstRest ? `${firstAuthor.last}, ${firstRest}` : firstAuthor.last;

  if (authors.length === 1) return firstFormatted;

  if (authors.length === 2) {
    return `${firstFormatted}, and ${authors[1]}`;
  }

  return `${firstFormatted}, et al.`;
}

/**
 * Formats authors for Chicago style.
 * Format: Last, First M.
 * 1 author: Last, First.
 * 2-3 authors: Last, First, and First Last.
 * 4+ authors: Last, First, et al.
 */
function formatAuthorsChicago(authors: string[]): string {
  if (!authors || authors.length === 0) return 'Anonymous';

  const firstAuthor = parseAuthor(authors[0]);
  const firstRest = [firstAuthor.first, firstAuthor.middle].filter(Boolean).join(' ');
  const firstFormatted = firstRest ? `${firstAuthor.last}, ${firstRest}` : firstAuthor.last;

  if (authors.length === 1) return firstFormatted;

  if (authors.length <= 3) {
    const others = authors.slice(1).join(', and ');
    return `${firstFormatted}, and ${others}`;
  }

  return `${firstFormatted}, et al.`;
}

/**
 * Formats authors for Harvard style.
 * Format: Last, F.M.
 */
function formatAuthorsHarvard(authors: string[]): string {
  if (!authors || authors.length === 0) return 'Anonymous';

  const formatted = authors.map(author => {
    const { last, first, middle } = parseAuthor(author);
    const firstInitial = first && first.length > 0 ? first[0] : '';
    const middleInitial = middle && middle.length > 0 ? middle[0] : '';
    const initials = `${firstInitial}${middleInitial}`;
    return initials ? `${last}, ${initials}` : last;
  });

  if (formatted.length === 1) return formatted[0];
  if (formatted.length === 2) return `${formatted[0]} and ${formatted[1]}`;

  // Harvard style typically lists all up to a certain number, then et al.
  // Using simplified rule: > 3 => et al.
  if (formatted.length > 3) {
    return `${formatted[0]} et al.`;
  }

  return formatted.slice(0, -1).join(', ') + ` and ${formatted[formatted.length - 1]}`;
}

/**
 * Generates a BibTeX citation string for a given paper.
 * @param paper The paper object
 * @returns The BibTeX string
 */
export function generateBibTeX(paper: Paper): string {
  const { title, authors, publication_date, doi, source_url, abstract } = paper;

  let firstAuthorLastName = 'Anonymous';
  if (authors && authors.length > 0) {
    const { last } = parseAuthor(authors[0]);
    firstAuthorLastName = last.replace(/[^a-zA-Z]/g, '');
  }

  let year = 'nd';
  const y = extractYear(publication_date);
  if (y !== 'n.d.') year = y;

  let titleWord = 'Untitled';
  if (title) {
    const words = title.trim().split(/\s+/);
    if (words.length > 0) {
      titleWord = words[0].replace(/[^a-zA-Z]/g, '');
    }
  }

  const citationKey = `${firstAuthorLastName}${year}${titleWord}`;

  const fields: string[] = [];

  if (title) fields.push(`  title = {${title}}`);
  if (authors && authors.length > 0) {
    const bibAuthors = authors.join(' and ');
    fields.push(`  author = {${bibAuthors}}`);
  }
  if (year !== 'nd') fields.push(`  year = {${year}}`);
  if (doi) fields.push(`  doi = {${doi}}`);
  if (source_url) fields.push(`  url = {${source_url}}`);
  if (abstract) {
     const cleanAbstract = abstract.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
     fields.push(`  abstract = {${cleanAbstract}}`);
  }

  return `@article{${citationKey},
${fields.join(',\n')}
}`;
}

/**
 * Generates an APA 7th edition citation.
 */
export function generateAPA(paper: Paper): string {
  const authorText = formatAuthorsAPA(paper.authors);
  const year = extractYear(paper.publication_date);
  const title = paper.title || 'Untitled';

  let citation = `${authorText} (${year}). ${title}.`;

  if (paper.doi) {
    citation += ` https://doi.org/${paper.doi}`;
  } else if (paper.source_url) {
    citation += ` ${paper.source_url}`;
  }

  return citation;
}

/**
 * Generates an MLA 9th edition citation.
 */
export function generateMLA(paper: Paper): string {
  const authorText = formatAuthorsMLA(paper.authors);
  const title = paper.title ? `"${paper.title}."` : '"Untitled."';
  const year = extractYear(paper.publication_date);

  let citation = `${authorText} ${title}`;

  if (year !== 'n.d.') {
    citation += ` ${year}.`;
  }

  if (paper.doi) {
    citation += ` doi:${paper.doi}.`;
  } else if (paper.source_url) {
    citation += ` ${paper.source_url}.`;
  }

  return citation.trim();
}

/**
 * Generates a Chicago 17th edition (Notes and Bibliography) citation.
 */
export function generateChicago(paper: Paper): string {
  const authorText = formatAuthorsChicago(paper.authors);
  const title = paper.title ? `"${paper.title}."` : '"Untitled."';
  const year = extractYear(paper.publication_date);

  let citation = `${authorText} ${title}`;

  if (year !== 'n.d.') {
    citation += ` (${year}).`;
  }

  if (paper.doi) {
    citation += ` https://doi.org/${paper.doi}.`;
  } else if (paper.source_url) {
    citation += ` ${paper.source_url}.`;
  }

  return citation;
}

/**
 * Generates a Harvard style citation.
 */
export function generateHarvard(paper: Paper): string {
  const authorText = formatAuthorsHarvard(paper.authors);
  const year = extractYear(paper.publication_date);
  const title = paper.title ? `'${paper.title}'` : `'Untitled'`;

  let citation = `${authorText} (${year}) ${title}.`;

  if (paper.doi) {
    citation += ` doi: ${paper.doi}`;
  } else if (paper.source_url) {
    citation += ` Available at: ${paper.source_url}`;
  }

  return citation;
}

import { Paper } from '../types/database';

/**
 * Generates a BibTeX citation string for a given paper.
 * @param paper The paper object
 * @returns The BibTeX string
 */
export function generateBibTeX(paper: Paper): string {
  const { title, authors, publication_date, doi, source_url, abstract } = paper;

  // Generate citation key
  // Format: FirstAuthorLastnameYearTitleFirstWord
  // Example: Smith2023Quantum

  let firstAuthorLastName = 'Anonymous';
  if (authors && authors.length > 0) {
    const parts = authors[0].trim().split(' ');
    const lastName = parts[parts.length - 1];
    firstAuthorLastName = lastName.replace(/[^a-zA-Z]/g, '');
  }

  let year = 'nd';
  if (publication_date) {
    const dateYear = new Date(publication_date).getFullYear();
    if (!isNaN(dateYear)) {
      year = dateYear.toString();
    } else {
        // Try to extract year from string if date parsing fails or it's just a year string
        const match = publication_date.match(/\d{4}/);
        if (match) year = match[0];
    }
  }

  let titleWord = 'Untitled';
  if (title) {
    const words = title.trim().split(/\s+/);
    if (words.length > 0) {
      titleWord = words[0].replace(/[^a-zA-Z]/g, '');
    }
  }

  const citationKey = `${firstAuthorLastName}${year}${titleWord}`;

  // Build BibTeX fields
  const fields: string[] = [];

  if (title) {
    fields.push(`  title = {${title}}`);
  }

  if (authors && authors.length > 0) {
    // BibTeX expects "Author1 and Author2 and ..."
    const bibAuthors = authors.join(' and ');
    fields.push(`  author = {${bibAuthors}}`);
  }

  if (year !== 'nd') {
    fields.push(`  year = {${year}}`);
  }

  if (doi) {
    fields.push(`  doi = {${doi}}`);
  }

  if (source_url) {
    fields.push(`  url = {${source_url}}`);
  }

  if (abstract) {
     // Escape braces if needed, but for now just single line it
     const cleanAbstract = abstract.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
     fields.push(`  abstract = {${cleanAbstract}}`);
  }

  // Use @article as a generic type, or @misc if very little info
  // Most research papers are articles or inproceedings. @article is safest default.
  return `@article{${citationKey},
${fields.join(',\n')}
}`;
}

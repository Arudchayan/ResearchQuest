import { UserProfile, Note, Paper, Idea, Topic } from '../types/database';
import { generateBibTeX } from './citation';

export interface ExportData {
  metadata: {
    version: string;
    timestamp: string;
    appName: string;
  };
  user: UserProfile | null;
  notes: Note[];
  papers: Paper[];
  ideas: Idea[];
  topics?: Topic[];
}

/**
 * Helper to download a file
 */
export function downloadFile(content: string, filename: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports the provided data as a JSON file download.
 * @param data The data to export (user, notes, papers, ideas, topics)
 */
export function exportData(data: Omit<ExportData, 'metadata'>) {
  const exportPayload: ExportData = {
    metadata: {
      version: '1.0',
      timestamp: new Date().toISOString(),
      appName: 'ResearchQuest',
    },
    ...data,
  };

  const jsonString = JSON.stringify(exportPayload, null, 2);
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `researchquest_backup_${dateStr}.json`;

  downloadFile(jsonString, filename, 'application/json');
}

export function convertPapersToBibTeX(papers: Paper[]): string {
  return papers.map(generateBibTeX).join('\n\n');
}

export function convertPapersToJSON(papers: Paper[]): string {
  return JSON.stringify(papers, null, 2);
}

export function convertPapersToCSV(papers: Paper[]): string {
  if (papers.length === 0) return '';
  const headers = ['Title', 'Authors', 'Publication Year', 'DOI', 'Source URL', 'Abstract', 'Created At'];

  const rows = papers.map(p => {
    let year = '';
    if (p.publication_date) {
        const match = p.publication_date.match(/\d{4}/);
        if (match) year = match[0];
    }

    return [
      escapeCSV(p.title),
      escapeCSV(p.authors?.join('; ')),
      escapeCSV(year),
      escapeCSV(p.doi),
      escapeCSV(p.source_url),
      escapeCSV(p.abstract),
      escapeCSV(p.created_at)
    ];
  });

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

function escapeCSV(str?: string | null): string {
  if (!str) return '';
  // if string contains comma, newline, or double quote, wrap in double quotes
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    // escape double quotes by doubling them
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

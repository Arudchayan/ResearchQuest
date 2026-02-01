import { UserProfile, Note, Paper, Idea, Topic } from '../types/database';

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
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `researchquest_backup_${dateStr}.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

import { UserProfile, Note, Paper, Idea, Topic } from "../types/database";
import { generateBibTeX } from "./citation";

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
export function downloadFile(
  content: string,
  filename: string,
  contentType: string,
) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
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
export function exportData(data: Omit<ExportData, "metadata">) {
  const exportPayload: ExportData = {
    metadata: {
      version: "1.0",
      timestamp: new Date().toISOString(),
      appName: "ResearchQuest",
    },
    ...data,
  };

  const jsonString = JSON.stringify(exportPayload, null, 2);
  const dateStr = new Date().toISOString().split("T")[0];
  const filename = `researchquest_backup_${dateStr}.json`;

  downloadFile(jsonString, filename, "application/json");
}

export function convertPapersToBibTeX(papers: Paper[]): string {
  return papers.map(generateBibTeX).join("\n\n");
}

export function convertPapersToJSON(papers: Paper[]): string {
  return JSON.stringify(papers, null, 2);
}

export function convertPapersToCSV(papers: Paper[]): string {
  if (papers.length === 0) return "";
  const headers = [
    "Title",
    "Authors",
    "Publication Year",
    "DOI",
    "Source URL",
    "Abstract",
    "Created At",
  ];

  const rows = papers.map((p) => {
    let year = "";
    if (p.publication_date) {
      const match = p.publication_date.match(/\d{4}/);
      if (match) year = match[0];
    }

    return [
      escapeCSV(p.title),
      escapeCSV(p.authors?.join("; ")),
      escapeCSV(year),
      escapeCSV(p.doi),
      escapeCSV(p.source_url),
      escapeCSV(p.abstract),
      escapeCSV(p.created_at),
    ];
  });

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

export function convertNotesToJSON(notes: Note[]): string {
  return JSON.stringify(notes, null, 2);
}

export function convertNotesToCSV(notes: Note[]): string {
  if (notes.length === 0) return "";
  const headers = [
    "Title",
    "Markdown Body",
    "Tags",
    "Created At",
    "Updated At",
  ];

  const rows = notes.map((n) => {
    return [
      escapeCSV(n.title),
      escapeCSV(n.markdown_body),
      escapeCSV(n.tags.join("; ")),
      escapeCSV(n.created_at),
      escapeCSV(n.updated_at),
    ];
  });

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

export function convertNotesToMarkdown(notes: Note[]): string {
  if (notes.length === 0) return "";
  return notes
    .map((n) => {
      const title = n.title || "Untitled Note";
      const date = new Date(n.created_at).toLocaleDateString();
      const tags = n.tags.length > 0 ? `\nTags: ${n.tags.join(", ")}` : "";

      return `# ${title}\n*Created: ${date}*${tags}\n\n${n.markdown_body}`;
    })
    .join("\n\n---\n\n");
}

function escapeCSV(str?: string | null): string {
  if (!str) return "";

  let result = str;

  // Prevent CSV Injection (Formula Injection) and DDE Injection
  // If the field starts with =, +, -, @, Tab (0x09), or CR (0x0D), it could be executed as a formula or command in Excel.
  // Prepending a single quote forces it to be treated as text.
  // 🛡️ Sentinel: Check for injection characters, including those preceded by whitespace.
  if (/^\s*[=+\-@\t\r]/.test(result)) {
    result = "'" + result;
  }

  // if string contains comma, newline, or double quote, wrap in double quotes
  if (result.includes(",") || result.includes("\n") || result.includes('"')) {
    // escape double quotes by doubling them
    return `"${result.replace(/"/g, '""')}"`;
  }
  return result;
}

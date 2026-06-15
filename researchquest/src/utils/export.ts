import type { UserProfile, Note, Paper, Idea, Topic, Task } from "../types/database";
import { generateBibTeX } from "./citation";
import { supabase } from "../lib/supabase";
import { logger } from "./logger";
import { deriveTitleFromMarkdown } from "./text";

/** Rows from `topic_notes` (export/import backup). */
export interface TopicNoteLink {
  id: string;
  user_id: string;
  topic_id: string;
  note_id: string;
  created_at?: string;
  updated_at?: string;
}

/** Rows from `topic_papers` (export/import backup). */
export interface TopicPaperLink {
  id: string;
  user_id: string;
  topic_id: string;
  paper_id: string;
  created_at?: string;
  updated_at?: string;
}

/** Rows from `topic_ideas` (export/import backup). */
export interface TopicIdeaLink {
  id: string;
  user_id: string;
  topic_id: string;
  idea_id: string;
  created_at?: string;
  updated_at?: string;
}

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
  topics: Topic[];
  tasks: Task[];
  topicNotes: TopicNoteLink[];
  topicPapers: TopicPaperLink[];
  topicIdeas: TopicIdeaLink[];
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

export type ExportDataInput = Omit<
  ExportData,
  "metadata" | "topicNotes" | "topicPapers" | "topicIdeas"
>;

/**
 * Builds a full backup JSON and triggers download, including topic junction rows.
 */
export async function exportData(input: ExportDataInput & { userId: string }) {
  const { userId, ...entityPayload } = input;

  const [topicNotesRes, topicPapersRes, topicIdeasRes] = await Promise.all([
    supabase.from("topic_notes").select("*").eq("user_id", userId),
    supabase.from("topic_papers").select("*").eq("user_id", userId),
    supabase.from("topic_ideas").select("*").eq("user_id", userId),
  ]);

  if (topicNotesRes.error) {
    logger.error("[RQ] topic_notes export fetch failed", topicNotesRes.error);
  }
  if (topicPapersRes.error) {
    logger.error("[RQ] topic_papers export fetch failed", topicPapersRes.error);
  }
  if (topicIdeasRes.error) {
    logger.error("[RQ] topic_ideas export fetch failed", topicIdeasRes.error);
  }

  const exportPayload: ExportData = {
    metadata: {
      version: "1.0",
      timestamp: new Date().toISOString(),
      appName: "ResearchQuest",
    },
    ...entityPayload,
    topicNotes: (topicNotesRes.data ?? []) as TopicNoteLink[],
    topicPapers: (topicPapersRes.data ?? []) as TopicPaperLink[],
    topicIdeas: (topicIdeasRes.data ?? []) as TopicIdeaLink[],
  };

  const jsonString = JSON.stringify(exportPayload, null, 2);
  const dateStr = new Date().toISOString().split("T")[0];
  const filename = `researchquest_backup_${dateStr}.json`;

  downloadFile(jsonString, filename, "application/json");
}

export function convertPapersToMarkdown(papers: Paper[]): string {
  if (papers.length === 0) return "";
  return papers
    .map((p) => {
      const title = p.title || "Untitled Paper";
      const date = new Date(p.created_at).toLocaleDateString();
      const status = p.status ? `\nStatus: ${p.status}` : "";
      const authors = p.authors?.length ? `\nAuthors: ${p.authors.join(", ")}` : "";
      const publicationDate = p.publication_date ? `\nPublication Date: ${p.publication_date}` : "";
      const doi = p.doi ? `\nDOI: ${p.doi}` : "";
      const sourceUrl = p.source_url ? `\nSource URL: ${p.source_url}` : "";

      return `# ${title}\n*Added: ${date}*${status}${authors}${publicationDate}${doi}${sourceUrl}\n\n${p.abstract || "No abstract provided."}`;
    })
    .join("\n\n---\n\n");
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
      const title = n.title || deriveTitleFromMarkdown(n.markdown_body) || "Untitled Note";
      const date = new Date(n.created_at).toLocaleDateString();
      const tags = n.tags.length > 0 ? `\nTags: ${n.tags.join(", ")}` : "";

      return `# ${title}\n*Created: ${date}*${tags}\n\n${n.markdown_body}`;
    })
    .join("\n\n---\n\n");
}

export function convertIdeasToJSON(ideas: Idea[]): string {
  return JSON.stringify(ideas, null, 2);
}

export function convertIdeasToCSV(ideas: Idea[]): string {
  if (ideas.length === 0) return "";
  const headers = [
    "Title",
    "Description",
    "Stage",
    "Created At",
    "Updated At",
  ];

  const rows = ideas.map((i) => {
    return [
      escapeCSV(i.title),
      escapeCSV(i.description),
      escapeCSV(i.stage),
      escapeCSV(i.created_at),
      escapeCSV(i.updated_at),
    ];
  });

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

export function convertIdeasToMarkdown(ideas: Idea[]): string {
  if (ideas.length === 0) return "";
  return ideas
    .map((i) => {
      const title = i.title || "Untitled Idea";
      const date = new Date(i.created_at).toLocaleDateString();
      const stage = i.stage ? `\nStage: ${i.stage}` : "";

      return `# ${title}\n*Created: ${date}*${stage}\n\n${i.description || "No description provided."}`;
    })
    .join("\n\n---\n\n");
}

export function convertTasksToJSON(tasks: Task[]): string {
  return JSON.stringify(tasks, null, 2);
}

export function convertTasksToCSV(tasks: Task[]): string {
  if (tasks.length === 0) return "";
  const headers = [
    "Title",
    "Description",
    "Status",
    "Priority",
    "Category",
    "Due Date",
    "Created At",
  ];

  const rows = tasks.map((t) => {
    return [
      escapeCSV(t.title),
      escapeCSV(t.description),
      escapeCSV(t.completed ? "Completed" : "Pending"),
      escapeCSV(t.priority),
      escapeCSV(t.category),
      escapeCSV(t.due_date),
      escapeCSV(t.created_at),
    ];
  });

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

export function convertTasksToMarkdown(tasks: Task[]): string {
  if (tasks.length === 0) return "";
  return tasks
    .map((t) => {
      const title = t.title || "Untitled Task";
      const date = new Date(t.created_at).toLocaleDateString();
      const status = t.completed ? "Completed" : "Pending";
      const priority = t.priority ? `\nPriority: ${t.priority}` : "";
      const category = t.category ? `\nCategory: ${t.category}` : "";
      const dueDate = t.due_date ? `\nDue Date: ${new Date(t.due_date).toLocaleDateString()}` : "";

      return `## ${status === "Completed" ? "[x]" : "[ ]"} ${title}\n*Created: ${date}*\nStatus: ${status}${priority}${category}${dueDate}\n\n${t.description || "No description provided."}`;
    })
    .join("\n\n---\n\n");
}

export function convertTopicsToJSON(topics: Topic[] | (Topic & { note_count: number; paper_count: number; idea_count: number })[]): string {
  return JSON.stringify(topics, null, 2);
}

export function convertTopicsToCSV(topics: Topic[] | (Topic & { note_count: number; paper_count: number; idea_count: number })[]): string {
  if (topics.length === 0) return "";
  const headers = [
    "Name",
    "Description",
    "Notes Count",
    "Papers Count",
    "Ideas Count",
    "Created At",
    "Updated At",
  ];

  const rows = topics.map((t) => {
    return [
      escapeCSV(t.name),
      escapeCSV(t.description),
      escapeCSV(("note_count" in t ? t.note_count : 0).toString()),
      escapeCSV(("paper_count" in t ? t.paper_count : 0).toString()),
      escapeCSV(("idea_count" in t ? t.idea_count : 0).toString()),
      escapeCSV(t.created_at),
      escapeCSV(t.updated_at),
    ];
  });

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

export function convertTopicsToMarkdown(topics: Topic[] | (Topic & { note_count: number; paper_count: number; idea_count: number })[]): string {
  if (topics.length === 0) return "";
  return topics
    .map((t) => {
      const name = t.name || "Untitled Topic";
      const date = new Date(t.created_at).toLocaleDateString();
      const notesCount = "note_count" in t ? t.note_count : 0;
      const papersCount = "paper_count" in t ? t.paper_count : 0;
      const ideasCount = "idea_count" in t ? t.idea_count : 0;
      const stats = `\nNotes: ${notesCount} | Papers: ${papersCount} | Ideas: ${ideasCount}`;

      return `# ${name}\n*Created: ${date}*${stats}\n\n${t.description || "No description provided."}`;
    })
    .join("\n\n---\n\n");
}

function escapeCSV(str?: string | null): string {
  if (!str) return "";

  let result = str;

  // Prevent CSV Injection (Formula Injection) and DDE Injection
  // If the field starts with =, +, -, @, Tab (0x09), or CR (0x0D), it could be executed as a formula or command in Excel.
  // Prepending a single quote forces it to be treated as text.
  // Check for injection characters, including those preceded by whitespace or quotes.
  if (/^[\s"]*[=+\-@\t\r]/.test(result)) {
    result = "'" + result;
  }

  // if string contains comma, newline, or double quote, wrap in double quotes
  if (result.includes(",") || result.includes("\n") || result.includes('"')) {
    // escape double quotes by doubling them
    return `"${result.replace(/"/g, '""')}"`;
  }
  return result;
}

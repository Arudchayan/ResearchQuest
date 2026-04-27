import { supabase } from "../lib/supabase";
import type { ExportData } from "./export";
import { toast } from "sonner";
import { logger } from "./logger";

export type ImportDataResult =
  | { success: true; imported: number; skipped: number }
  | { success: false; error: string };

const REQUIRED_ARRAY_KEYS = [
  "notes",
  "papers",
  "ideas",
  "tasks",
  "topics",
] as const satisfies readonly (keyof ExportData)[];

function validateImportPayload(parsed: unknown):
  | { ok: true; data: ExportData }
  | { ok: false; error: string } {
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "Invalid backup file: expected a JSON object" };
  }

  const record = parsed as Record<string, unknown>;

  if (!record.metadata || typeof record.metadata !== "object") {
    return { ok: false, error: "Missing required field: metadata" };
  }

  const meta = record.metadata as Record<string, unknown>;
  if (typeof meta.appName !== "string") {
    return { ok: false, error: "Missing required field: metadata.appName" };
  }

  for (const key of REQUIRED_ARRAY_KEYS) {
    if (!(key in record)) {
      return { ok: false, error: `Missing required field: ${key}` };
    }
    if (!Array.isArray(record[key])) {
      return { ok: false, error: `Invalid backup file: ${key} must be an array` };
    }
  }

  return { ok: true, data: parsed as ExportData };
}

export async function importData(
  file: File,
  userId: string,
): Promise<ImportDataResult> {
  let text: string;
  try {
    text = await file.text();
  } catch {
    toast.error("Invalid JSON file");
    return { success: false, error: "Invalid JSON file" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    toast.error("Invalid JSON file");
    return { success: false, error: "Invalid JSON file" };
  }

  const validated = validateImportPayload(parsed);
  if (validated.ok === false) {
    toast.error(validated.error);
    return { success: false, error: validated.error };
  }

  const data = validated.data;

  if (data.metadata.appName !== "ResearchQuest") {
    toast.error("Invalid backup file: Not a ResearchQuest backup");
    return {
      success: false,
      error: "Invalid backup file: Not a ResearchQuest backup",
    };
  }

  const toastId = toast.loading("Importing data...");
  let imported = 0;
  const skipped = 0;

  const upsertOnId = async (table: string, rows: Record<string, unknown>[]) => {
    if (rows.length === 0) return;
    const { error } = await supabase.from(table).upsert(rows, {
      onConflict: "id",
      ignoreDuplicates: true,
    });
    if (error) {
      logger.error(`[RQ] import upsert failed: ${table}`, error);
      throw error;
    }
    imported += rows.length;
  };

  try {
    if (data.topics.length > 0) {
      const topics = data.topics.map((t) => ({
        id: t.id,
        user_id: userId,
        name: t.name,
        description: t.description,
        created_at: t.created_at,
        updated_at: t.updated_at,
      }));
      await upsertOnId("topics", topics);
    }

    if (data.notes.length > 0) {
      const notes = data.notes.map((n) => ({ ...n, user_id: userId }));
      await upsertOnId("notes", notes);
    }

    if (data.papers.length > 0) {
      const papers = data.papers.map((p) => ({ ...p, user_id: userId }));
      await upsertOnId("papers", papers);
    }

    if (data.ideas.length > 0) {
      const ideas = data.ideas.map((i) => ({ ...i, user_id: userId }));
      await upsertOnId("ideas", ideas);
    }

    if (data.tasks.length > 0) {
      const tasks = data.tasks.map((t) => ({ ...t, user_id: userId }));
      await upsertOnId("tasks", tasks);
    }

    const topicNotes = Array.isArray(data.topicNotes) ? data.topicNotes : [];
    if (topicNotes.length > 0) {
      const rows = topicNotes.map((r) => ({ ...r, user_id: userId }));
      await upsertOnId("topic_notes", rows);
    }

    const topicPapers = Array.isArray(data.topicPapers) ? data.topicPapers : [];
    if (topicPapers.length > 0) {
      const rows = topicPapers.map((r) => ({ ...r, user_id: userId }));
      await upsertOnId("topic_papers", rows);
    }

    const topicIdeas = Array.isArray(data.topicIdeas) ? data.topicIdeas : [];
    if (topicIdeas.length > 0) {
      const rows = topicIdeas.map((r) => ({ ...r, user_id: userId }));
      await upsertOnId("topic_ideas", rows);
    }

    toast.success(`Imported ${imported} rows`, { id: toastId });
    return { success: true, imported, skipped };
  } catch (error) {
    logger.error("Import failed", error);
    toast.error("Failed to import data. Please check the file and try again.", {
      id: toastId,
    });
    return {
      success: false,
      error: "Failed to import data. Please check the file and try again.",
    };
  }
}

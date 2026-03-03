import { supabase } from "../lib/supabase";
import { ExportData } from "./export";
import { toast } from "sonner";

export async function importData(file: File, userId: string) {
  try {
    const text = await file.text();
    let data: ExportData;

    try {
      data = JSON.parse(text);
    } catch (e) {
      toast.error("Invalid JSON file");
      return;
    }

    // Validate metadata basics
    if (!data.metadata || data.metadata.appName !== "ResearchQuest") {
      toast.error("Invalid backup file: Not a ResearchQuest backup");
      return;
    }

    const toastId = toast.loading("Importing data...");

    // Import Topics
    if (data.topics && data.topics.length > 0) {
      const topics = data.topics.map((t) => ({
        id: t.id,
        user_id: userId,
        name: t.name,
        description: t.description,
        created_at: t.created_at,
        updated_at: t.updated_at,
      }));
      const { error } = await supabase.from("topics").upsert(topics);
      if (error) {
        console.error("Error importing topics:", (error as Error)?.message || "Unknown error");
        throw error;
      }
    }

    // Import Notes
    if (data.notes && data.notes.length > 0) {
      const notes = data.notes.map((n) => ({ ...n, user_id: userId }));
      const { error } = await supabase.from("notes").upsert(notes);
      if (error) {
        console.error("Error importing notes:", (error as Error)?.message || "Unknown error");
        throw error;
      }
    }

    // Import Papers
    if (data.papers && data.papers.length > 0) {
      const papers = data.papers.map((p) => ({ ...p, user_id: userId }));
      const { error } = await supabase.from("papers").upsert(papers);
      if (error) {
        console.error("Error importing papers:", (error as Error)?.message || "Unknown error");
        throw error;
      }
    }

    // Import Ideas
    if (data.ideas && data.ideas.length > 0) {
      const ideas = data.ideas.map((i) => ({ ...i, user_id: userId }));
      const { error } = await supabase.from("ideas").upsert(ideas);
      if (error) {
        console.error("Error importing ideas:", (error as Error)?.message || "Unknown error");
        throw error;
      }
    }

    toast.success("Data imported successfully", { id: toastId });
  } catch (error) {
    console.error("Import failed:", (error as Error)?.message || "Unknown error");
    toast.error(
      "Failed to import data: " +
        (error instanceof Error ? error.message : "Unknown error"),
    );
  }
}

import { supabase } from "../lib/supabase";
import { logger } from "./logger";

export interface DeepResearchPaper {
  title: string;
  year: number | null;
  citationCount: number | null;
  authors: string[];
  abstract: string | null;
}

export interface DeepResearchData {
  query: string;
  reasoningSteps: string[];
  summary: string;
  suggestedKeywords: string[];
  timestamp: string;
  papers?: DeepResearchPaper[];
}

export async function performDeepResearch(query: string): Promise<DeepResearchData> {
  try {
    const { data, error } = await supabase.functions.invoke("deep-research", {
      body: { query },
    });

    if (error) {
      logger.error("Deep research error", error);
      throw error;
    }

    return data.data;
  } catch (error) {
    logger.error("Deep research invocation failed", error);
    throw error;
  }
}

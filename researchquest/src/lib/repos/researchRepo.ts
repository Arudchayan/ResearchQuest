import { supabase } from "../supabase";
import { logger } from "../../utils/logger";

/**
 * Deep-research edge-function access (PR15 item 39).
 *
 * Canonical home of the `deep-research` invocation. `utils/deepResearch.ts`
 * re-exports this (so `AdversarialReviewPanel` keeps working unchanged) and
 * `IdeaDetailView` calls it directly — collapsing the previous dual
 * `supabase.functions.invoke("deep-research", ...)` call sites into one.
 */

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

export async function performDeepResearch(
  query: string,
): Promise<DeepResearchData> {
  try {
    const { data, error } = await supabase.functions.invoke("deep-research", {
      body: { query },
    });

    if (error) {
      logger.error("Deep research error", error);
      throw error;
    }

    return (data as { data: DeepResearchData }).data;
  } catch (error) {
    logger.error("Deep research invocation failed", error);
    throw error;
  }
}

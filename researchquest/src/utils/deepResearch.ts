import { supabase } from "../lib/supabase";
import { logger } from "./logger";

export async function performDeepResearch(query: string): Promise<any> {
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

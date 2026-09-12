import { supabase } from "../supabase";
import { makeEntityRepo } from "./entityRepo";
import type { Paper } from "../../types/database";

/** Batch-insert row shape (mirrors the usePapers bulk-import payload). */
export type PaperInsertRow = Pick<
  Paper,
  "user_id" | "title" | "authors" | "status"
> &
  Partial<
    Pick<
      Paper,
      "doi" | "source_url" | "abstract" | "publication_date" | "topic_ids"
    >
  >;

export const papersRepo = {
  ...makeEntityRepo<Paper>("papers"),

  /**
   * Batch insert for bulk import (`usePapers.createPapers`): one round-trip
   * for N rows. Returns the raw `{ data, error }` of
   * `insert(rows).select()`, identical to the previously inlined call.
   */
  async insertMany(rows: PaperInsertRow[]) {
    return supabase.from("papers").insert(rows).select();
  },
};

import { supabase } from "../supabase";

/**
 * Generic entity repository factory (PR15 item 39).
 *
 * Mirrors the query chains of the `useEntityCrud` primitives 1:1
 * (insert/update/delete/upsert-restore with the same filters and
 * `.select().single()` shapes) so future hook migrations keep identical
 * return shapes. Per-entity files bind a table name + row type.
 */

export interface RepoResult<T> {
  data: T | null;
  error: unknown;
}

export interface EntityRepo<T extends { id: string }> {
  readonly tableName: string;
  insert(row: Record<string, unknown>): Promise<RepoResult<T>>;
  update(
    id: string,
    userId: string,
    patch: Record<string, unknown>,
    returnData?: boolean,
  ): Promise<RepoResult<T>>;
  remove(id: string, userId: string): Promise<{ error: unknown }>;
  restore(row: Record<string, unknown>): Promise<RepoResult<T>>;
}

export function makeEntityRepo<T extends { id: string }>(
  tableName: string,
): EntityRepo<T> {
  return {
    tableName,

    async insert(row) {
      const res = await supabase.from(tableName).insert(row).select().single();
      return { data: (res.data as T | undefined) ?? null, error: res.error };
    },

    async update(id, userId, patch, returnData = true) {
      const chain = supabase
        .from(tableName)
        .update(patch)
        .eq("id", id)
        .eq("user_id", userId);
      if (!returnData) {
        const res = await chain;
        return { data: null, error: res.error };
      }
      const res = await chain.select().single();
      return { data: (res.data as T | undefined) ?? null, error: res.error };
    },

    async remove(id, userId) {
      const res = await supabase
        .from(tableName)
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
      return { error: res.error };
    },

    async restore(row) {
      const res = await supabase
        .from(tableName)
        .upsert(row, { onConflict: "id" })
        .select()
        .single();
      return { data: (res.data as T | undefined) ?? null, error: res.error };
    },
  };
}

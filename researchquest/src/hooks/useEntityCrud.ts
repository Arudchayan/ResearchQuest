/**
 * Generic entity CRUD factory.
 *
 * Encapsulates the common shape of create/update/delete/restore shared by
 * useNotes / usePapers / useIdeas: auth guard, validation (prepare*), optimistic
 * store update, revert-on-error, selected-entity sync, XP award, toasts.
 * Entity-specific bits are supplied through `config` (labels, payload shapes,
 * custom insert/update primitives, sort, XP rewards).
 */
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "../lib/supabase";
import { awardXP, notifyGamificationResult } from "../utils/gamification";
import { sortByUpdatedAt } from "../utils/sort";
import { dedupeById } from "../utils/collections";
import { logger } from "../utils/logger";
import { useAppStore } from "../store/appStore";

export type AppStoreState = ReturnType<typeof useAppStore.getState>;

export interface CrudError {
  message?: string;
  code?: string;
}

export interface CrudResult<T> {
  data: T | null;
  error: CrudError | null;
}

export type CrudOp = "create" | "update" | "delete" | "restore";

/**
 * Fire-and-forget XP award with gamification notify and a sanitized log on
 * failure. Shared by the factory ops and per-entity conditional awards.
 */
export function awardXPAndNotify(
  userId: string,
  reward: number,
  action: string,
  skipXpToast?: boolean,
): void {
  awardXP(userId, reward, action)
    .then((result) =>
      notifyGamificationResult(
        result,
        skipXpToast ? { skipXpToast: true } : undefined,
      ),
    )
    .catch((error) => logger.error("Failed to award XP", error));
}

export interface EntityCrudConfig<
  T extends { id: string; updated_at: string },
  Input = Partial<T>,
  Extra = undefined,
> {
  userId: string | undefined;

  /** Zustand selectors for the entity collection and loading flag. */
  items: (state: AppStoreState) => T[];
  setItems: (state: AppStoreState) => (items: T[]) => void;
  loading: (state: AppStoreState) => boolean;
  selected: (state: AppStoreState) => { id: string } | null;
  setSelected: (state: AppStoreState) => (item: T | null) => void;

  entityLabel: string;
  entityPlural: string;
  createVerb: "create" | "add";

  /** Validation + payload cleaning. Return null to abort after firing `fail`. */
  prepareCreate: (
    input: Input,
    userId: string,
    fail: (message: string) => void,
  ) => Record<string, unknown> | null;
  prepareUpdate: (
    current: T | null,
    updates: Partial<T>,
    fail: (message: string) => void,
  ) => Partial<T> | null;

  /** Optimistic entity placed in the store; default `{...current, ...payload, updated_at: now}`. */
  buildOptimisticEntity?: (
    current: T,
    payload: Partial<T>,
    updates: Partial<T>,
  ) => T;

  /** Insert/update/delete/restore primitives. Defaults use `tableName` against supabase. */
  tableName: string;
  insert?: (payload: Record<string, unknown>) => Promise<CrudResult<T>>;
  update?: (id: string, payload: Partial<T>) => Promise<CrudResult<T>>;
  delete?: (id: string) => Promise<{ error: CrudError | null }>;
  restore?: (payload: Record<string, unknown>) => Promise<CrudResult<T>>;

  /** Ordering applied after optimistic writes. Default `sortByUpdatedAt`. */
  sort?: (items: T[]) => T[];

  /** When the update returns the confirmed row, replace the optimistic entity with it. */
  updateReturnsData?: boolean;

  /** "before" (default): auth checked before the optimistic write. "after": write first, revert if unauthenticated. */
  updateGuard?: "before" | "after";

  /** Re-sync the selected entity when a failed delete is reverted. */
  resyncSelectedOnDeleteRevert?: boolean;
  /** Refetch when an update targets an id not present in the store. */
  onSnapshotMissing?: () => void;

  /** Per-op error feedback; defaults to `Failed to {verb} {label}: {message}` (restore is toast-only). */
  onError?: (
    op: CrudOp,
    error: CrudError | null,
    setError: (message: string | null) => void,
  ) => void;

  /** Insert succeeded but returned no row (ideas RPC). */
  onCreateNullData?: (setError: (message: string | null) => void) => void;

  /** Success-side hooks. */
  afterCreate?: (userId: string, entity: T) => void;
  afterUpdateSuccess?: (
    userId: string,
    payload: Partial<T>,
    snapshot: T | null,
    extra?: Extra,
  ) => void;

  /** Unconditional XP awards for create/update. */
  xpCreate?: { reward: number; action: string; skipXpToast?: boolean };
  xpUpdate?: { reward: number; action: string; skipXpToast?: boolean };
}

export interface EntityCrudReturn<T, Input, Extra> {
  items: T[];
  loading: boolean;
  error: string | null;
  setError: (message: string | null) => void;
  setItems: (items: T[]) => void;
  create: (input: Input) => Promise<T | null>;
  update: (id: string, updates: Partial<T>, extra?: Extra) => Promise<boolean>;
  delete: (id: string) => Promise<boolean>;
  restore: (entity: T) => Promise<T | null>;
}

const opText: Record<Exclude<CrudOp, "restore">, (cfg: { createVerb: string; entityLabel: string }) => string> = {
  create: (cfg) => `Failed to ${cfg.createVerb} ${cfg.entityLabel.toLowerCase()}: `,
  update: (cfg) => `Failed to update ${cfg.entityLabel.toLowerCase()}: `,
  delete: (cfg) => `Failed to delete ${cfg.entityLabel.toLowerCase()}: `,
};

export function useEntityCrud<
  T extends { id: string; updated_at: string },
  Input = Partial<T>,
  Extra = undefined,
>(config: EntityCrudConfig<T, Input, Extra>) {
  // Latest-ref keeps the ops referentially stable while always reading fresh config.
  const configRef = useRef(config);
  configRef.current = config;

  const [error, setError] = useState<string | null>(null);

  const items = useAppStore(config.items);
  const loading = useAppStore(config.loading);
  const setItemsStore = useAppStore(config.setItems);
  const setSelectedStore = useAppStore(config.setSelected);

  const fail = useCallback((message: string) => {
    setError(message);
    toast.error(message);
  }, []);

  const guardFail = useCallback((verb: string) => {
    setError("User not authenticated");
    toast.error(
      `You must be logged in to ${verb} ${configRef.current.entityPlural}`,
    );
  }, []);

  const syncSelected = useCallback(
    (updated: T | null) => {
      if (!updated) return;
      const current = configRef.current.selected(useAppStore.getState());
      if (current?.id === updated.id) {
        setSelectedStore(updated);
      }
    },
    [setSelectedStore],
  );

  const currentItems = useCallback(
    () => configRef.current.items(useAppStore.getState()),
    [],
  );

  const applySort = useCallback((list: T[]) => {
    const sortFn = configRef.current.sort ?? sortByUpdatedAt;
    return sortFn(list);
  }, []);

  const handleError = useCallback(
    (op: CrudOp, crudError: CrudError | null) => {
      const custom = configRef.current.onError;
      if (custom) {
        custom(op, crudError, setError);
        return;
      }
      if (op === "restore") {
        toast.error(
          `Failed to restore ${configRef.current.entityLabel.toLowerCase()}: ${crudError?.message || "Unknown error occurred"}`,
        );
        return;
      }
      const message = `${opText[op](configRef.current)}${crudError?.message || "Unknown error occurred"}`;
      setError(message);
      toast.error(message);
    },
    [],
  );

  const insertPrimitive = useCallback(
    async (payload: Record<string, unknown>): Promise<CrudResult<T>> => {
      const res = await supabase
        .from(configRef.current.tableName)
        .insert(payload)
        .select()
        .single();
      return { data: res.data ?? null, error: res.error };
    },
    [],
  );

  const updatePrimitive = useCallback(
    async (id: string, payload: Partial<T>): Promise<CrudResult<T>> => {
      const cfg = configRef.current;
      const chain = supabase
        .from(cfg.tableName)
        .update(payload as T)
        .eq("id", id)
        .eq("user_id", cfg.userId);
      if (!cfg.updateReturnsData) {
        const res = await chain;
        return { data: null, error: res.error };
      }
      const res = await chain.select().single();
      return { data: res.data ?? null, error: res.error };
    },
    [],
  );

  const deletePrimitive = useCallback(
    async (id: string): Promise<{ error: CrudError | null }> => {
      const cfg = configRef.current;
      const res = await supabase
        .from(cfg.tableName)
        .delete()
        .eq("id", id)
        .eq("user_id", cfg.userId);
      return { error: res.error };
    },
    [],
  );

  const restorePrimitive = useCallback(
    async (payload: Record<string, unknown>): Promise<CrudResult<T>> => {
      const res = await supabase
        .from(configRef.current.tableName)
        .upsert(payload, { onConflict: "id" })
        .select()
        .single();
      return { data: res.data ?? null, error: res.error };
    },
    [],
  );

  const create = useCallback(
    async (input: Input): Promise<T | null> => {
      const cfg = configRef.current;
      if (!cfg.userId) {
        guardFail(cfg.createVerb);
        return null;
      }
      const payload = cfg.prepareCreate(input, cfg.userId, fail);
      if (payload === null) return null;

      const result = await (cfg.insert ?? insertPrimitive)(payload);
      if (result.error) {
        handleError("create", result.error);
        return null;
      }
      if (!result.data) {
        cfg.onCreateNullData?.(setError);
        return null;
      }

      toast.success(
        `${cfg.entityLabel} ${cfg.createVerb === "add" ? "added" : "created"} successfully`,
      );
      setItemsStore(applySort([result.data, ...currentItems()]));

      cfg.afterCreate?.(cfg.userId, result.data);
      if (cfg.xpCreate) {
        awardXPAndNotify(
          cfg.userId,
          cfg.xpCreate.reward,
          cfg.xpCreate.action,
          cfg.xpCreate.skipXpToast,
        );
      }
      return result.data;
    },
    [
      guardFail,
      fail,
      handleError,
      insertPrimitive,
      setItemsStore,
      applySort,
      currentItems,
    ],
  );

  const update = useCallback(
    async (id: string, updates: Partial<T>, extra?: Extra): Promise<boolean> => {
      const cfg = configRef.current;
      const itemsBefore = currentItems();
      const current = itemsBefore.find((item) => item.id === id) ?? null;

      if ((cfg.updateGuard ?? "before") !== "after" && !cfg.userId) {
        guardFail("update");
        return false;
      }

      const payload = cfg.prepareUpdate(current, updates, fail);
      if (payload === null) return false;

      let merged: T | null = null;
      if (cfg.buildOptimisticEntity) {
        if (current) merged = cfg.buildOptimisticEntity(current, payload, updates);
      } else if (current) {
        merged = {
          ...current,
          ...payload,
          updated_at: new Date().toISOString(),
        };
      }

      setItemsStore(
        applySort(
          itemsBefore.map((item) =>
            item.id === id && merged ? merged : item,
          ),
        ),
      );
      if (merged) syncSelected(merged);

      if (cfg.updateGuard === "after" && !cfg.userId) {
        setItemsStore(itemsBefore);
        if (current) syncSelected(current);
        return false;
      }

      if (!cfg.userId) return false;

      const result = await (cfg.update ?? updatePrimitive)(id, payload);
      if (result.error) {
        handleError("update", result.error);
        if (current) {
          const fresh = currentItems();
          setItemsStore(
            applySort(fresh.map((item) => (item.id === id ? current : item))),
          );
          syncSelected(current);
        } else {
          cfg.onSnapshotMissing?.();
        }
        return false;
      }

      if (cfg.updateReturnsData && result.data) {
        const confirmed = result.data;
        const fresh = currentItems();
        setItemsStore(
          applySort(
            fresh.map((item) => (item.id === id ? confirmed : item)),
          ),
        );
        syncSelected(confirmed);
      }

      cfg.afterUpdateSuccess?.(cfg.userId, payload, current, extra);
      if (cfg.xpUpdate) {
        awardXPAndNotify(
          cfg.userId,
          cfg.xpUpdate.reward,
          cfg.xpUpdate.action,
          cfg.xpUpdate.skipXpToast,
        );
      }
      return true;
    },
    [
      currentItems,
      applySort,
      guardFail,
      fail,
      syncSelected,
      handleError,
      updatePrimitive,
      setItemsStore,
    ],
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      const cfg = configRef.current;
      if (!cfg.userId) {
        guardFail("delete");
        return false;
      }

      const itemsBefore = currentItems();
      const deleted = itemsBefore.find((item) => item.id === id);
      setItemsStore(itemsBefore.filter((item) => item.id !== id));

      const currentSelected = cfg.selected(useAppStore.getState());
      if (currentSelected?.id === id) setSelectedStore(null);

      const result = await (cfg.delete ?? deletePrimitive)(id);
      if (result.error) {
        handleError("delete", result.error);
        if (deleted) {
          // Revert with dedupe: the deleted entity is absent from the fresh
          // list, so dedupeById is order-equivalent to prepend/append while
          // guarding against realtime re-inserts.
          setItemsStore(
            applySort(dedupeById([deleted, ...currentItems()])),
          );
          if (cfg.resyncSelectedOnDeleteRevert) syncSelected(deleted);
        }
        return false;
      }
      return true;
    },
    [
      currentItems,
      applySort,
      guardFail,
      handleError,
      deletePrimitive,
      setItemsStore,
      setSelectedStore,
      syncSelected,
    ],
  );

  const restore = useCallback(
    async (entity: T): Promise<T | null> => {
      const cfg = configRef.current;
      if (!cfg.userId) {
        guardFail("restore");
        return null;
      }

      const payload = {
        ...entity,
        user_id: cfg.userId,
        updated_at: new Date().toISOString(),
      };
      const result = await (cfg.restore ?? restorePrimitive)(payload);
      if (result.error) {
        handleError("restore", result.error);
        return null;
      }

      const restored = result.data ?? entity;
      const fresh = currentItems();
      setItemsStore(
        applySort([
          restored,
          ...fresh.filter((item) => item.id !== restored.id),
        ]),
      );
      toast.success(`${cfg.entityLabel} restored`);
      return restored;
    },
    [
      currentItems,
      applySort,
      guardFail,
      handleError,
      restorePrimitive,
      setItemsStore,
    ],
  );

  return {
    items,
    loading,
    error,
    setError,
    setItems: setItemsStore,
    create,
    update,
    delete: remove,
    restore,
  };
}

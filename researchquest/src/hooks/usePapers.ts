import { useCallback } from "react";
import { supabase } from "../lib/supabase";
import {
  awardXP,
  notifyGamificationResult,
  XP_REWARDS,
  type GamificationResult,
} from "../utils/gamification";
import { sortByUpdatedAt } from "../utils/sort";
import { isValidUrl } from "../utils/security";
import { toast } from "sonner";
import type { Paper, CrossrefPaper, PaperDraft } from "../types/database";
import { extractFunctionErrorMessage } from "../utils/errors";
import { logger } from "../utils/logger";
import { useAppStore } from "../store/appStore";
import {
  useEntityCrud,
  awardXPAndNotify,
  type AppStoreState,
  type CrudError,
} from "./useEntityCrud";

const PAPER_TITLE_MAX_LENGTH = 255;
const PAPER_ABSTRACT_MAX_LENGTH = 5000;

type PaperInsertPayload = Pick<Paper, "user_id" | "title" | "authors" | "status"> &
  Partial<Pick<Paper, "doi" | "source_url" | "abstract" | "publication_date" | "topic_ids">>;

interface FunctionErrorPayload<T> {
  error?: {
    message?: string;
  };
  data?: T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getFunctionPayload<T>(value: unknown): FunctionErrorPayload<T> | null {
  return isRecord(value) ? (value as FunctionErrorPayload<T>) : null;
}

const selectPapers = (state: AppStoreState) => state.papers;
const selectSetPapers = (state: AppStoreState) => state.setPapers;
const selectPapersLoading = (state: AppStoreState) => state.papersLoading;
const selectSelectedPaper = (state: AppStoreState) => state.selectedPaper;
const selectSetSelectedPaper = (state: AppStoreState) => state.setSelectedPaper;

// Helper function to create a reading task for a newly added paper
async function createReadingTaskForPaper(
  userId: string,
  paper: Paper,
): Promise<void> {
  try {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("auto_create_reading_tasks")
      .eq("id", userId)
      .single();

    const autoCreateEnabled = profile?.auto_create_reading_tasks !== false;

    if (!autoCreateEnabled) {
      return;
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);
    const dueDateString = dueDate.toISOString().split("T")[0];

    const paperTitle =
      paper.title.length > 50
        ? `${paper.title.substring(0, 47)}...`
        : paper.title;

    const { error } = await supabase.from("tasks").insert({
      user_id: userId,
      title: `Read: ${paperTitle}`,
      description: `Review and take notes on this paper. ${paper.authors.length > 0 ? `Authors: ${paper.authors.slice(0, 3).join(", ")}${paper.authors.length > 3 ? ", et al." : ""}` : ""}`,
      priority: "medium",
      category: "Reading",
      due_date: dueDateString,
      completed: false,
    });

    if (error) {
      // 🛡️ Security: Log only the message, not the full error object
      logger.error("Failed to create reading task", error);
    } else {
      toast.success("Reading task created", {
        description: `Due in 7 days - check your Tasks`,
        duration: 2000,
      });
    }
  } catch (error: unknown) {
    // 🛡️ Security: Log only the message, not the full error object
    logger.error(
      "Error creating reading task",
      error,
    );
  }
}

export interface PaperSearchOptions {
  rows?: number;
  sort?: "score" | "published" | "created" | "updated" | "indexed";
  order?: "asc" | "desc";
}

// 🛡️ Security: Expose only the error message or code, not internal details/hints
const paperErrorMessage = (error: CrudError | null): string =>
  error?.message ||
  (error?.code ? `Error ${error.code}` : "Unknown error occurred");

function cleanPaperDraft(
  paperData: PaperDraft,
  userId: string,
):
  | { ok: true; payload: PaperInsertPayload }
  | { ok: false; reason: "title-required" | "title-too-long" | "abstract-too-long" } {
  if (!paperData.title || !paperData.title.trim()) {
    return { ok: false, reason: "title-required" };
  }
  if (paperData.title.length > PAPER_TITLE_MAX_LENGTH) {
    return { ok: false, reason: "title-too-long" };
  }
  if (
    paperData.abstract &&
    paperData.abstract.length > PAPER_ABSTRACT_MAX_LENGTH
  ) {
    return { ok: false, reason: "abstract-too-long" };
  }

  const cleanData: PaperInsertPayload = {
    user_id: userId,
    title: paperData.title.trim(),
    authors: Array.isArray(paperData.authors) ? paperData.authors : [],
    status: paperData.status || "To Read",
  };

  if (paperData.doi && paperData.doi.trim())
    cleanData.doi = paperData.doi.trim();
  if (paperData.source_url && paperData.source_url.trim()) {
    const url = paperData.source_url.trim();
    if (isValidUrl(url)) {
      cleanData.source_url = url;
    }
  }
  if (paperData.abstract && paperData.abstract.trim())
    cleanData.abstract = paperData.abstract.trim();

  if (
    paperData.publication_date &&
    paperData.publication_date.trim() &&
    paperData.publication_date !== "null"
  ) {
    const pubDate = paperData.publication_date.trim();
    if (/^\d{4}$/.test(pubDate)) {
      cleanData.publication_date = `${pubDate}-01-01`;
    } else {
      cleanData.publication_date = pubDate;
    }
  }

  if (
    paperData.topic_ids &&
    Array.isArray(paperData.topic_ids) &&
    paperData.topic_ids.length > 0
  ) {
    cleanData.topic_ids = paperData.topic_ids;
  }

  return { ok: true, payload: cleanData };
}

const CREATE_FAIL_REASON_MESSAGE: Record<
  "title-required" | "title-too-long" | "abstract-too-long",
  string
> = {
  "title-required": "Paper title is required",
  "title-too-long": `Paper title exceeds ${PAPER_TITLE_MAX_LENGTH} characters`,
  "abstract-too-long": `Paper abstract exceeds ${PAPER_ABSTRACT_MAX_LENGTH} characters`,
};

export function usePapers(userId: string | undefined) {
  const setSelectedPaper = useAppStore(selectSetSelectedPaper);

  const crud = useEntityCrud<Paper, PaperDraft>({
    userId,
    items: selectPapers,
    setItems: selectSetPapers,
    loading: selectPapersLoading,
    selected: selectSelectedPaper,
    setSelected: selectSetSelectedPaper,
    entityLabel: "Paper",
    entityPlural: "papers",
    createVerb: "add",
    tableName: "papers",
    updateReturnsData: true,
    resyncSelectedOnDeleteRevert: true,
    onError: (op, err, setError) => {
      if (op === "create") {
        const message = paperErrorMessage(err);
        setError(`Failed to create paper: ${message}`);
        toast.error(`Failed to add paper: ${message}`, { duration: 5000 });
      } else if (op === "update") {
        setError(err?.message ?? null);
        toast.error("Failed to update paper");
      } else if (op === "delete") {
        setError(err?.message ?? null);
        toast.error("Failed to delete paper");
      }
    },
    prepareCreate: (paperData, uid, fail) => {
      const cleaned = cleanPaperDraft(paperData, uid);
      if (!cleaned.ok) {
        fail(CREATE_FAIL_REASON_MESSAGE[cleaned.reason]);
        return null;
      }
      return cleaned.payload;
    },
    prepareUpdate: (_current, updates, fail) => {
      if (updates.title && updates.title.length > PAPER_TITLE_MAX_LENGTH) {
        fail(`Paper title exceeds ${PAPER_TITLE_MAX_LENGTH} characters`);
        return null;
      }

      if (
        updates.abstract &&
        updates.abstract.length > PAPER_ABSTRACT_MAX_LENGTH
      ) {
        fail(`Paper abstract exceeds ${PAPER_ABSTRACT_MAX_LENGTH} characters`);
        return null;
      }

      const sanitized: Partial<Paper> = { ...updates };
      if (sanitized.source_url) {
        const url = sanitized.source_url.trim();
        if (isValidUrl(url)) {
          sanitized.source_url = url;
        } else {
          delete sanitized.source_url;
        }
      }

      return sanitized;
    },
    afterCreate: (uid, paper) => {
      void createReadingTaskForPaper(uid, paper);
    },
    afterUpdateSuccess: (uid, payload) => {
      if (payload.status) {
        toast.success(`Paper marked as ${payload.status}`);
        awardXPAndNotify(
          uid,
          XP_REWARDS.UPDATE_PAPER_STATUS,
          "update_paper_status",
        );
      }
    },
    xpCreate: { reward: XP_REWARDS.CREATE_PAPER, action: "create_paper" },
  });

  const { error, setError, setItems } = crud;

  const fetchPapers = useCallback(async () => {
    if (!userId) return;

    const { data, error: fetchError } = await supabase
      .from("papers")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      // Data is already sorted by updated_at desc from the DB query above
      const rows = data || [];
      setItems(rows);
      const selected = useAppStore.getState().selectedPaper;
      if (selected) {
        const fresh = rows.find((paper) => paper.id === selected.id);
        if (fresh) {
          setSelectedPaper(fresh);
        }
      }
    }
  }, [userId, setError, setItems, setSelectedPaper]);

  const searchPaperByDOI = useCallback(
    async (doi: string): Promise<CrossrefPaper | null> => {
      if (!doi.trim()) {
        setError("Please enter a DOI to search");
        return null;
      }

      try {
        const response = await supabase.functions.invoke("fetch-paper", {
          body: { doi },
        });

        if (response.error) {
          const errorMessage = extractFunctionErrorMessage(
            response.error,
            "Failed to search for paper",
          );
          setError(errorMessage);
          toast.error(errorMessage);
          return null;
        }

        const payload = getFunctionPayload<CrossrefPaper | null>(response.data);

        if (payload?.error) {
          const errorMessage =
            payload.error.message || "Failed to search for paper";
          setError(errorMessage);
          toast.error(errorMessage);
          return null;
        }

        return payload?.data ?? null;
      } catch (err: unknown) {
        const errorMessage =
          extractFunctionErrorMessage(err, "An error occurred while searching");
        setError(errorMessage);
        toast.error(errorMessage);
        return null;
      }
    },
    [setError],
  );

  const searchPapersByQuery = useCallback(
    async (
      query: string,
      options: PaperSearchOptions = {},
    ): Promise<CrossrefPaper[]> => {
      if (!query.trim()) {
        setError("Please enter a search query");
        return [];
      }

      try {
        const response = await supabase.functions.invoke("fetch-paper", {
          body: {
            query,
            rows: options.rows,
            sort: options.sort,
            order: options.order,
          },
        });

        if (response.error) {
          const errorMessage = extractFunctionErrorMessage(
            response.error,
            "Failed to search for papers",
          );
          setError(errorMessage);
          toast.error(errorMessage);
          return [];
        }

        const payload = getFunctionPayload<CrossrefPaper[]>(response.data);

        if (payload?.error) {
          const errorMessage =
            payload.error.message || "Failed to search for papers";
          setError(errorMessage);
          toast.error(errorMessage);
          return [];
        }

        return payload?.data ?? [];
      } catch (err: unknown) {
        const errorMessage =
          extractFunctionErrorMessage(err, "An error occurred while searching");
        setError(errorMessage);
        toast.error(errorMessage);
        return [];
      }
    },
    [setError],
  );

  const createPapers = useCallback(
    async (papersData: PaperDraft[]): Promise<Paper[]> => {
      if (!userId) {
        setError("User not authenticated");
        toast.error("You must be logged in to add papers");
        return [];
      }

      const validPapers: PaperInsertPayload[] = [];
      let skippedCount = 0;

      for (const paperData of papersData) {
        const cleaned = cleanPaperDraft(paperData, userId);
        if (!cleaned.ok) {
          skippedCount++;
          continue;
        }
        validPapers.push(cleaned.payload);
      }

      if (validPapers.length === 0) {
        return [];
      }

      // Batch insert using Supabase
      const { data, error: createError } = await supabase
        .from("papers")
        .insert(validPapers)
        .select();

      if (createError) {
        logger.error("Failed to insert papers batch", createError);
        const errorMessage =
          createError.message ||
          (createError.code
            ? `Error ${createError.code}`
            : "Unknown database error");
        setError(`Failed to batch create papers: ${errorMessage}`);
        toast.error(`Failed to batch create papers: ${errorMessage}`);
        return [];
      }

      if (skippedCount > 0) {
        toast.warning(`Added ${data.length} papers, skipped ${skippedCount} invalid entries`);
      } else {
        toast.success(`Successfully added ${data.length} papers`);
      }

      // Optimistic update
      setItems(sortByUpdatedAt([...data, ...useAppStore.getState().papers]));

      // Award XP: run per-paper awards concurrently, notify once with the
      // aggregated result so bulk imports don't stack a toast per paper.
      void Promise.all(
        data.map(() =>
          awardXP(userId, XP_REWARDS.CREATE_PAPER, "create_paper").catch(
            (e) => {
              logger.error("Failed to award XP", e);
              return null;
            },
          ),
        ),
      ).then((results) => {
        const aggregated = results.reduce<GamificationResult | null>(
          (acc, result) => {
            if (!result) return acc;
            if (!acc) {
              return { ...result };
            }
            return {
              xpEarned: acc.xpEarned + result.xpEarned,
              level: Math.max(acc.level, result.level),
              leveledUp: acc.leveledUp || result.leveledUp,
              streak: Math.max(acc.streak, result.streak),
              achievementsEarned: [
                ...acc.achievementsEarned,
                ...result.achievementsEarned,
              ],
            };
          },
          null,
        );
        notifyGamificationResult(aggregated);
      });
      void Promise.all(
        data.map((paper) => createReadingTaskForPaper(userId, paper)),
      );

      return data as Paper[];
    },
    [userId, setError, setItems],
  );

  return {
    papers: crud.items,
    loading: crud.loading,
    error,
    searchPaperByDOI,
    searchPapersByQuery,
    createPaper: crud.create,
    createPapers,
    updatePaper: crud.update,
    deletePaper: crud.delete,
    restorePaper: crud.restore,
    refreshPapers: fetchPapers,
  };
}

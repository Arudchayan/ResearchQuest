import { useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";
import {
  XP_REWARDS,
} from "../utils/gamification";
import { useAppStore } from "../store/appStore";
import {
  useEntityCrud,
  awardXPAndNotify,
  type AppStoreState,
} from "./useEntityCrud";
import type { Idea, IdeaStage } from "../types/database";

const IDEA_TRANSACTION_RPC = "save_idea_with_links" as const;
const IDEA_TITLE_MAX_LENGTH = 255;
const IDEA_DESCRIPTION_MAX_LENGTH = 5000;

const selectIdeas = (state: AppStoreState) => state.ideas;
const selectSetIdeas = (state: AppStoreState) => state.setIdeas;
const selectIdeasLoading = (state: AppStoreState) => state.ideasLoading;
const selectSelectedIdea = (state: AppStoreState) => state.selectedIdea;
const selectSetSelectedIdea = (state: AppStoreState) => state.setSelectedIdea;

export function useIdeas(userId: string | undefined) {
  const fetchIdeasRef = useRef<() => Promise<void>>(async () => {});
  const setSelectedIdea = useAppStore(selectSetSelectedIdea);

  const crud = useEntityCrud<Idea, Partial<Idea>, IdeaStage | undefined>({
    userId,
    items: selectIdeas,
    setItems: selectSetIdeas,
    loading: selectIdeasLoading,
    selected: selectSelectedIdea,
    setSelected: selectSetSelectedIdea,
    entityLabel: "Idea",
    entityPlural: "ideas",
    createVerb: "create",
    tableName: "ideas",
    // Ideas keep insertion order (no updated_at sort).
    sort: (items) => items,
    updateGuard: "after",
    updateReturnsData: true,
    resyncSelectedOnDeleteRevert: true,
    insert: async (payload) => {
      const res = await supabase.rpc(IDEA_TRANSACTION_RPC, payload);
      return { data: res.data ?? null, error: res.error };
    },
    update: async (id, payload) => {
      const res = await supabase.rpc(IDEA_TRANSACTION_RPC, {
        p_user_id: userId,
        p_idea_id: id,
        p_title: payload.title,
        p_description: payload.description ?? null,
        p_stage: payload.stage,
        p_linked_note_ids: payload.linked_note_ids ?? [],
        p_linked_paper_ids: payload.linked_paper_ids ?? [],
      });
      return { data: res.data ?? null, error: res.error };
    },
    prepareCreate: (ideaData, uid, fail) => {
      // Validate required fields
      if (!ideaData.title || !ideaData.title.trim()) {
        fail("Idea title is required");
        return null;
      }

      const trimmedTitle = ideaData.title.trim();
      let normalizedTitle = trimmedTitle;
      let inferredDescription = ideaData.description?.trim() || "";

      if (!inferredDescription) {
        const lineSplit = trimmedTitle.split(/\n+/);
        if (lineSplit.length > 1) {
          const [firstLine, ...rest] = lineSplit;
          if (firstLine?.trim()) {
            inferredDescription = rest.join(" ").trim();
            normalizedTitle = firstLine.trim();
          }
        }
      }

      if (!inferredDescription) {
        const delimiters = [" — ", " – ", " - ", ": "];
        for (const delimiter of delimiters) {
          if (trimmedTitle.includes(delimiter)) {
            const [maybeTitle, maybeDescription] =
              trimmedTitle.split(delimiter);
            if (maybeTitle?.trim() && maybeDescription?.trim()) {
              normalizedTitle = maybeTitle.trim();
              inferredDescription = maybeDescription.trim();
              break;
            }
          }
        }
      }

      if (normalizedTitle.length > IDEA_TITLE_MAX_LENGTH) {
        fail(`Idea title exceeds ${IDEA_TITLE_MAX_LENGTH} characters`);
        return null;
      }

      if (inferredDescription.length > IDEA_DESCRIPTION_MAX_LENGTH) {
        fail(
          `Idea description exceeds ${IDEA_DESCRIPTION_MAX_LENGTH} characters`,
        );
        return null;
      }

      return {
        p_user_id: uid,
        p_idea_id: null,
        p_title: normalizedTitle,
        p_description: inferredDescription || null,
        p_stage: ideaData.stage || "Seed",
        p_linked_note_ids:
          ideaData.linked_note_ids && Array.isArray(ideaData.linked_note_ids)
            ? ideaData.linked_note_ids
            : null,
        p_linked_paper_ids:
          ideaData.linked_paper_ids && Array.isArray(ideaData.linked_paper_ids)
            ? ideaData.linked_paper_ids
            : null,
      };
    },
    prepareUpdate: (current, updates, fail) => {
      if (!current) return null;

      const mergedForRPC = mergeIdea(current, updates);

      if (mergedForRPC.title.length > IDEA_TITLE_MAX_LENGTH) {
        fail(`Idea title exceeds ${IDEA_TITLE_MAX_LENGTH} characters`);
        return null;
      }

      if (
        (mergedForRPC.description?.length ?? 0) > IDEA_DESCRIPTION_MAX_LENGTH
      ) {
        fail(
          `Idea description exceeds ${IDEA_DESCRIPTION_MAX_LENGTH} characters`,
        );
        return null;
      }

      return mergedForRPC;
    },
    buildOptimisticEntity: (current, _payload, updates) => {
      const rawDescription = mergedDescription(current, updates);
      const merged: Idea = {
        ...current,
        ...updates,
        title: (updates.title ?? current.title).trim(),
        ...(rawDescription !== undefined
          ? { description: rawDescription }
          : {}),
        stage: updates.stage ?? current.stage,
        linked_note_ids: updates.linked_note_ids ?? current.linked_note_ids ?? [],
        linked_paper_ids:
          updates.linked_paper_ids ?? current.linked_paper_ids ?? [],
        updated_at: new Date().toISOString(),
      };
      return merged;
    },
    onCreateNullData: (setError) => {
      setError("Idea could not be created. Please try again.");
      toast.error("Idea could not be created. Please try again.");
      void fetchIdeasRef.current();
    },
    afterUpdateSuccess: (uid, payload, _snapshot, oldStage) => {
      const stage = payload.stage;
      if (stage && stage !== oldStage) {
        toast.success(`Idea stage updated to ${stage}`);
      }

      if (stage && oldStage && stage !== oldStage && uid) {
        const stages: IdeaStage[] = [
          "Seed",
          "Developing",
          "Supported",
          "Mature",
        ];
        const oldIndex = stages.indexOf(oldStage);
        const newIndex = stages.indexOf(stage);

        if (newIndex > oldIndex) {
          awardXPAndNotify(
            uid,
            XP_REWARDS.ADVANCE_IDEA_STAGE,
            "advance_idea_stage",
          );
        }
      }
    },
    xpCreate: { reward: XP_REWARDS.CREATE_IDEA, action: "create_idea" },
  });

  const { error, setError, setItems, update: updateEntity } = crud;

  const fetchIdeas = useCallback(async () => {
    if (!userId) return;

    // setLoading(true) // Handled by global sync
    const { data, error: fetchError } = await supabase
      .from("ideas")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      const rows = data || [];
      setItems(rows);
      const selected = useAppStore.getState().selectedIdea;
      if (selected) {
        const fresh = rows.find((idea) => idea.id === selected.id);
        if (fresh) {
          setSelectedIdea(fresh);
        }
      }
    }
  }, [userId, setError, setItems, setSelectedIdea]);

  fetchIdeasRef.current = fetchIdeas;

  const updateIdea = useCallback(
    (
      ideaId: string,
      updates: Partial<Idea>,
      oldStage?: IdeaStage,
    ): Promise<boolean> => updateEntity(ideaId, updates, oldStage),
    [updateEntity],
  );

  return {
    ideas: crud.items,
    loading: crud.loading,
    error,
    createIdea: crud.create,
    updateIdea,
    deleteIdea: crud.delete,
    restoreIdea: crud.restore,
    refreshIdeas: fetchIdeas,
  };
}

/** Normalize the merged description for an idea update (shared by payload + optimistic builds). */
function mergedDescription(
  current: Idea,
  updates: Partial<Idea>,
): string | undefined {
  const rawDescription = Object.prototype.hasOwnProperty.call(
    updates,
    "description",
  )
    ? (updates.description ?? "").toString().trim()
    : (current.description ?? "");
  return rawDescription ? rawDescription : undefined;
}

/** Full merged idea used as the RPC payload for save_idea_with_links. */
function mergeIdea(current: Idea, updates: Partial<Idea>): Idea {
  return {
    ...current,
    ...updates,
    title: (updates.title ?? current.title).trim(),
    description: mergedDescription(current, updates),
    stage: updates.stage ?? current.stage,
    linked_note_ids: updates.linked_note_ids ?? current.linked_note_ids ?? [],
    linked_paper_ids: updates.linked_paper_ids ?? current.linked_paper_ids ?? [],
  };
}

import { logger } from "../utils/logger";
import { useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { awardXP, XP_REWARDS } from "../utils/gamification";
import { toast } from "sonner";
import type { Idea, IdeaStage } from "../types/database";
import { useAppStore } from "../store/appStore";

const IDEA_TRANSACTION_RPC = "save_idea_with_links" as const;
const IDEA_TITLE_MAX_LENGTH = 255;
const IDEA_DESCRIPTION_MAX_LENGTH = 5000;

export function useIdeas(userId: string | undefined) {
  const ideas = useAppStore((state) => state.ideas);
  const loading = useAppStore((state) => state.ideasLoading);
  const setIdeas = useAppStore((state) => state.setIdeas);
  const setSelectedIdea = useAppStore((state) => state.setSelectedIdea);
  const [error, setError] = useState<string | null>(null);

  const syncSelectedIdea = useCallback(
    (updated: Idea | null) => {
      if (!updated) return;
      const current = useAppStore.getState().selectedIdea;
      if (current?.id === updated.id) {
        setSelectedIdea(updated);
      }
    },
    [setSelectedIdea],
  );

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
      setIdeas(rows);
      const selected = useAppStore.getState().selectedIdea;
      if (selected) {
        const fresh = rows.find((idea) => idea.id === selected.id);
        if (fresh) {
          setSelectedIdea(fresh);
        }
      }
    }
  }, [userId, setIdeas, setSelectedIdea]);

  const createIdea = useCallback(
    async (ideaData: Partial<Idea>): Promise<Idea | null> => {
      if (!userId) {
        setError("User not authenticated");
        toast.error("You must be logged in to create ideas");
        return null;
      }

      // Validate required fields
      if (!ideaData.title || !ideaData.title.trim()) {
        setError("Idea title is required");
        toast.error("Idea title is required");
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
        const msg = `Idea title exceeds ${IDEA_TITLE_MAX_LENGTH} characters`;
        setError(msg);
        toast.error(msg);
        return null;
      }

      if (inferredDescription.length > IDEA_DESCRIPTION_MAX_LENGTH) {
        const msg = `Idea description exceeds ${IDEA_DESCRIPTION_MAX_LENGTH} characters`;
        setError(msg);
        toast.error(msg);
        return null;
      }

      const transactionPayload = {
        p_user_id: userId,
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

      const { data, error: createError } = await supabase.rpc(
        IDEA_TRANSACTION_RPC,
        transactionPayload,
      );

      if (createError) {
        // Error handling...
        const errorMessage = createError.message || "Unknown error occurred";
        setError(`Failed to create idea: ${errorMessage}`);
        toast.error(`Failed to create idea: ${errorMessage}`);
        return null;
      }

      const createdIdea = (data as Idea | null) ?? null;

      if (!createdIdea) {
        setError("Idea could not be created. Please try again.");
        toast.error("Idea could not be created. Please try again.");
        void fetchIdeas();
        return null;
      }

      toast.success("Idea created successfully");

      // Optimistic update
      setIdeas([createdIdea, ...useAppStore.getState().ideas]);

      awardXP(userId, XP_REWARDS.CREATE_IDEA, "create_idea").catch(
        (err) => logger.error("Failed to award XP", err),
      );

      return createdIdea;
    },
    [userId, setIdeas, fetchIdeas],
  );

  const updateIdea = useCallback(
    async (
      ideaId: string,
      updates: Partial<Idea>,
      oldStage?: IdeaStage,
    ): Promise<boolean> => {
      // Optimistic update
      let optimisticSnapshot: Idea | null = null;
      const currentIdeas = useAppStore.getState().ideas;
      const previousIdeas = [...currentIdeas];

      setIdeas(
        currentIdeas.map((idea) => {
          if (idea.id === ideaId) {
            optimisticSnapshot = idea;
            const rawDescription = Object.prototype.hasOwnProperty.call(
              updates,
              "description",
            )
              ? (updates.description ?? "").toString().trim()
              : (idea.description ?? "");
            const mergedDescription = rawDescription
              ? rawDescription
              : undefined;
            const merged: Idea = {
              ...idea,
              ...updates,
              title: (updates.title ?? idea.title).trim(),
              ...(mergedDescription !== undefined ? { description: mergedDescription } : {}),
              stage: updates.stage ?? idea.stage,
              linked_note_ids:
                updates.linked_note_ids ?? idea.linked_note_ids ?? [],
              linked_paper_ids:
                updates.linked_paper_ids ?? idea.linked_paper_ids ?? [],
              updated_at: new Date().toISOString(),
            };
            syncSelectedIdea(merged);
            return merged;
          }
          return idea;
        }),
      );

      // We proceed even without candidate check because we trust the ID exists if update is called
      if (!userId) {
        // ... auth check
        setIdeas(previousIdeas); // Revert
        if (optimisticSnapshot) syncSelectedIdea(optimisticSnapshot);
        return false;
      }

      // Use previousIdeas (which is safe snapshot before optimistic update) to get the base for RPC
      const ideaToUpdate = previousIdeas.find((i) => i.id === ideaId);
      if (!ideaToUpdate) return false;

      const rawDescription = Object.prototype.hasOwnProperty.call(
        updates,
        "description",
      )
        ? (updates.description ?? "").toString().trim()
        : (ideaToUpdate.description ?? "");
      const mergedDescription = rawDescription ? rawDescription : undefined;

      const mergedForRPC = {
        ...ideaToUpdate,
        ...updates,
        title: (updates.title ?? ideaToUpdate.title).trim(),
        description: mergedDescription,
        stage: updates.stage ?? ideaToUpdate.stage,
        linked_note_ids:
          updates.linked_note_ids ?? ideaToUpdate.linked_note_ids ?? [],
        linked_paper_ids:
          updates.linked_paper_ids ?? ideaToUpdate.linked_paper_ids ?? [],
      };

      if (mergedForRPC.title.length > IDEA_TITLE_MAX_LENGTH) {
        const msg = `Idea title exceeds ${IDEA_TITLE_MAX_LENGTH} characters`;
        setError(msg);
        toast.error(msg);
        if (optimisticSnapshot) {
          const freshIdeas = useAppStore.getState().ideas;
          setIdeas(
            freshIdeas.map((i) =>
              i.id === ideaId ? (optimisticSnapshot as Idea) : i,
            ),
          );
          syncSelectedIdea(optimisticSnapshot);
        } else {
          void fetchIdeas();
        }
        return false;
      }

      if (
        (mergedForRPC.description?.length ?? 0) > IDEA_DESCRIPTION_MAX_LENGTH
      ) {
        const msg = `Idea description exceeds ${IDEA_DESCRIPTION_MAX_LENGTH} characters`;
        setError(msg);
        toast.error(msg);
        if (optimisticSnapshot) {
          const freshIdeas = useAppStore.getState().ideas;
          setIdeas(
            freshIdeas.map((i) =>
              i.id === ideaId ? (optimisticSnapshot as Idea) : i,
            ),
          );
          syncSelectedIdea(optimisticSnapshot);
        } else {
          void fetchIdeas();
        }
        return false;
      }

      const { data, error: updateError } = await supabase.rpc(
        IDEA_TRANSACTION_RPC,
        {
          p_user_id: userId,
          p_idea_id: ideaId,
          p_title: mergedForRPC.title,
          p_description: mergedForRPC.description ?? null,
          p_stage: mergedForRPC.stage,
          p_linked_note_ids: mergedForRPC.linked_note_ids ?? [],
          p_linked_paper_ids: mergedForRPC.linked_paper_ids ?? [],
        },
      );

      if (updateError) {
        // Revert on error - partial revert to be safe against concurrent updates
        if (optimisticSnapshot) {
          const freshIdeas = useAppStore.getState().ideas;
          setIdeas(
            freshIdeas.map((i) =>
              i.id === ideaId ? (optimisticSnapshot as Idea) : i,
            ),
          );
          syncSelectedIdea(optimisticSnapshot);
        } else {
          // Fallback if snapshot missing
          void fetchIdeas();
        }
        return false;
      }

      const updatedIdea = (data as Idea | null) ?? null;

      if (updatedIdea) {
        setIdeas(
          useAppStore
            .getState()
            .ideas.map((idea) =>
              idea.id === updatedIdea.id ? updatedIdea : idea,
            ),
        );
        syncSelectedIdea(updatedIdea);
      }

      if (updates.stage && updates.stage !== oldStage) {
        toast.success(`Idea stage updated to ${updates.stage}`);
      }

      if (updates.stage && oldStage && updates.stage !== oldStage && userId) {
        const stages: IdeaStage[] = [
          "Seed",
          "Developing",
          "Supported",
          "Mature",
        ];
        const oldIndex = stages.indexOf(oldStage);
        const newIndex = stages.indexOf(updates.stage);

        if (newIndex > oldIndex) {
          awardXP(
            userId,
            XP_REWARDS.ADVANCE_IDEA_STAGE,
            "advance_idea_stage",
          ).catch((err) => logger.error("Failed to award XP", err));
        }
      }

      return true;
    },
    [userId, setIdeas, syncSelectedIdea, fetchIdeas],
  );

  const deleteIdea = useCallback(
    async (ideaId: string): Promise<boolean> => {
      if (!userId) {
        setError("User not authenticated");
        toast.error("You must be logged in to delete ideas");
        return false;
      }

      const currentIdeas = useAppStore.getState().ideas;
      const deletedIdea = currentIdeas.find((i) => i.id === ideaId);

      // Optimistic delete
      setIdeas(currentIdeas.filter((idea) => idea.id !== ideaId));

      const current = useAppStore.getState().selectedIdea;
      if (current?.id === ideaId) {
        setSelectedIdea(null);
      }

      const { error: deleteError } = await supabase
        .from("ideas")
        .delete()
        .eq("id", ideaId)
        .eq("user_id", userId);

      if (deleteError) {
        // Revert on error
        if (deletedIdea) {
          setIdeas([deletedIdea, ...useAppStore.getState().ideas]);
          syncSelectedIdea(deletedIdea);
        }
        return false;
      }

      return true;
    },
    [userId, setIdeas, setSelectedIdea, syncSelectedIdea],
  );

  const restoreIdea = useCallback(
    async (idea: Idea): Promise<Idea | null> => {
      if (!userId) {
        setError("User not authenticated");
        toast.error("You must be logged in to restore ideas");
        return null;
      }

      const payload = {
        ...idea,
        user_id: userId,
        updated_at: new Date().toISOString(),
      };

      const { data, error: restoreError } = await supabase
        .from("ideas")
        .upsert(payload, { onConflict: "id" })
        .select()
        .single();

      if (restoreError) {
        const errorMessage = restoreError.message || "Unknown error occurred";
        toast.error(`Failed to restore idea: ${errorMessage}`);
        return null;
      }

      const restoredIdea = data as Idea;
      const currentIdeas = useAppStore.getState().ideas;
      setIdeas([
        restoredIdea,
        ...currentIdeas.filter((existing) => existing.id !== restoredIdea.id),
      ]);

      toast.success("Idea restored");
      return restoredIdea;
    },
    [setIdeas],
  );

  return {
    ideas,
    loading,
    error,
    createIdea,
    updateIdea,
    deleteIdea,
    restoreIdea,
    refreshIdeas: fetchIdeas,
  };
}

import { create } from "zustand";
import type { FeedItem } from "../types/database";

export interface FeedItemsSlice {
  items: FeedItem[];
  loading: boolean;
  error: string | null;
  setItems: (
    items: FeedItem[] | ((previous: FeedItem[]) => FeedItem[]),
  ) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useFeedItemsStore = create<FeedItemsSlice>()((set) => ({
  items: [],
  loading: true,
  error: null,
  setItems: (items) =>
    set((state) => ({
      items: typeof items === "function" ? items(state.items) : items,
    })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));

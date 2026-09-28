import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeedsView } from "../../../components/feeds/FeedsView";
import { useAppStore } from "../../../store/appStore";
import type { FeedItem } from "../../../types/database";

const orphanItem: FeedItem = {
  id: "feed-item-orphan",
  user_id: "test-user",
  source_id: null,
  type: "paper",
  title: "Orphan paper lead",
  summary: "Should still appear with 0 sources.",
  url: "https://example.com/paper",
  payload: {},
  status: "new",
  external_id: "paper-orphan",
  published_at: "2026-09-24T12:00:00Z",
  created_at: "2026-09-24T12:00:00Z",
  updated_at: "2026-09-24T12:00:00Z",
};

const hookState = {
  items: [orphanItem] as FeedItem[],
  totalCount: 1,
  loading: false,
  loadingOlder: false,
  hasMore: false,
  error: null as string | null,
  actionItemId: null as string | null,
  refreshFeedItems: vi.fn(),
  archiveFeedItem: vi.fn(),
  markFeedItemTriaged: vi.fn(),
  promoteFeedItem: vi.fn(),
  loadOlderFeedItems: vi.fn(),
  archiveMatchingFeedItems: vi.fn(),
};

vi.mock("../../../hooks/useFeedItems", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../hooks/useFeedItems")>();
  return {
    ...actual,
    useFeedItems: () => hookState,
  };
});

vi.mock("../../../components/feeds/FeedSourcesPanel", () => ({
  FeedSourcesPanel: () => null,
}));

describe("FeedsView", () => {
  beforeEach(() => {
    hookState.items = [orphanItem];
    hookState.totalCount = 1;
    hookState.loading = false;
    hookState.loadingOlder = false;
    hookState.hasMore = false;
    hookState.error = null;
    hookState.actionItemId = null;
    hookState.refreshFeedItems.mockReset();
    hookState.archiveFeedItem.mockReset();
    hookState.markFeedItemTriaged.mockReset();
    hookState.promoteFeedItem.mockReset();
    hookState.loadOlderFeedItems.mockReset();
    hookState.archiveMatchingFeedItems.mockReset();
    useAppStore.setState({
      user: {
        id: "test-user",
        email: "test@example.com",
      } as never,
    });
  });

  it("lists orphan feed_items even when feed_sources is empty", async () => {
    render(<FeedsView />);

    expect(await screen.findByText("Orphan paper lead")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Feed filters" })).toBeInTheDocument();
    expect(
      screen.getByText(/source and RSS management is not fully shipped/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/inbox stays empty/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/orphan items without a source are not shown/i),
    ).not.toBeInTheDocument();
  });

  it("shows the exact filtered count, not the loaded page length", () => {
    hookState.totalCount = 859;
    hookState.hasMore = true;
    render(<FeedsView />);

    expect(screen.getByText(/1 of 859 items/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/latest 100/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /load older/i }),
    ).toBeInTheDocument();
  });

  it("loads the next keyset page from Load older", async () => {
    hookState.totalCount = 200;
    hookState.hasMore = true;
    const user = userEvent.setup();
    render(<FeedsView />);

    await user.click(screen.getByRole("button", { name: /load older/i }));
    expect(hookState.loadOlderFeedItems).toHaveBeenCalledTimes(1);
  });

  it("confirms archive-all against the matching count", async () => {
    hookState.totalCount = 18;
    const user = userEvent.setup();
    render(<FeedsView />);

    await user.click(
      screen.getByRole("button", { name: /archive all matching/i }),
    );
    expect(hookState.archiveMatchingFeedItems).toHaveBeenCalledTimes(1);
  });

  it("keeps the demo empty-state heading and says items arrive from agent or API key", () => {
    hookState.items = [];
    hookState.totalCount = 0;
    render(<FeedsView />);

    expect(
      screen.getByRole("heading", { name: /nothing to triage/i }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/arrive from your connected agent or API key/i)
        .length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByText(/nothing arrives on its own/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/must add everything manually/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /show all/i }),
    ).not.toBeInTheDocument();
  });

  it("keeps loaded items visible when Load older fails", () => {
    hookState.error = "n.or is not a function";
    hookState.hasMore = true;
    hookState.totalCount = 200;
    render(<FeedsView />);

    expect(screen.getByText("Orphan paper lead")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/n\.or is not a function/i);
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /load older/i })).toBeInTheDocument();
  });
});

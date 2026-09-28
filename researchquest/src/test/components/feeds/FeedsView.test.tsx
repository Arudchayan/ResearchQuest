import { fireEvent, render, screen } from "@testing-library/react";
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

const { mockUseFeedItems, navigateToViewMock } = vi.hoisted(() => ({
  mockUseFeedItems: vi.fn(),
  navigateToViewMock: vi.fn(),
}));

vi.mock("../../../hooks/useFeedItems", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../hooks/useFeedItems")>();
  return {
    ...actual,
    useFeedItems: mockUseFeedItems,
  };
});

vi.mock("../../../lib/softNavigation", () => ({
  navigateToView: navigateToViewMock,
}));

vi.mock("../../../components/feeds/FeedSourcesPanel", () => ({
  FeedSourcesPanel: () => null,
}));

function stubFeedItems(items: FeedItem[]) {
  mockUseFeedItems.mockReturnValue({
    items,
    loading: false,
    error: null,
    actionItemId: null,
    refreshFeedItems: vi.fn(),
    archiveFeedItem: vi.fn(),
    markFeedItemTriaged: vi.fn(),
    promoteFeedItem: vi.fn(),
    updateFeedItemsStatusBatch: vi.fn(),
  });
}

describe("FeedsView", () => {
  beforeEach(() => {
    navigateToViewMock.mockReset();
    stubFeedItems([orphanItem]);
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

  it("offers Show all and Open Papers when the default New filter is empty", () => {
    stubFeedItems([]);
    render(<FeedsView />);

    expect(
      screen.getByRole("heading", { name: /nothing matches these filters/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/add a source above/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show all" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open Papers" }));
    expect(navigateToViewMock).toHaveBeenCalledWith("papers");
  });

  it("keeps Feeds visible and points to the library when every filter is empty", () => {
    stubFeedItems([]);
    render(<FeedsView />);

    fireEvent.click(screen.getByRole("button", { name: "Show all" }));

    expect(
      screen.getByRole("heading", { name: /nothing to triage/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/nothing arrives on its own/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open Papers" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Show all" }),
    ).not.toBeInTheDocument();
  });
});

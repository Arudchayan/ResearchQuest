import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FeedsView } from "../../../components/feeds/FeedsView";
import { FeedItemCard } from "../../../components/feeds/FeedItemCard";
import type { FeedItem } from "../../../types/database";

vi.mock("../../../hooks/useFeedItems", () => ({
  FEED_ITEM_TYPES: ["paper", "job", "news", "custom"],
  FEED_ITEM_STATUSES: ["new", "triaged", "archived", "promoted"],
  useFeedItems: () => ({
    items: [],
    loading: false,
    error: null,
    actionItemId: null,
    refreshFeedItems: vi.fn(),
    archiveFeedItem: vi.fn(),
    markFeedItemTriaged: vi.fn(),
    promoteFeedItem: vi.fn(),
  }),
}));

// DESIGN contract (plan item 64): legacy Feeds tokens must not render.
const LEGACY_CLASS_PATTERN =
  /surface-card|accent-soft|accent-strong|outline-accent|border-accent|violet-soft|violet-strong|blue-soft|blue-strong|gold-soft|gold-strong|status-chip|section-kicker|icon-tile|rounded-full/;

function renderedClasses(container: HTMLElement): string {
  return Array.from(container.querySelectorAll("[class]"))
    .map((element) => element.getAttribute("class") ?? "")
    .join(" ");
}

const feedItem: FeedItem = {
  id: "feed-item-1",
  user_id: "user-1",
  source_id: null,
  type: "paper",
  title: "Attention Is All You Need",
  summary: "A transformer paper worth triaging.",
  url: "https://example.com/paper",
  payload: {},
  status: "new",
  external_id: "paper-1",
  published_at: "2026-07-20T12:00:00Z",
  created_at: "2026-07-20T12:00:00Z",
  updated_at: "2026-07-20T12:00:00Z",
};

describe("Feeds DESIGN contract", () => {
  it("renders FeedsView without legacy surface-card/accent/rounded-full classes", () => {
    const { container } = render(<FeedsView />);
    expect(screen.getByRole("heading", { name: "Feeds" })).toBeInTheDocument();
    expect(renderedClasses(container)).not.toMatch(LEGACY_CLASS_PATTERN);
  });

  it("renders selected FeedsView filters on primary + rounded-control", () => {
    const { container } = render(<FeedsView />);
    const selected = Array.from(
      container.querySelectorAll('button[aria-pressed="true"]'),
    );
    expect(selected.length).toBeGreaterThan(0);
    for (const chip of selected) {
      expect(chip.getAttribute("class")).toContain("border-primary-500");
      expect(chip.getAttribute("class")).toContain("rounded-control");
    }
  });

  it("renders FeedItemCard on Card anatomy with semantic chips", () => {
    const { container } = render(
      <FeedItemCard
        item={feedItem}
        onArchive={vi.fn()}
        onMarkTriaged={vi.fn()}
        onPromote={vi.fn()}
      />,
    );
    expect(renderedClasses(container)).not.toMatch(LEGACY_CLASS_PATTERN);
    expect(container.querySelector("article")?.getAttribute("class")).toContain(
      "rounded-surface",
    );
  });
});

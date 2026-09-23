import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FeedItemCard } from "../../../components/feeds/FeedItemCard";
import type { FeedItem } from "../../../types/database";

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

describe("FeedItemCard", () => {
  it("renders feed metadata and calls promote action with selected target", async () => {
    const onPromote = vi.fn();
    const onArchive = vi.fn();
    const user = userEvent.setup();

    render(
      <FeedItemCard
        item={feedItem}
        onArchive={onArchive}
        onPromote={onPromote}
      />,
    );

    expect(screen.getByText("Paper")).toBeInTheDocument();
    expect(screen.getByText("new")).toBeInTheDocument();
    expect(screen.getByText("Attention Is All You Need")).toBeInTheDocument();
    expect(screen.getByText("A transformer paper worth triaging.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open source/i })).toHaveAttribute(
      "href",
      "https://example.com/paper",
    );

    await user.click(
      screen.getByRole("button", {
        name: /promote attention is all you need to task/i,
      }),
    );

    expect(onPromote).toHaveBeenCalledWith("feed-item-1", "task");
    expect(onArchive).not.toHaveBeenCalled();
  });

  it("renders unsafe feed item URLs without a link", () => {
    render(
      <FeedItemCard
        item={{ ...feedItem, url: "javascript:alert(1)" }}
      />,
    );

    expect(
      screen.queryByRole("link", { name: /open source/i }),
    ).not.toBeInTheDocument();
    const fallback = screen.getByText("Open source");
    expect(fallback).toBeInTheDocument();
    expect(fallback).toHaveAttribute("title", expect.stringContaining("unsafe"));
  });

  it("disables only the busy promote action, leaving other actions usable", async () => {
    const onPromote = vi.fn();
    const onArchive = vi.fn();
    const user = userEvent.setup();

    render(
      <FeedItemCard
        item={feedItem}
        onArchive={onArchive}
        onPromote={onPromote}
        busyAction={{ itemId: "feed-item-1", action: "promote" }}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: /promote attention is all you need to task/i,
      }),
    ).toBeDisabled();
    const archiveButton = screen.getByRole("button", { name: /archive/i });
    expect(archiveButton).toBeEnabled();

    await user.click(archiveButton);
    expect(onArchive).toHaveBeenCalledWith("feed-item-1");
  });

  it("keeps the shared actionItemId fallback disabling all actions", () => {
    const noop = () => {};
    render(
      <FeedItemCard
        item={feedItem}
        actionItemId="feed-item-1"
        onArchive={noop}
        onMarkTriaged={noop}
        onPromote={noop}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: /promote attention is all you need to task/i,
      }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: /archive/i })).toBeDisabled();
  });

  it("renders the source link in compact mode and the triaged badge", () => {
    render(
      <FeedItemCard
        item={{ ...feedItem, status: "triaged" }}
        compact
      />,
    );

    expect(screen.getByText("triaged")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open source/i })).toHaveAttribute(
      "href",
      "https://example.com/paper",
    );
  });
});

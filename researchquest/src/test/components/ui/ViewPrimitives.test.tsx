import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/PageHeader";
import { AppLoadingSkeleton } from "@/components/ui/Skeleton";

describe("view primitives", () => {
  it("renders a page header with title, description, and actions", () => {
    render(
      <PageHeader
        title="Research library"
        description="Keep the sources that shape your next idea close at hand."
        actions={<Button>New paper</Button>}
      />,
    );

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Research library" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Keep the sources that shape your next idea close at hand."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New paper" })).toBeInTheDocument();
  });

  it("supports an explicit heading level without changing the visual contract", () => {
    render(<PageHeader headingLevel={2} title="Research library" />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Research library" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });

  it("renders every supported badge semantic variant with its tokenized class", () => {
    const variants: readonly BadgeVariant[] = [
      "neutral",
      "stage-seed",
      "stage-developing",
      "stage-supported",
      "stage-mature",
      "priority-high",
      "priority-medium",
      "priority-low",
      "priority-overdue",
      "success",
      "warning",
      "purple",
      "destructive",
    ];
    const classes = {
      neutral: "bg-bg-elevated",
      "stage-seed": "bg-stage-seed-bg",
      "stage-developing": "bg-stage-developing-bg",
      "stage-supported": "bg-stage-supported-bg",
      "stage-mature": "bg-stage-mature-bg",
      "priority-high": "bg-priority-high-bg",
      "priority-medium": "bg-priority-medium-bg",
      "priority-low": "bg-priority-low-bg",
      "priority-overdue": "bg-priority-overdue-bg",
      success: "bg-success-bg",
      warning: "bg-warning-bg",
      purple: "bg-purple-bg",
      destructive: "bg-destructive-bg",
    } satisfies Record<BadgeVariant, string>;

    render(
      <div>
        {variants.map((variant) => (
          <Badge key={variant} variant={variant} data-testid={`badge-${variant}`}>
            {variant}
          </Badge>
        ))}
      </div>,
    );

    for (const variant of variants) {
      expect(screen.getByTestId(`badge-${variant}`)).toHaveClass(classes[variant]);
    }
  });

  it("exposes empty state status semantics and runs its action", async () => {
    const user = userEvent.setup();
    const handleAction = vi.fn();

    render(
      <EmptyState
        icon={<span data-testid="empty-state-icon">∅</span>}
        title="No papers yet"
        description="Add a paper to start building your research library."
        action={<Button onClick={handleAction}>Add paper</Button>}
      />,
    );

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("No papers yet")).toBeInTheDocument();
    expect(screen.getByText("Add a paper to start building your research library.")).toBeInTheDocument();
    expect(
      screen.getByTestId("empty-state-icon").closest("[aria-hidden='true']"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add paper" }));

    expect(handleAction).toHaveBeenCalledOnce();
  });

  it("keeps disabled buttons unavailable", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(
      <Button disabled onClick={handleClick}>
        Continue
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Continue" });
    expect(button).toBeDisabled();

    await user.click(button);

    expect(handleClick).not.toHaveBeenCalled();
  });

  it("keeps default controls touch-safe on mobile", () => {
    render(
      <div>
        <Button>Continue</Button>
        <Input aria-label="Search" />
      </div>,
    );

    expect(screen.getByRole("button", { name: "Continue" })).toHaveClass(
      "min-h-11",
    );
    expect(screen.getByRole("textbox", { name: "Search" })).toHaveClass(
      "min-h-11",
    );
    expect(screen.getByRole("textbox", { name: "Search" })).toHaveClass(
      "focus-visible:ring-2",
    );
  });

  it("accepts a bounded class override for the app loading skeleton", () => {
    render(<AppLoadingSkeleton className="min-h-0 h-64" />);

    expect(screen.getByRole("status")).toHaveClass("min-h-0", "h-64");
  });
});

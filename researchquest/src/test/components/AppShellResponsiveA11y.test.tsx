import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "../../components/layout/v2/AppShell";
import { useAppStore } from "../../store/appStore";
import { TooltipProvider } from "../../components/ui/tooltip";

vi.mock("../../components/layout/v2/Sidebar", () => ({
  Sidebar: () => <a href="/notes">Notes</a>,
}));

vi.mock("../../components/layout/RightSidebar", () => ({
  RightSidebar: () => <div>Context panel</div>,
}));

function renderShell() {
  return render(
    <TooltipProvider>
      <AppShell>
        <button type="button">Main action</button>
      </AppShell>
    </TooltipProvider>,
  );
}

describe("AppShell responsive drawer accessibility", () => {
  beforeEach(() => {
    useAppStore.setState({
      isMobileSidebarOpen: false,
      isRightSidebarOpen: false,
      isZenMode: false,
    });
  });

  it("uses a dynamic viewport minimum height and a shrinkable content column", () => {
    renderShell();

    expect(screen.getByTestId("app-shell")).toHaveClass("min-h-[100dvh]");
    expect(screen.getByTestId("app-shell-content")).toHaveClass("min-w-0");
  });

  it("opens the mobile navigation as a modal drawer and makes main content inert", async () => {
    renderShell();

    const openButton = screen.getByRole("button", { name: "Open sidebar" });
    fireEvent.click(openButton);

    const drawer = await screen.findByRole("dialog", { name: "Main navigation" });
    expect(drawer).toHaveAttribute("aria-modal", "true");
    expect(screen.getByTestId("app-shell-content")).toHaveAttribute("inert");
    await waitFor(() => expect(screen.getByRole("button", { name: "Close sidebar" })).toHaveFocus());
  });

  it("traps focus inside the mobile drawer", async () => {
    useAppStore.setState({ isMobileSidebarOpen: true });
    renderShell();

    const drawer = await screen.findByRole("dialog", { name: "Main navigation" });
    const firstFocusable = screen.getAllByRole("link", { name: "Notes" })[1];
    const closeButton = screen.getByRole("button", { name: "Close sidebar" });

    closeButton.focus();
    fireEvent.keyDown(drawer, { key: "Tab" });
    expect(firstFocusable).toHaveFocus();

    fireEvent.keyDown(drawer, { key: "Tab", shiftKey: true });
    expect(closeButton).toHaveFocus();
  });

  it("closes the mobile drawer with Escape and restores trigger focus", async () => {
    renderShell();

    const openButton = screen.getByRole("button", { name: "Open sidebar" });
    fireEvent.click(openButton);
    await screen.findByRole("dialog", { name: "Main navigation" });

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Main navigation" })).not.toBeInTheDocument());
    expect(openButton).toHaveFocus();
  });

  it("gives primary mobile controls 44px targets with visible focus treatment", () => {
    renderShell();

    for (const name of ["Open sidebar", "Open search"]) {
      const control = screen.getByRole("button", { name });
      expect(control).toHaveClass("min-h-11", "min-w-11", "focus-visible:outline-2");
    }
  });

  it("only renders the right panel at the xl breakpoint and removes it when closed", () => {
    const { rerender } = renderShell();
    expect(screen.queryByTestId("right-panel")).not.toBeInTheDocument();

    useAppStore.setState({ isRightSidebarOpen: true });
    rerender(
      <TooltipProvider>
        <AppShell>
          <button type="button">Main action</button>
        </AppShell>
      </TooltipProvider>,
    );

    expect(screen.getByTestId("right-panel")).toHaveClass("hidden", "xl:flex", "w-80");
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FormDialog } from "@/components/ui/FormDialog";
import { Input } from "@/components/ui/input";

function FormDialogHarness({ isLoading = false }: { readonly isLoading?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        Open form dialog
      </button>
      <FormDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSubmit={(event) => event.preventDefault()}
        title="Create paper"
        isLoading={isLoading}
      >
        <Input aria-label="Paper title" />
      </FormDialog>
    </>
  );
}

function ConfirmDialogHarness({ isLoading = false }: { readonly isLoading?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        Open confirm dialog
      </button>
      <ConfirmDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onConfirm={() => undefined}
        title="Delete paper"
        message="This cannot be undone."
        isLoading={isLoading}
      />
    </>
  );
}

describe("dialog focus management", () => {
  it("moves focus into FormDialog and returns it to the opening trigger", async () => {
    const user = userEvent.setup();
    render(<FormDialogHarness />);

    const trigger = screen.getByRole("button", { name: "Open form dialog" });
    await user.click(trigger);

    expect(screen.getByRole("textbox", { name: "Paper title" })).toHaveFocus();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  it("keeps a loading FormDialog open when its backdrop is clicked", async () => {
    const user = userEvent.setup();
    render(<FormDialogHarness isLoading />);

    await user.click(screen.getByRole("button", { name: "Open form dialog" }));
    const overlay = document.querySelector<HTMLElement>(".bg-overlay");

    if (!(overlay instanceof HTMLElement)) {
      throw new Error("FormDialog overlay is missing");
    }

    await user.click(overlay);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("focuses the cancel action in ConfirmDialog and returns focus on close", async () => {
    const user = userEvent.setup();
    render(<ConfirmDialogHarness />);

    const trigger = screen.getByRole("button", { name: "Open confirm dialog" });
    await user.click(trigger);

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    expect(cancelButton).toHaveFocus();

    await user.click(cancelButton);

    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  it("exposes modal semantics and mobile-safe controls in ConfirmDialog", async () => {
    const user = userEvent.setup();
    render(<ConfirmDialogHarness />);

    await user.click(screen.getByRole("button", { name: "Open confirm dialog" }));

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "Close dialog" })).toHaveClass(
      "min-h-11",
      "min-w-11",
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveClass("min-h-11");
    expect(screen.getByRole("button", { name: "Confirm" })).toHaveClass("min-h-11");
  });

  it("exposes mobile-safe controls in FormDialog", async () => {
    const user = userEvent.setup();
    render(<FormDialogHarness />);

    await user.click(screen.getByRole("button", { name: "Open form dialog" }));

    expect(screen.getByRole("button", { name: "Close dialog" })).toHaveClass(
      "min-h-11",
      "min-w-11",
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveClass("min-h-11");
    expect(screen.getByRole("button", { name: "Submit" })).toHaveClass("min-h-11");
  });

  it("keeps a loading ConfirmDialog open when its backdrop is clicked", async () => {
    const user = userEvent.setup();
    render(<ConfirmDialogHarness isLoading />);

    await user.click(screen.getByRole("button", { name: "Open confirm dialog" }));
    const overlay = document.querySelector<HTMLElement>(".bg-overlay");

    if (!(overlay instanceof HTMLElement)) {
      throw new Error("ConfirmDialog overlay is missing");
    }

    await user.click(overlay);

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("renders FormDialog at the stacked-modal z-index above Radix dialogs", async () => {
    const user = userEvent.setup();
    render(<FormDialogHarness />);

    await user.click(screen.getByRole("button", { name: "Open form dialog" }));
    const overlay = document.querySelector<HTMLElement>(".bg-overlay");

    if (!(overlay instanceof HTMLElement)) {
      throw new Error("FormDialog overlay is missing");
    }

    expect(overlay).toHaveClass("z-modal-stacked");
    expect(overlay).not.toHaveClass("z-modal");
  });

  it("renders ConfirmDialog at the stacked-modal z-index above Radix dialogs", async () => {
    const user = userEvent.setup();
    render(<ConfirmDialogHarness />);

    await user.click(screen.getByRole("button", { name: "Open confirm dialog" }));
    const overlay = document.querySelector<HTMLElement>(".bg-overlay");

    if (!(overlay instanceof HTMLElement)) {
      throw new Error("ConfirmDialog overlay is missing");
    }

    expect(overlay).toHaveClass("z-modal-stacked");
    expect(overlay).not.toHaveClass("z-modal");
  });
});

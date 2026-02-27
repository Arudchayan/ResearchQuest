import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ShortcutsDialog } from "../../components/layout/ShortcutsDialog";

describe("ShortcutsDialog", () => {
  it("is closed by default", () => {
    render(<ShortcutsDialog />);
    expect(screen.queryByText("Keyboard Shortcuts")).not.toBeInTheDocument();
  });

  it("opens when ? is pressed", async () => {
    render(<ShortcutsDialog />);
    fireEvent.keyDown(document, { key: "?", shiftKey: true });

    await waitFor(() => {
      expect(screen.getByText("Keyboard Shortcuts")).toBeInTheDocument();
    });
  });

  it("renders general shortcuts", async () => {
    render(<ShortcutsDialog />);
    fireEvent.keyDown(document, { key: "?", shiftKey: true });

    await waitFor(() => {
      expect(screen.getByText("Open Command Palette")).toBeInTheDocument();
      expect(screen.getByText("Show Keyboard Shortcuts")).toBeInTheDocument();
    });
  });

  it("does not open when typing in input", async () => {
    render(
      <div>
        <input data-testid="test-input" />
        <ShortcutsDialog />
      </div>,
    );

    const input = screen.getByTestId("test-input");
    input.focus();

    fireEvent.keyDown(input, { key: "?", shiftKey: true });

    expect(screen.queryByText("Keyboard Shortcuts")).not.toBeInTheDocument();
  });

  it("opens on custom event", async () => {
    render(<ShortcutsDialog />);

    document.dispatchEvent(new CustomEvent("open-shortcuts-help"));

    await waitFor(() => {
      expect(screen.getByText("Keyboard Shortcuts")).toBeInTheDocument();
    });
  });
});

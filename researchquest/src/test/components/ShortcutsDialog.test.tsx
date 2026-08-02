import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { ShortcutsDialog } from "../../components/layout/ShortcutsDialog";
import { useAppStore } from "../../store/appStore";

describe("ShortcutsDialog", () => {
  beforeEach(() => {
    useAppStore.setState({ currentView: "dashboard" });
  });

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

  it.each(["dashboard", "focus", "feeds"] as const)(
    "leaves Mod+E alone on the %s route",
    (currentView) => {
      useAppStore.setState({ currentView });
      const exportListener = vi.fn();
      document.addEventListener("export-current-view", exportListener);

      render(<ShortcutsDialog />);
      const event = new KeyboardEvent("keydown", {
        key: "e",
        ctrlKey: true,
        cancelable: true,
      });
      document.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(false);
      expect(exportListener).not.toHaveBeenCalled();
      document.removeEventListener("export-current-view", exportListener);
    },
  );

  it("exports on an export-capable route", () => {
    useAppStore.setState({ currentView: "notes" });
    const exportListener = vi.fn();
    document.addEventListener("export-current-view", exportListener);

    render(<ShortcutsDialog />);
    const event = new KeyboardEvent("keydown", {
      key: "e",
      ctrlKey: true,
      cancelable: true,
    });
    document.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(exportListener).toHaveBeenCalledTimes(1);
    document.removeEventListener("export-current-view", exportListener);
  });

  it.each(["input", "textarea", "contenteditable"] as const)(
    "does not intercept Mod+E in a focused %s",
    (elementType) => {
      useAppStore.setState({ currentView: "notes" });
      const exportListener = vi.fn();
      document.addEventListener("export-current-view", exportListener);
      const element = document.createElement(
        elementType === "contenteditable" ? "div" : elementType,
      );
      if (elementType === "contenteditable") {
        element.setAttribute("contenteditable", "true");
      }
      document.body.appendChild(element);
      element.focus();

      render(<ShortcutsDialog />);
      const event = new KeyboardEvent("keydown", {
        key: "e",
        ctrlKey: true,
        cancelable: true,
        bubbles: true,
      });
      element.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(false);
      expect(exportListener).not.toHaveBeenCalled();
      element.remove();
      document.removeEventListener("export-current-view", exportListener);
    },
  );

  it("opens on custom event", async () => {
    render(<ShortcutsDialog />);

    document.dispatchEvent(new CustomEvent("open-shortcuts-help"));

    await waitFor(() => {
      expect(screen.getByText("Keyboard Shortcuts")).toBeInTheDocument();
    });
  });
});

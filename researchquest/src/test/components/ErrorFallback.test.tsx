import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorFallback } from "../../components/ui/ErrorFallback";

describe("ErrorFallback", () => {
  it("renders outside a router provider", () => {
    render(<ErrorFallback error={new Error("Missing config")} />);

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("names stale chunks honestly and hard-reloads instead of resetError-looping", () => {
    const reload = vi.fn();
    const descriptor = Object.getOwnPropertyDescriptor(window, "location");
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload },
    });
    try {
      const resetError = vi.fn();
      render(
        <ErrorFallback
          error={
            new Error(
              "Failed to fetch dynamically imported module: /assets/TaskManager-abc.js",
            )
          }
          resetError={resetError}
        />,
      );

      expect(
        screen.getByText(/was updated while this tab was open/i),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /try again/i }));
      expect(reload).toHaveBeenCalledTimes(1);
      expect(resetError).not.toHaveBeenCalled();
    } finally {
      if (descriptor) {
        Object.defineProperty(window, "location", descriptor);
      }
    }
  });
});

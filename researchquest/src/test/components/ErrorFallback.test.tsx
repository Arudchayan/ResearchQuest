import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ErrorFallback } from "../../components/ui/ErrorFallback";

describe("ErrorFallback", () => {
  it("renders outside a router provider", () => {
    render(<ErrorFallback error={new Error("Missing config")} />);

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});

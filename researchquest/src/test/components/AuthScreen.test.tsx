import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { AuthScreen } from "../../components/auth/AuthScreen";

describe("AuthScreen Security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('shows "Use demo workspace" when not already in demo mode', () => {
    render(<AuthScreen />);
    expect(screen.getByText(/Use demo workspace/i)).toBeInTheDocument();
  });

  it("does not render Google sign-in", () => {
    render(<AuthScreen />);

    expect(screen.queryByText(/Continue with Google/i)).not.toBeInTheDocument();
  });

  it("does not offer Submit application / sign-up from the auth gate", () => {
    render(<AuthScreen />);

    expect(
      screen.queryByText(/New scholar\? Submit application\./i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Create Account/i }),
    ).not.toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AuthScreen } from "../../components/auth/AuthScreen";
import { DEMO_FIRST_RUN_PATH } from "../../lib/demoData";

vi.mock("../../lib/supabase", () => ({
  isDemoMode: false,
  hasSupabaseConfig: true,
  supabaseConfigErrorMessage: "Missing Supabase environment variables",
  DEMO_MODE_STORAGE_KEY: "rq_demo_mode",
  enableDemoModeAndReload: vi.fn(),
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      resetPasswordForEmail: vi.fn(),
    },
  },
}));

describe("AuthScreen first-run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("shows Scholar Access eyebrow and the exact first-run loop line", () => {
    render(<AuthScreen />);

    expect(screen.getByText(/Scholar Access/i)).toBeInTheDocument();
    expect(
      screen.getByText("One topic. Three papers. A note. A focus session."),
    ).toBeInTheDocument();
  });

  it("makes Use demo workspace a real link CTA (not gated on hydrate) and Sign In quiet", () => {
    render(<AuthScreen />);

    const demoCta = screen.getByRole("link", {
      name: /Use demo workspace/i,
    });
    const signInButton = screen.getByRole("button", { name: /^Sign In$/i });

    expect(demoCta).toHaveAttribute("href", DEMO_FIRST_RUN_PATH);
    expect(demoCta).toHaveAttribute("data-rq-demo-entry");
    expect(demoCta.className).toMatch(/\bbg-black\b/);
    expect(demoCta.className).not.toMatch(/bg-primary-500/);
    expect(signInButton.className).not.toMatch(/\bbg-black\b|bg-primary-500/);
    expect(signInButton.className).toMatch(
      /border|ghost|bg-transparent|bg-bg-surface/,
    );
  });

  it("does not offer Submit application / sign-up on the first-run screen", () => {
    render(<AuthScreen />);

    expect(
      screen.queryByText(/Submit application/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/New scholar/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Create Account/i }),
    ).not.toBeInTheDocument();
  });
});

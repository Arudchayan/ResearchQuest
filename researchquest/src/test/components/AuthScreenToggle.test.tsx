import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { AuthScreen } from "../../components/auth/AuthScreen";

// Mock Supabase to avoid errors during AuthScreen mount
vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      resetPasswordForEmail: vi.fn(),
    },
  },
}));

describe("AuthScreen Password Toggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("toggles password visibility", () => {
    render(<AuthScreen />);

    // Find password input
    const passwordInput = screen.getByPlaceholderText(/••••••••/i);
    expect(passwordInput).toHaveAttribute("type", "password");

    // Find toggle button (initially "Show password")
    const toggleButton = screen.getByLabelText(/Show password/i);

    // Click to show
    fireEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute("type", "text");
    expect(toggleButton).toHaveAttribute("aria-label", "Hide password");

    // Click to hide
    fireEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute("type", "password");
    expect(toggleButton).toHaveAttribute("aria-label", "Show password");
  });
});

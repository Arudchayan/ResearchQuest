import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { AuthScreen } from "../../components/auth/AuthScreen";
import { mockSupabaseClient } from "../mocks/supabase";

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

<<<<<<< HEAD
  it("validates password strength during signup", async () => {
=======
  it('shows "Use Test Login" button when env vars are present', () => {
    vi.stubEnv("VITE_TEST_EMAIL", "test@example.com");
    vi.stubEnv("VITE_TEST_PASSWORD", "password123");

    render(<AuthScreen />);

    expect(screen.getByText(/Use Test Login/i)).toBeInTheDocument();
  });

  it("uses configured credentials when test login is clicked", async () => {
    const testEmail = "test@example.com";
    const testPassword = "password123";

    vi.stubEnv("VITE_TEST_EMAIL", testEmail);
    vi.stubEnv("VITE_TEST_PASSWORD", testPassword);

    render(<AuthScreen />);

    const button = screen.getByText(/Use Test Login/i);
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
        email: testEmail,
        password: testPassword,
      });
    });
  });

  it("does not offer Submit application / sign-up from the auth gate", () => {
>>>>>>> 0596d8c (fix(first-run): demo click lands on seeded topic loop)
    render(<AuthScreen />);

    expect(
      screen.queryByText(/New scholar\? Submit application\./i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Create Account/i }),
    ).not.toBeInTheDocument();
  });
});

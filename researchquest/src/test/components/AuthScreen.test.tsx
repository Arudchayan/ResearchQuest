import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { AuthScreen } from "../../App";
import { mockSupabaseClient } from "../mocks/supabase";

describe("AuthScreen Security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('does NOT show "Use Test Login" button when env vars are missing', () => {
    // Ensure env vars are not set
    vi.stubEnv("VITE_TEST_EMAIL", "");
    vi.stubEnv("VITE_TEST_PASSWORD", "");

    render(<AuthScreen />);

    expect(screen.queryByText(/Use Test Login/i)).not.toBeInTheDocument();
  });

  it("does not render Google sign-in", () => {
    render(<AuthScreen />);

    expect(screen.queryByText(/Continue with Google/i)).not.toBeInTheDocument();
  });

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

  it("validates password strength during signup", async () => {
    render(<AuthScreen />);

    // Switch to Sign Up
    const toggleButton = screen.getByText(
      /New scholar\? Submit application\./i,
    );
    fireEvent.click(toggleButton);

    // Fill form with weak password
    const emailInput = screen.getByPlaceholderText(/scholar@university\.edu/i);
    const passwordInput = screen.getByPlaceholderText(/••••••••/i);

    fireEvent.change(emailInput, { target: { value: "newuser@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "weak" } }); // Too short

    const submitButton = screen.getByRole("button", {
      name: /Create Account/i,
    });
    fireEvent.click(submitButton);

    // Expect validation error
    await waitFor(() => {
      expect(
        screen.getByText(/Password must be at least 8 characters long/i),
      ).toBeInTheDocument();
    });

    // Ensure signUp was NOT called
    expect(mockSupabaseClient.auth.signUp).not.toHaveBeenCalled();
  });

  it("allows signup with strong password", async () => {
    render(<AuthScreen />);

    // Switch to Sign Up
    const toggleButton = screen.getByText(
      /New scholar\? Submit application\./i,
    );
    fireEvent.click(toggleButton);

    // Fill form with strong password
    const emailInput = screen.getByPlaceholderText(/scholar@university\.edu/i);
    const passwordInput = screen.getByPlaceholderText(/••••••••/i);

    fireEvent.change(emailInput, { target: { value: "newuser@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "StrongP@ss1" } });

    const submitButton = screen.getByRole("button", {
      name: /Create Account/i,
    });
    fireEvent.click(submitButton);

    // Expect signUp to be called
    await waitFor(() => {
      expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith({
        email: "newuser@example.com",
        password: "StrongP@ss1",
      });
    });
  });
});

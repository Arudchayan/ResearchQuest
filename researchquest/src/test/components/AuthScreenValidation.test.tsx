import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { AuthScreen } from "../../components/auth/AuthScreen";
import { mockSupabaseClient } from "../mocks/supabase";

describe("AuthScreen client-side validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows required-field messages on empty submit and does not call auth", async () => {
    const user = userEvent.setup();
    render(<AuthScreen />);

    await user.click(screen.getByRole("button", { name: /^Sign In$/i }));

    const email = screen.getByLabelText(/^Email$/i);
    const password = screen.getByLabelText(/^Password$/i);

    expect(screen.getByText("Enter your email address.")).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
    expect(mockSupabaseClient.auth.signInWithPassword).not.toHaveBeenCalled();

    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAttribute("aria-describedby", "auth-email-error");
    expect(password).toHaveAttribute("aria-invalid", "true");
    expect(password).toHaveAttribute("aria-describedby", "auth-password-error");
    expect(email).toHaveFocus();
  });

  it("treats whitespace-only email as empty and does not call auth", async () => {
    const user = userEvent.setup();
    render(<AuthScreen />);

    await user.type(screen.getByLabelText(/^Email$/i), "   ");
    await user.click(screen.getByRole("button", { name: /^Sign In$/i }));

    expect(screen.getByText("Enter your email address.")).toBeInTheDocument();
    expect(mockSupabaseClient.auth.signInWithPassword).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/^Email$/i)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("does not call auth for an invalid email format", async () => {
    const user = userEvent.setup();
    render(<AuthScreen />);

    await user.type(screen.getByLabelText(/^Email$/i), "not-an-email");
    await user.type(screen.getByLabelText(/^Password$/i), "password123");
    await user.click(screen.getByRole("button", { name: /^Sign In$/i }));

    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(mockSupabaseClient.auth.signInWithPassword).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/^Email$/i)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText(/^Email$/i)).toHaveAttribute(
      "aria-describedby",
      "auth-email-error",
    );
    expect(screen.getByLabelText(/^Email$/i)).toHaveFocus();
  });

  it("shows a password required message when email is filled and password is empty", async () => {
    const user = userEvent.setup();
    render(<AuthScreen />);

    await user.type(screen.getByLabelText(/^Email$/i), "scholar@university.edu");
    await user.click(screen.getByRole("button", { name: /^Sign In$/i }));

    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
    expect(screen.queryByText("Enter your email address.")).not.toBeInTheDocument();
    expect(mockSupabaseClient.auth.signInWithPassword).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/^Password$/i)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText(/^Password$/i)).toHaveFocus();
  });

  it("calls auth when email and password are filled", async () => {
    const user = userEvent.setup();
    mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: new Error("Invalid login credentials"),
    });

    render(<AuthScreen />);

    await user.type(screen.getByLabelText(/^Email$/i), "scholar@university.edu");
    await user.type(screen.getByLabelText(/^Password$/i), "not-the-password");
    await user.click(screen.getByRole("button", { name: /^Sign In$/i }));

    await waitFor(() => {
      expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
        email: "scholar@university.edu",
        password: "not-the-password",
      });
    });
    expect(
      await screen.findByText("Invalid email or password. Please try again."),
    ).toBeInTheDocument();
  });

  it("maps remaining raw auth errors to a friendly message", async () => {
    const user = userEvent.setup();
    mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: new Error("missing email or phone"),
    });

    render(<AuthScreen />);

    await user.type(screen.getByLabelText(/^Email$/i), "scholar@university.edu");
    await user.type(screen.getByLabelText(/^Password$/i), "password123");
    await user.click(screen.getByRole("button", { name: /^Sign In$/i }));

    expect(
      await screen.findByText("Unable to sign in. Please try again."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/missing email or phone/i),
    ).not.toBeInTheDocument();
  });
});

import { describe, expect, it } from "vitest";
import {
  extractFunctionErrorMessage,
  toFriendlyAuthError,
} from "../../utils/errors";

describe("toFriendlyAuthError", () => {
  it("maps invalid login credentials to the existing sign-in copy", () => {
    expect(
      toFriendlyAuthError(
        new Error("Invalid login credentials"),
        "Unable to sign in. Please try again.",
      ),
    ).toBe("Invalid email or password. Please try again.");
  });

  it("maps unconfirmed email to the existing confirm-email copy", () => {
    expect(
      toFriendlyAuthError(
        new Error("Email not confirmed"),
        "Unable to sign in. Please try again.",
      ),
    ).toBe("Please confirm your email address before signing in.");
  });

  it("does not leak raw provider messages such as missing email or phone", () => {
    expect(
      toFriendlyAuthError(
        new Error("missing email or phone"),
        "Unable to sign in. Please try again.",
      ),
    ).toBe("Unable to sign in. Please try again.");
  });

  it("falls back when the error has no usable message", () => {
    expect(toFriendlyAuthError({}, "Unable to send password reset email.")).toBe(
      "Unable to send password reset email.",
    );
  });
});

describe("extractFunctionErrorMessage", () => {
  it("returns the fallback for empty input", () => {
    expect(extractFunctionErrorMessage(null, "fallback")).toBe("fallback");
  });
});

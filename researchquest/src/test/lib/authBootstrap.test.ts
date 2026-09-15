import { describe, expect, it } from "vitest";
import { shouldBlockShellForAuthEvent } from "../../lib/authBootstrap";

describe("shouldBlockShellForAuthEvent", () => {
  it("does not block the shell on TOKEN_REFRESHED (tab focus / rotation)", () => {
    expect(shouldBlockShellForAuthEvent("TOKEN_REFRESHED")).toBe(false);
  });

  it("blocks the shell for sign-in and session bootstrap events", () => {
    expect(shouldBlockShellForAuthEvent("SIGNED_IN")).toBe(true);
    expect(shouldBlockShellForAuthEvent("INITIAL_SESSION")).toBe(true);
    expect(shouldBlockShellForAuthEvent("USER_UPDATED")).toBe(true);
    expect(shouldBlockShellForAuthEvent("SIGNED_OUT")).toBe(true);
  });
});

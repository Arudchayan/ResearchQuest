import { describe, it, expect } from "vitest";
import { isValidUrl, isStrongPassword } from "./security";

describe("Security Utils", () => {
  describe("isValidUrl", () => {
    it("should allow http and https urls", () => {
      expect(isValidUrl("https://example.com")).toBe(true);
      expect(isValidUrl("http://example.com")).toBe(true);
    });

    it("should allow mailto", () => {
      expect(isValidUrl("mailto:test@example.com")).toBe(true);
    });

    it("should allow relative urls", () => {
      expect(isValidUrl("/foo/bar")).toBe(true);
    });

    it("should reject javascript protocol", () => {
      expect(isValidUrl("javascript:alert(1)")).toBe(false);
    });

    it("should reject data protocol", () => {
      expect(isValidUrl("data:text/html,<script>alert(1)</script>")).toBe(
        false,
      );
    });

    it("should reject vbscript protocol", () => {
      expect(isValidUrl('vbscript:msgbox("test")')).toBe(false);
    });

    it("should handle whitespace", () => {
      expect(isValidUrl("  https://example.com  ")).toBe(true);
    });

    it("should reject empty strings", () => {
      expect(isValidUrl("")).toBe(false);
      expect(isValidUrl("   ")).toBe(false);
    });
  });

  describe("isStrongPassword", () => {
    it("should reject short passwords", () => {
      expect(isStrongPassword("short").valid).toBe(false);
    });

    it("should accept long passwords", () => {
      expect(isStrongPassword("longpassword123").valid).toBe(true);
    });
  });
});

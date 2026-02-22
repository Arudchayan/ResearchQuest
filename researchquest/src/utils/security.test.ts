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

    it("should reject protocol-relative URLs (open redirect)", () => {
      expect(isValidUrl("//example.com")).toBe(false);
      expect(isValidUrl("//javascript:alert(1)")).toBe(false);
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

    it("should reject passwords without uppercase", () => {
      expect(isStrongPassword("longpassword123!").valid).toBe(false);
      expect(isStrongPassword("longpassword123!").message).toContain("uppercase");
    });

    it("should reject passwords without lowercase", () => {
      expect(isStrongPassword("LONGPASSWORD123!").valid).toBe(false);
      expect(isStrongPassword("LONGPASSWORD123!").message).toContain("lowercase");
    });

    it("should reject passwords without numbers", () => {
      expect(isStrongPassword("LongPassword!").valid).toBe(false);
      expect(isStrongPassword("LongPassword!").message).toContain("number");
    });

    it("should reject passwords without special characters", () => {
      expect(isStrongPassword("LongPassword123").valid).toBe(false);
      expect(isStrongPassword("LongPassword123").message).toContain("special character");
    });

    it("should accept strong passwords", () => {
      expect(isStrongPassword("LongPassword123!").valid).toBe(true);
      expect(isStrongPassword("Strong-Password-1").valid).toBe(true);
      expect(isStrongPassword("Pass_word_123").valid).toBe(true);
      expect(isStrongPassword("Space Password 123!").valid).toBe(true);
    });
  });
});

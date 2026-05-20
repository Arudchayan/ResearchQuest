import { describe, it, expect } from "vitest";
import {
  isValidUrl,
  isStrongPassword,
  validateFileSize,
  MAX_FILE_SIZE_BYTES,
} from "./security";

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

    it("should reject protocol-relative urls", () => {
      expect(isValidUrl("//google.com")).toBe(false);
      expect(isValidUrl("//example.com/foo")).toBe(false);
      expect(isValidUrl("//example.com")).toBe(false);
      expect(isValidUrl("//javascript:alert(1)")).toBe(false);
      expect(isValidUrl("//127.0.0.1")).toBe(false);
    });

    it("should reject obfuscated protocol-relative urls and schemes", () => {
      expect(isValidUrl("/\\javascript:alert(1)")).toBe(false);
      expect(isValidUrl("\\/javascript:alert(1)")).toBe(false);
      expect(isValidUrl("\\\\javascript:alert(1)")).toBe(false);
      expect(isValidUrl("/\\example.com")).toBe(false);
      expect(isValidUrl("\\/example.com")).toBe(false);
      expect(isValidUrl("\\\\example.com")).toBe(false);
    });

    it("should reject javascript protocol", () => {
      expect(isValidUrl("javascript:alert(1)")).toBe(false);
    });

    it("should reject data protocol", () => {
      expect(isValidUrl("data:text/html,<script>alert(1)</script>")).toBe(
        false,
      );
    });

    it("should reject obfuscated javascript protocols using spaces or newlines", () => {
      expect(isValidUrl(" \n javascript:alert(1)")).toBe(false);
      expect(isValidUrl("\tjavascript:alert(1)")).toBe(false);
      expect(isValidUrl(" \n\t javascript:alert(1)")).toBe(false);
      expect(isValidUrl("java\nscript:alert(1)")).toBe(false);

      // Note: HTML entities in href like &#x74; are decoded by the browser's HTML parser
      // before being passed as a URL. Since isValidUrl validates the URL *value*,
      // not the HTML string, it correctly treats "javascrip&#x74;:alert(1)" as a relative URL.
      // So we don't test HTML entity decoding here.
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

    it("should reject passwords exceeding 72 characters", () => {
      const longPassword = "A1!" + "a".repeat(70); // 73 characters
      expect(isStrongPassword(longPassword).valid).toBe(false);
      expect(isStrongPassword(longPassword).message).toContain("no more than 72 characters");
    });

    it("should reject passwords without uppercase", () => {
      expect(isStrongPassword("longpassword123!").valid).toBe(false);
      expect(isStrongPassword("longpassword123!").message).toContain(
        "uppercase",
      );
    });

    it("should reject passwords without lowercase", () => {
      expect(isStrongPassword("LONGPASSWORD123!").valid).toBe(false);
      expect(isStrongPassword("LONGPASSWORD123!").message).toContain(
        "lowercase",
      );
    });

    it("should reject passwords without numbers", () => {
      expect(isStrongPassword("LongPassword!").valid).toBe(false);
      expect(isStrongPassword("LongPassword!").message).toContain("number");
    });

    it("should reject passwords without special characters", () => {
      expect(isStrongPassword("LongPassword123").valid).toBe(false);
      expect(isStrongPassword("LongPassword123").message).toContain(
        "special character",
      );
    });

    it("should accept strong passwords", () => {
      expect(isStrongPassword("LongPassword123!").valid).toBe(true);
      expect(isStrongPassword("Strong-Password-1").valid).toBe(true);
      expect(isStrongPassword("Pass_word_123").valid).toBe(true);
      expect(isStrongPassword("Space Password 123!").valid).toBe(true);
    });
  });

  describe("validateFileSize", () => {
    it("should allow files within the size limit", () => {
      const file = { size: MAX_FILE_SIZE_BYTES } as File;
      expect(validateFileSize(file).valid).toBe(true);
    });

    it("should allow small files", () => {
      const file = { size: 1024 } as File;
      expect(validateFileSize(file).valid).toBe(true);
    });

    it("should reject files exceeding the size limit", () => {
      const file = { size: MAX_FILE_SIZE_BYTES + 1 } as File;
      const result = validateFileSize(file);
      expect(result.valid).toBe(false);
      expect(result.message).toContain("File size exceeds the limit");
    });
  });
});

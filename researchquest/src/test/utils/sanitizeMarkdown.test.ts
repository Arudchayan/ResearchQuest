import { describe, expect, it } from "vitest";
import { sanitizeMarkdownUrl } from "../../utils/sanitizeMarkdown";

describe("sanitizeMarkdownUrl (PR20-90)", () => {
  it("allows http(s) URLs", () => {
    expect(sanitizeMarkdownUrl("https://example.com/paper")).toBe(
      "https://example.com/paper",
    );
    expect(sanitizeMarkdownUrl("http://example.com/x")).toBe(
      "http://example.com/x",
    );
  });

  it("allows mailto, anchors, and relative links", () => {
    expect(sanitizeMarkdownUrl("mailto:a@example.com")).toBe(
      "mailto:a@example.com",
    );
    expect(sanitizeMarkdownUrl("#section")).toBe("#section");
    expect(sanitizeMarkdownUrl("/notes/abc")).toBe("/notes/abc");
    expect(sanitizeMarkdownUrl("./other-note")).toBe("./other-note");
  });

  it("blocks XSS-capable destinations", () => {
    expect(sanitizeMarkdownUrl("javascript:alert(1)")).toBe("#");
    expect(sanitizeMarkdownUrl("  JaVaScRiPt:alert(1)")).toBe("#");
    expect(sanitizeMarkdownUrl("data:text/html,<script>alert(1)</script>")).toBe(
      "#",
    );
    expect(sanitizeMarkdownUrl("vbscript:msgbox(1)")).toBe("#");
    expect(sanitizeMarkdownUrl("//evil.example.com/x")).toBe("#");
    expect(sanitizeMarkdownUrl("ftp://example.com/x")).toBe("#");
    expect(sanitizeMarkdownUrl("")).toBe("#");
  });
});

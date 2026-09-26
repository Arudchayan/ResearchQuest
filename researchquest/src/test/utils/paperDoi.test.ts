import { describe, expect, it } from "vitest";
import { doisMatch, normalizeDoi } from "../../utils/paperUtils";

describe("normalizeDoi spelling variants", () => {
  it.each([
    ["10.1234/ABC", "10.1234/abc"],
    ["  10.1234/abc  ", "10.1234/abc"],
    ["https://doi.org/10.1234/abc", "10.1234/abc"],
    ["http://dx.doi.org/10.1234/abc", "10.1234/abc"],
    ["doi:10.1234/abc", "10.1234/abc"],
    ["DOI: 10.1234/ABC", "10.1234/abc"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeDoi(input)).toBe(expected);
  });

  it("matches resolver/uppercase variants of the same DOI", () => {
    expect(doisMatch("https://doi.org/10.1234/ABC", "doi:10.1234/abc")).toBe(
      true,
    );
    expect(doisMatch("10.1234/abc", "10.9999/other")).toBe(false);
    expect(doisMatch("", "")).toBe(false);
  });
});

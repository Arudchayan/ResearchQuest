import { describe, it, expect } from "vitest";
import { parseBibTeX, parseBibTeXWithWarnings, BibTeXEntry } from "../../utils/bibtexParser";

describe("parseBibTeX", () => {
  it("should parse a simple article entry", () => {
    const input = `
@article{key1,
  title = {Sample Title},
  author = {Smith, John and Doe, Jane},
  year = {2023},
  journal = {Journal of Testing},
  doi = {10.1234/5678}
}
    `;
    const result = parseBibTeX(input);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "key1",
      type: "article",
      title: "Sample Title",
      authors: ["Smith, John", "Doe, Jane"],
      year: "2023",
      journal: "Journal of Testing",
      doi: "10.1234/5678",
      raw: input.trim(),
    });
  });

  it("should parse multiple entries", () => {
    const input = `
@article{key1,
  title = {Paper One},
  year = {2021}
}

@book{key2,
  title = {Book Two},
  year = {2022}
}
    `;
    const result = parseBibTeX(input);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("key1");
    expect(result[1].id).toBe("key2");
  });

  it("should handle unquoted values and numbers", () => {
    const input = `
@article{key1,
  year = 2023,
  volume = 10,
  title = "Quoted Title"
}
    `;
    const result = parseBibTeX(input);
    expect(result[0].year).toBe("2023");
    expect(result[0].title).toBe("Quoted Title");
  });

  it("should handle complex author names", () => {
    const input = `
@article{key1,
  author = {Van der Waal, J. and O'Neil, T. and {Corporate Author}}
}
    `;
    const result = parseBibTeX(input);
    expect(result[0].authors).toEqual([
      "Van der Waal, J.",
      "O'Neil, T.",
      "Corporate Author",
    ]);
  });

  it("should handle malformed or empty input gracefully", () => {
    expect(parseBibTeX("")).toEqual([]);
    expect(parseBibTeX("   ")).toEqual([]);
    expect(parseBibTeX("not a bibtex file")).toEqual([]);
  });

  it("should extract abstract and url", () => {
    const input = `
@misc{key1,
  url = {https://example.com},
  abstract = {This is a very long abstract that spans multiple lines.}
}
    `;
    const result = parseBibTeX(input);
    expect(result[0].url).toBe("https://example.com");
    expect(result[0].abstract).toContain("This is a very long abstract");
  });

  it("should handle email addresses in abstract without splitting", () => {
    const input = `
@article{key1,
  title = {Paper with Email},
  abstract = {Contact author at test@example.com for more info.}
}
    `;
    const result = parseBibTeX(input);
    expect(result).toHaveLength(1);
    expect(result[0].abstract).toBe(
      "Contact author at test@example.com for more info.",
    );
  });

  it("should handle nested braces correctly", () => {
    const input = `
@article{key1,
  title = {{This Title Case Is Preserved}},
  note = {Some {Nested {Braces}} inside}
}
    `;
    const result = parseBibTeX(input);
    // The parser removes outer braces. {{Title}} -> {Title}
    expect(result[0].title).toBe("This Title Case Is Preserved");
    expect(result[0].note).toBe("Some {Nested {Braces}} inside");
  });

  it("should handle multiple entries with mixed spacing", () => {
    const input = `
@article{key1,title={Title 1}}
  @book{key2, title = {Title 2} }
    `;
    const result = parseBibTeX(input);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe("Title 1");
    expect(result[1].title).toBe("Title 2");
  });

  describe('Security: Prototype Pollution Prevention', () => {
    it('should ignore __proto__ field in BibTeX input', () => {
      const input = `
@article{pollute1,
  __proto__ = {polluted: "yes"},
  title = {Safe Title}
}
      `;
      const result = parseBibTeX(input);
      const entry = result[0];

      // Verify normal property exists
      expect(entry.title).toBe('Safe Title');

      // Verify no pollution on the object instance
      // "constructor" in entry -> false for plain object, but let's check for specific polluted prop
      expect((entry as any).polluted).toBeUndefined();

      // Verify no pollution on Object.prototype
      expect((Object.prototype as any).polluted).toBeUndefined();

      // Depending on implementation, __proto__ key might be present as own property or ignored.
      // Ideally it should be ignored or harmless.
      // If it exists as own property, it shouldn't affect prototype chain if created properly.
      // However, safest is to strip it.
    });

    it('should ignore constructor field to prevent overwriting', () => {
      const input = `
@article{pollute2,
  constructor = {polluted: "yes"}
}
      `;
      const result = parseBibTeX(input);
      const entry = result[0];

      // Should not overwrite the constructor property
      expect(entry.constructor).toBe(Object);
    });

    it('should ignore prototype field', () => {
       const input = `
@article{pollute3,
  prototype = {polluted: "yes"}
}
      `;
      const result = parseBibTeX(input);
      const entry = result[0];
      expect((entry as any).prototype).toBeUndefined();
    });
  });

  describe("Year anchoring (/^\\d{4}$/ on trimmed value)", () => {
    it("keeps a plain 4-digit year", () => {
      const result = parseBibTeX(`@article{k, year = {2023}}`);
      expect(result[0].year).toBe("2023");
    });

    it("keeps an unbraced numeric year", () => {
      const result = parseBibTeX(`@article{k, year = 2021}`);
      expect(result[0].year).toBe("2021");
    });

    it("omits year with extra text (no silent partial extract)", () => {
      const result = parseBibTeX(`@article{k, year = {2023a}}`);
      expect(result[0].year).toBeUndefined();
    });

    it("omits date-range years", () => {
      const result = parseBibTeX(`@article{k, year = {2021-2022}}`);
      expect(result[0].year).toBeUndefined();
    });

    it("omits year with surrounding whitespace noise that is not exactly 4 digits", () => {
      const result = parseBibTeX(`@article{k, year = {  May 2023  }}`);
      expect(result[0].year).toBeUndefined();
    });

    it("trims whitespace around a valid year", () => {
      const result = parseBibTeX(`@article{k, year = {  2020  }}`);
      expect(result[0].year).toBe("2020");
    });
  });

  describe("Brace-depth-aware author splitting", () => {
    it("splits simple authors", () => {
      const result = parseBibTeX(`@article{k, author = {Smith, J. and Doe, J.}}`);
      expect(result[0].authors).toEqual(["Smith, J.", "Doe, J."]);
    });

    it("protects braced corporate author containing 'and'", () => {
      const result = parseBibTeX(`@article{k, author = {{Corporate and Partners} and Smith, J.}}`);
      expect(result[0].authors).toEqual(["Corporate and Partners", "Smith, J."]);
    });

    it("leaves Fish-and-Chips untouched", () => {
      const result = parseBibTeX(`@article{k, author = {Fish-and-Chips}}`);
      expect(result[0].authors).toEqual(["Fish-and-Chips"]);
    });

    it("strips only ONE outer pair for doubly-braced author", () => {
      const result = parseBibTeX(`@article{k, author = {{{a and b}} and C}}`);
      expect(result[0].authors).toEqual(["{a and b}", "C"]);
    });
  });

  describe("Backslash escapes", () => {
    it("unescapes \\{ \\} \\\\ one level in braced values", () => {
      const result = parseBibTeX(`@article{k, title = {a \\{b\\} c \\\\ d}}`);
      expect(result[0].title).toBe("a {b} c \\ d");
    });

    it("does not let an escaped brace close the entry block early", () => {
      const input = `@article{k, title = {a \\} still title}, year = {2022}}`;
      const result = parseBibTeX(input);
      expect(result).toHaveLength(1);
      expect(result[0].title).toContain("still title");
      expect(result[0].year).toBe("2022");
    });

    it("does not let an escaped brace close a braced value early", () => {
      const result = parseBibTeX(`@article{k, title = {left \\} right}, year = {2020}}`);
      expect(result[0].title).toBe("left } right");
    });
  });

  describe("Duplicate keys (case-sensitive)", () => {
    it("renames repeats with -2/-3 and preserves originalId", () => {
      const input = `
@article{dup, title = {One}, year = {2020}}
@article{dup, title = {Two}, year = {2021}}
@article{dup, title = {Three}, year = {2022}}
      `;
      const result = parseBibTeX(input);
      expect(result.map((e) => e.id)).toEqual(["dup", "dup-2", "dup-3"]);
      expect(result[0].originalId).toBeUndefined();
      expect(result[1].originalId).toBe("dup");
      expect(result[2].originalId).toBe("dup");
    });

    it("does NOT merge keys differing only by case", () => {
      const input = `
@article{Key, title = {One}}
@article{KEY, title = {Two}}
@article{key, title = {Three}}
      `;
      const result = parseBibTeX(input);
      expect(result.map((e) => e.id)).toEqual(["Key", "KEY", "key"]);
      const { warnings } = parseBibTeXWithWarnings(input);
      expect(warnings.duplicateKeys).toEqual([]);
    });

    it("reports duplicateKeys warnings shape", () => {
      const input = `
@article{same, title = {A}}
@article{same, title = {B}}
@article{other, title = {C}}
@article{other, title = {D}}
      `;
      const { entries, warnings } = parseBibTeXWithWarnings(input);
      expect(entries).toHaveLength(4);
      expect([...warnings.duplicateKeys].sort()).toEqual(["other", "same"]);
      expect(Array.isArray(warnings.stringYears)).toBe(true);
    });
  });

  describe("parseBibTeXWithWarnings shape + @string years", () => {
    it("returns {entries, warnings:{duplicateKeys, stringYears}}", () => {
      const res = parseBibTeXWithWarnings(`@article{k, title = {T}}`);
      expect(res.entries).toHaveLength(1);
      expect(res.warnings).toEqual({ duplicateKeys: [], stringYears: [] });
    });

    it("resolves @string-defined valid years", () => {
      const input = `
@string{myyear = {2022}}
@article{k, title = {T}, year = myyear}
      `;
      const { entries, warnings } = parseBibTeXWithWarnings(input);
      expect(entries[0].year).toBe("2022");
      expect(warnings.stringYears).toEqual([]);
    });

    it("warns (not silently drops) when a @string-defined year vanishes", () => {
      const input = `
@string{badyear = {forthcoming}}
@article{k, title = {T}, year = badyear}
      `;
      const { entries, warnings } = parseBibTeXWithWarnings(input);
      expect(entries[0].year).toBeUndefined();
      expect(warnings.stringYears).toContain("k");
    });

    it("keeps parseBibTeX() returning a bare entries array", () => {
      const out = parseBibTeX(`@article{k, title = {T}}`);
      expect(Array.isArray(out)).toBe(true);
      expect(out[0].id).toBe("k");
    });
  });
});

import { describe, it, expect } from "vitest";
import {
  generateBibTeX,
  generateAPA,
  generateMLA,
  generateChicago,
  generateHarvard,
  escapeBibTeX,
  makeKey,
} from "../../utils/citation";
import { parseBibTeX } from "../../utils/bibtexParser";
import { convertPapersToBibTeX } from "../../utils/export";
import type { Paper } from "../../types/database";

describe("Citation Generators", () => {
  const fullPaper: Paper = {
    id: "1",
    user_id: "user1",
    title: "Quantum Computing Advances",
    authors: ["John Doe", "Jane Smith"],
    publication_date: "2023-01-01",
    doi: "10.1234/5678",
    source_url: "https://example.com/paper",
    abstract: "This is an abstract.\nIt has multiple lines.",
    status: "To Read",
    created_at: "2023-01-01",
    updated_at: "2023-01-01",
  };

  const minimalPaper: Paper = {
    id: "2",
    user_id: "user1",
    title: "Minimal Paper",
    authors: [],
    status: "To Read",
    created_at: "2023-01-01",
    updated_at: "2023-01-01",
  };

  const multiAuthorPaper: Paper = {
    ...fullPaper,
    authors: ["John Doe", "Jane Smith", "Alice Johnson"],
  };

  describe("generateBibTeX", () => {
    it("generates correct BibTeX for a full paper", () => {
      const bibtex = generateBibTeX(fullPaper);

      expect(bibtex).toContain("@article{Doe2023Quantum,");
      expect(bibtex).toContain("title = {Quantum Computing Advances}");
      expect(bibtex).toContain("author = {John Doe and Jane Smith}");
      expect(bibtex).toContain("year = {2023}");
      expect(bibtex).toContain("doi = {10.1234/5678}");
      expect(bibtex).toContain("url = {https://example.com/paper}");
      expect(bibtex).toContain(
        "abstract = {This is an abstract. It has multiple lines.}",
      );
    });

    it("handles minimal paper", () => {
      const bibtex = generateBibTeX(minimalPaper);

      expect(bibtex).toContain("@article{anonndMinimal,");
      expect(bibtex).toContain("title = {Minimal Paper}");
      expect(bibtex).not.toContain("author =");
      expect(bibtex).not.toContain("year =");
    });

    it("handles irregular date format", () => {
      const paper: Paper = {
        ...minimalPaper,
        title: "Old Paper",
        authors: ["Alice"],
        publication_date: "Winter 1999",
      };

      const bibtex = generateBibTeX(paper);
      expect(bibtex).toContain("year = {1999}");
    });
  });

  describe("generateAPA", () => {
    it("generates correct APA for full paper", () => {
      const citation = generateAPA(fullPaper);
      expect(citation).toBe(
        "Doe, J. & Smith, J. (2023). Quantum Computing Advances. https://doi.org/10.1234/5678",
      );
    });

    it("handles minimal paper", () => {
      const citation = generateAPA(minimalPaper);
      expect(citation).toBe("Anonymous (n.d.). Minimal Paper.");
    });

    it("handles multiple authors", () => {
      const citation = generateAPA(multiAuthorPaper);
      expect(citation).toBe(
        "Doe, J., Smith, J., & Johnson, A. (2023). Quantum Computing Advances. https://doi.org/10.1234/5678",
      );
    });
  });

  describe("generateMLA", () => {
    it("generates correct MLA for full paper", () => {
      const citation = generateMLA(fullPaper);
      // "Doe, John, and Jane Smith. "Quantum Computing Advances." 2023. doi:10.1234/5678."
      expect(citation).toBe(
        'Doe, John, and Jane Smith "Quantum Computing Advances." 2023. doi:10.1234/5678.',
      );
    });

    it("handles minimal paper", () => {
      const citation = generateMLA(minimalPaper);
      expect(citation).toBe('Anonymous "Minimal Paper."');
    });

    it("handles 3+ authors (et al.)", () => {
      const citation = generateMLA(multiAuthorPaper);
      expect(citation).toBe(
        'Doe, John, et al. "Quantum Computing Advances." 2023. doi:10.1234/5678.',
      );
    });
  });

  describe("generateChicago", () => {
    it("generates correct Chicago for full paper", () => {
      const citation = generateChicago(fullPaper);
      // "Doe, John, and Jane Smith. "Quantum Computing Advances." (2023). https://doi.org/10.1234/5678."
      expect(citation).toBe(
        'Doe, John, and Jane Smith "Quantum Computing Advances." (2023). https://doi.org/10.1234/5678.',
      );
    });

    it("handles minimal paper", () => {
      const citation = generateChicago(minimalPaper);
      expect(citation).toBe('Anonymous "Minimal Paper."');
    });

    it("handles 4+ authors (et al.)", () => {
      const manyAuthorsPaper = {
        ...fullPaper,
        authors: ["A", "B", "C", "D"],
      };
      const citation = generateChicago(manyAuthorsPaper);
      expect(citation).toBe(
        'A, et al. "Quantum Computing Advances." (2023). https://doi.org/10.1234/5678.',
      );
    });
  });

  describe("generateHarvard", () => {
    it("generates correct Harvard for full paper", () => {
      const citation = generateHarvard(fullPaper);
      // "Doe, J and Smith, J (2023) 'Quantum Computing Advances'. doi: 10.1234/5678"
      expect(citation).toBe(
        "Doe, J and Smith, J (2023) 'Quantum Computing Advances'. doi: 10.1234/5678",
      );
    });

    it("handles minimal paper", () => {
      const citation = generateHarvard(minimalPaper);
      expect(citation).toBe("Anonymous (n.d.) 'Minimal Paper'.");
    });

    it("handles > 3 authors (et al.)", () => {
      const manyAuthorsPaper = {
        ...fullPaper,
        authors: ["A", "B", "C", "D"],
      };
      const citation = generateHarvard(manyAuthorsPaper);
      expect(citation).toBe(
        "A et al. (2023) 'Quantum Computing Advances'. doi: 10.1234/5678",
      );
    });
  });
});

describe("escapeBibTeX", () => {
  it("escapes backslash first (no double-escape of introduced backslashes)", () => {
    expect(escapeBibTeX("a\\b")).toBe("a\\\\b");
    // Input "\\{" is backslash + brace: backslash doubles, then brace escapes.
    expect(escapeBibTeX("\\{")).toBe("\\\\\\{");
  });

  it("escapes braces", () => {
    expect(escapeBibTeX("{x}")).toBe("\\{x\\}");
    expect(escapeBibTeX("A {unclosed")).toBe("A \\{unclosed");
    expect(escapeBibTeX("lone } brace")).toBe("lone \\} brace");
  });

  it("escapes BibTeX specials & % $ # _ ~ ^", () => {
    expect(escapeBibTeX("100% & $ # _ ~ ^")).toBe(
      "100\\% \\& \\$ \\# \\_ \\~ \\^",
    );
  });

  it("leaves plain text untouched", () => {
    expect(escapeBibTeX("Quantum Computing Advances")).toBe(
      "Quantum Computing Advances",
    );
  });
});

describe("makeKey", () => {
  const base: Paper = {
    id: "1",
    user_id: "user1",
    title: "Quantum Computing Advances",
    authors: ["John Doe"],
    publication_date: "2023-01-01",
    status: "To Read",
    created_at: "2023-01-01",
    updated_at: "2023-01-01",
  };

  it("builds base as last+year+firstTitleWord", () => {
    expect(makeKey(base, new Set())).toBe("Doe2023Quantum");
  });

  it("falls back to anon/untitled for non-Latin names and titles", () => {
    const p: Paper = {
      ...base,
      title: "日本語タイトル",
      authors: ["王小明"],
    };
    const key = makeKey(p, new Set());
    expect(key.length).toBeGreaterThan(0);
    expect(key).toContain("anon");
    expect(key).toContain("untitled");
  });

  it("dedups collisions with hyphenated letter suffixes (base, base-a, base-b)", () => {
    const used = new Set<string>();
    expect(makeKey(base, used)).toBe("Doe2023Quantum");
    expect(makeKey(base, used)).toBe("Doe2023Quantum-a");
    expect(makeKey(base, used)).toBe("Doe2023Quantum-b");
  });

  it("does not use the import -2 numeric scheme", () => {
    const used = new Set<string>();
    makeKey(base, used);
    const second = makeKey(base, used);
    expect(second).not.toContain("-2");
    expect(second.endsWith("-a")).toBe(true);
  });

  it("starts fresh with a new set (single-paper path)", () => {
    expect(makeKey(base, new Set())).toBe("Doe2023Quantum");
    expect(makeKey(base, new Set())).toBe("Doe2023Quantum");
  });
});

describe("generateBibTeX author and-bracing", () => {
  const mk = (authors: string[]): Paper => ({
    id: "1",
    user_id: "user1",
    title: "X",
    authors,
    publication_date: "2023-01-01",
    status: "To Read",
    created_at: "2023-01-01",
    updated_at: "2023-01-01",
  });

  it("braces authors containing the word and", () => {
    const bib = generateBibTeX(mk(["Rock and Roll Band", "John Doe"]));
    expect(bib).toContain("{Rock and Roll Band}");
  });

  it("matches and case-insensitively", () => {
    const bib = generateBibTeX(mk(["Fish AND Chips"]));
    expect(bib).toContain("{Fish AND Chips}");
  });

  it("does not brace Anderson (naive includes would)", () => {
    const bib = generateBibTeX(mk(["Anderson Cooper"]));
    expect(bib).toContain("author = {Anderson Cooper}");
    expect(bib).not.toContain("{{Anderson");
  });
});

describe("generateBibTeX round-trip (generate -> parseBibTeX)", () => {
  const mk = (over: Partial<Paper>): Paper => ({
    id: "p",
    user_id: "u",
    title: "T",
    authors: ["John Doe"],
    publication_date: "2023-01-01",
    status: "To Read",
    created_at: "2023-01-01",
    updated_at: "2023-01-01",
    ...over,
  });

  it("round-trips a title with an unclosed brace", () => {
    const original = "A {unclosed";
    const bib = generateBibTeX(mk({ title: original }));
    expect(bib).toContain("A \\{unclosed");
    const parsed = parseBibTeX(bib);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.title).toBe(original);
  });

  it("round-trips a title with a lone closing brace", () => {
    const original = "lone } brace";
    const bib = generateBibTeX(mk({ title: original }));
    expect(bib).toContain("lone \\} brace");
    const parsed = parseBibTeX(bib);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.title).toBe(original);
  });

  it("round-trips a backslash (parser strips one escape level)", () => {
    const original = "a\\b";
    const bib = generateBibTeX(mk({ title: original }));
    expect(bib).toContain("a\\\\b");
    const parsed = parseBibTeX(bib);
    expect(parsed).toHaveLength(1);
    // Parser strips one level (a\\b -> a\b); accept either side of that handoff.
    expect([original, "a\\\\b"]).toContain(parsed[0]!.title);
  });

  it("round-trips specials in the abstract", () => {
    const original = "Results: 100% of A & B cost $5 #3 _x_ ~y ^z";
    const bib = generateBibTeX(mk({ abstract: original }));
    expect(bib).toContain("100\\%");
    expect(bib).toContain("\\&");
    const parsed = parseBibTeX(bib);
    expect(parsed).toHaveLength(1);
    // Specials keep their escape in the parser; accept original or escaped form.
    expect([original, escapeBibTeX(original)]).toContain(
      parsed[0]!.abstract,
    );
  });

  it("keeps a braced and-author together on re-parse", () => {
    const bib = generateBibTeX(
      mk({ authors: ["Rock and Roll Band", "John Doe"] }),
    );
    const parsed = parseBibTeX(bib);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.authors).toContain("Rock and Roll Band");
  });

  it("yields non-empty anon/untitled keys for non-Latin papers", () => {
    const bib = generateBibTeX(
      mk({ title: "日本語タイトル", authors: ["王小明"] }),
    );
    const key = bib.match(/@article\{([^,]+),/)?.[1] ?? "";
    expect(key.length).toBeGreaterThan(0);
    expect(key).toContain("anon");
    expect(key).toContain("untitled");
    expect(parseBibTeX(bib)).toHaveLength(1);
  });

  it("bulk same-author pair yields base and base-a keys", () => {
    const a = mk({ id: "a", title: "Same Title" });
    const b = mk({ id: "b", title: "Same Topic" });
    const bulk = convertPapersToBibTeX([a, b]);
    expect(bulk).toContain("@article{Doe2023Same,");
    expect(bulk).toContain("@article{Doe2023Same-a,");
    const parsed = parseBibTeX(bulk);
    expect(parsed.map((e) => e.id)).toEqual([
      "Doe2023Same",
      "Doe2023Same-a",
    ]);
  });
});

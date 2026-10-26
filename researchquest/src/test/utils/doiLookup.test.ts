import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildCrossrefWorkUrl,
  lookupDoiFromCrossref,
} from "../../utils/doiLookup";

const NATURE_DOI = "10.1038/nature14539";
const ARXIV_DOI = "10.48550/arXiv.2210.03629";

const natureCrossrefMessage = {
  DOI: "10.1038/nature14539",
  title: ["Deep learning"],
  author: [
    { given: "Yann", family: "LeCun" },
    { given: "Yoshua", family: "Bengio" },
    { given: "Geoffrey", family: "Hinton" },
  ],
  published: { "date-parts": [[2015, 5, 27]] },
  URL: "https://doi.org/10.1038/nature14539",
  "container-title": ["Nature"],
  publisher: "Springer Nature",
  type: "journal-article",
};

const arxivCrossrefMessage = {
  DOI: "10.48550/arXiv.2210.03629",
  title: ["ReAct: Synergizing Reasoning and Acting in Language Models"],
  author: [
    { given: "Shunyu", family: "Yao" },
    { given: "Jeffrey", family: "Zhao" },
    { given: "Dian", family: "Yu" },
  ],
  published: { "date-parts": [[2022, 10, 6]] },
  URL: "https://doi.org/10.48550/arXiv.2210.03629",
  "container-title": ["arXiv"],
  publisher: "arXiv",
  type: "posted-content",
};

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe("buildCrossrefWorkUrl", () => {
  it("encodes the slash in a Crossref DOI path", () => {
    expect(buildCrossrefWorkUrl(NATURE_DOI)).toBe(
      "https://api.crossref.org/works/10.1038%2Fnature14539",
    );
  });

  it("encodes an arXiv DOI after normalizing case", () => {
    expect(buildCrossrefWorkUrl(ARXIV_DOI)).toBe(
      "https://api.crossref.org/works/10.48550%2Farxiv.2210.03629",
    );
  });
});

describe("lookupDoiFromCrossref", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps a Crossref { message } envelope for 10.1038/nature14539", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({
        status: "ok",
        "message-type": "work",
        message: natureCrossrefMessage,
      }),
    );

    const paper = await lookupDoiFromCrossref(NATURE_DOI, fetchFn);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0]?.[0]).toBe(
      "https://api.crossref.org/works/10.1038%2Fnature14539",
    );
    expect(fetchFn.mock.calls[0]?.[1]).toMatchObject({
      headers: { Accept: "application/json" },
    });
    expect(paper).toMatchObject({
      doi: "10.1038/nature14539",
      title: "Deep learning",
      authors: ["Yann LeCun", "Yoshua Bengio", "Geoffrey Hinton"],
      publicationDate: 2015,
      containerTitle: "Nature",
      sourceUrl: "https://doi.org/10.1038/nature14539",
      publisher: "Springer Nature",
      type: "journal-article",
    });
  });

  it("maps a Crossref { message } envelope for an arXiv DOI", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ message: arxivCrossrefMessage }),
    );

    const paper = await lookupDoiFromCrossref(
      "https://doi.org/10.48550/arXiv.2210.03629",
      fetchFn,
    );

    expect(fetchFn.mock.calls[0]?.[0]).toBe(
      "https://api.crossref.org/works/10.48550%2Farxiv.2210.03629",
    );
    expect(paper).toMatchObject({
      doi: "10.48550/arXiv.2210.03629",
      title: "ReAct: Synergizing Reasoning and Acting in Language Models",
      authors: ["Shunyu Yao", "Jeffrey Zhao", "Dian Yu"],
      publicationDate: 2022,
      containerTitle: "arXiv",
    });
  });

  it("maps a root-shaped work when Crossref omits the message wrapper", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(jsonResponse(natureCrossrefMessage));

    const paper = await lookupDoiFromCrossref(NATURE_DOI, fetchFn);

    expect(paper?.title).toBe("Deep learning");
    expect(paper?.authors[0]).toBe("Yann LeCun");
  });

  it("returns null when Crossref responds 404", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse("Not Found", false, 404));

    await expect(lookupDoiFromCrossref(NATURE_DOI, fetchFn)).resolves.toBeNull();
  });

  it("returns null when the returned DOI does not match the request", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({
        message: { ...natureCrossrefMessage, DOI: "10.1038/someone-else" },
      }),
    );

    await expect(lookupDoiFromCrossref(NATURE_DOI, fetchFn)).resolves.toBeNull();
  });
});

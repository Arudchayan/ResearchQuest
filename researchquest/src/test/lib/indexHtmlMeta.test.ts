import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("index.html production meta", () => {
  const html = readFileSync(resolve(__dirname, "../../../index.html"), "utf8");
  const head = html.slice(
    html.indexOf("<head>"),
    html.indexOf("</head>"),
  );

  it("uses a serious production title without gamification marketing", () => {
    expect(head).toContain("<title>ResearchQuest — Research workspace</title>");
    expect(head).not.toMatch(/gamif/i);
  });

  it("ships an honest thin description covering the alpha workspace", () => {
    expect(head).toMatch(
      /<meta name="description" content="[^"]*papers[^"]*notes[^"]*ideas[^"]*tasks[^"]*focus[^"]*" \/>/i,
    );
    expect(head).toMatch(/alpha/i);
  });

  it("includes Open Graph and Twitter tags for the live demo hosts", () => {
    expect(head).toContain('property="og:type" content="website"');
    expect(head).toContain(
      'property="og:title" content="ResearchQuest — Research workspace"',
    );
    expect(head).toContain('property="og:description"');
    expect(head).toContain(
      'property="og:url" content="https://research-quest-wine.vercel.app/"',
    );
    expect(head).toContain(
      'rel="canonical" href="https://research-quest-wine.vercel.app/"',
    );
    expect(head).toContain('name="twitter:card" content="summary"');
    expect(head).toContain("https://rq.arudchayan.com/");
  });
});

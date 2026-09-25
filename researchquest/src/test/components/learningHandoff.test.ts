import { describe, expect, it } from "vitest";
import {
  clearLearningTaskHandoff,
  readLearningTaskHandoff,
} from "../../components/tasks/learningHandoff";
import { savedAtlasLessonUrl } from "../../components/tasks/savedLessonLink";

describe("learning task handoff", () => {
  it("prefills an editable draft and consumes only handoff fields", () => {
    const url = new URL("https://researchquest.example/tasks?source=learning-platform&subject=Biology&lesson=Cells&title=Review%20cell%20structure&tab=mine#today");
    expect(readLearningTaskHandoff(url)).toEqual({
      title: "Review cell structure",
      description: "From Learning Platform\nSubject: Biology\nLesson: Cells",
      lessonUrl: null,
    });
    expect(clearLearningTaskHandoff(url)).toBe("/tasks?tab=mine#today");
  });

  it("ignores ordinary task routes and handoffs without a title", () => {
    expect(readLearningTaskHandoff(new URL("https://researchquest.example/tasks/one?source=learning-platform&title=Ignored"))).toBeNull();
    expect(readLearningTaskHandoff(new URL("https://researchquest.example/tasks?source=other&title=Ignored"))).toBeNull();
    expect(readLearningTaskHandoff(new URL("https://researchquest.example/tasks?source=learning-platform&title=%20"))).toBeNull();
  });

  it("limits and flattens external text", () => {
    const url = new URL("https://researchquest.example/tasks?source=learning-platform&subject=Intro%0AInjected&title=" + "x".repeat(300));
    const draft = readLearningTaskHandoff(url);
    expect(draft?.title).toHaveLength(200);
    expect(draft?.description).toContain("Subject: Intro Injected");
  });

  it("carries an actionable investigation into the editable task", () => {
    const url = new URL("https://researchquest.example/tasks?source=learning-platform&title=Audit&prompt=" + encodeURIComponent("Compare two rankings.\nRequest missing judgments.") + "&tab=mine");
    expect(readLearningTaskHandoff(url)?.description).toContain("Suggested investigation: Compare two rankings. Request missing judgments.");
    expect(clearLearningTaskHandoff(url)).toBe("/tasks?tab=mine");
  });

  it("links back to a trusted exact lesson and removes the handoff URL field", () => {
    const lessonUrl = "https://learning-platform-chi-ten.vercel.app/learn/multimedia-retrieval-lab/boolean-retrieval/";
    const url = new URL("https://researchquest.example/tasks?source=learning-platform&title=Explore&lessonUrl=" + encodeURIComponent(lessonUrl) + "&tab=mine");
    expect(readLearningTaskHandoff(url)?.lessonUrl).toBe(lessonUrl);
    expect(readLearningTaskHandoff(url)?.description).toContain("Open lesson: " + lessonUrl);
    expect(clearLearningTaskHandoff(url)).toBe("/tasks?tab=mine");
  });

  it("accepts the new Drug Discovery shared lesson as an exact return URL", () => {
    const lessonUrl = "https://learning-platform-chi-ten.vercel.app/learn/drug-discovery-lab/model-and-evidence/";
    const url = new URL("https://researchquest.example/tasks?source=learning-platform&title=Practice&lessonUrl=" + encodeURIComponent(lessonUrl));
    expect(readLearningTaskHandoff(url)?.lessonUrl).toBe(lessonUrl);
  });

  it("rejects an untrusted return URL", () => {
    const url = new URL("https://researchquest.example/tasks?source=learning-platform&title=Explore&lessonUrl=" + encodeURIComponent("https://example.com/steal"));
    expect(readLearningTaskHandoff(url)?.lessonUrl).toBeNull();
  });

  it("uses the saved-link allowlist for draft return links", () => {
    const legacy = "https://learning-platform-chi-ten.vercel.app/analysis-1-lab/reader.html#page=17";
    const valid = new URL("https://researchquest.example/tasks?source=learning-platform&title=Read&lessonUrl=" + encodeURIComponent(legacy));
    expect(readLearningTaskHandoff(valid)?.lessonUrl).toBe(legacy);

    for (const unsafe of [
      "https://learning-platform-chi-ten.vercel.app/admin/",
      "https://learning-platform-chi-ten.vercel.app/learn/analysis-1-lab/sequence-convergence/admin/",
      "https://learning-platform-chi-ten.vercel.app/learn/analysis-1-lab/Bad_Slug/",
      "https://learning-platform-chi-ten.vercel.app.evil.example/learn/analysis-1-lab/sequence-convergence/",
    ]) {
      const url = new URL("https://researchquest.example/tasks?source=learning-platform&title=Read&lessonUrl=" + encodeURIComponent(unsafe));
      expect(readLearningTaskHandoff(url)?.lessonUrl).toBeNull();
      expect(readLearningTaskHandoff(url)?.description).not.toContain("Open lesson:");
    }
  });

  it("bounds maximum handoff text and preserves the exact trusted return URL", () => {
    const lessonUrl = "https://learning-platform-chi-ten.vercel.app/learn/analysis-1-lab/sequence-convergence/?ref=" + "x".repeat(700);
    const url = new URL("https://researchquest.example/tasks");
    url.searchParams.set("source", "learning-platform");
    url.searchParams.set("title", "T".repeat(200));
    url.searchParams.set("subject", "S".repeat(120));
    url.searchParams.set("lesson", "L".repeat(200));
    url.searchParams.set("prompt", "P".repeat(500));
    url.searchParams.set("lessonUrl", lessonUrl);
    const draft = readLearningTaskHandoff(url);
    expect(draft?.description.length).toBeLessThanOrEqual(1000);
    expect(draft?.description).toContain(`Open lesson: ${lessonUrl}`);
    expect(savedAtlasLessonUrl(draft?.description)).toBe(lessonUrl);
    expect(draft?.description).toContain("Subject: ");
  });
});

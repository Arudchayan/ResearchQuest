const ATLAS_ORIGIN = "https://learning-platform-chi-ten.vercel.app";
// Leave room for the origin marker and exact URL in a 1000-character task description.
const MAX_TRUSTED_URL_LENGTH = 900;
const SHARED_LESSON_PATH = /^\/learn\/(?:analysis-1-lab|bioinformatics-algorithms-lab|drug-discovery-lab|multimedia-retrieval-lab|random-processes-lab|scientific-computing-ch1)\/[a-z0-9]+(?:-[a-z0-9]+)*\/$/;
const APPROVED_LEGACY_PATHS = new Set([
  "/analysis-1-lab/",
  "/analysis-1-lab/index.html",
  "/analysis-1-lab/reader.html",
  "/bioinformatics-algorithms-lab/",
  "/bioinformatics-algorithms-lab/index.html",
  "/multimedia-retrieval-lab/",
  "/multimedia-retrieval-lab/index.html",
  "/multimedia-retrieval-lab/chapter-01.html",
  "/multimedia-retrieval-lab/chapter-02.html",
  "/random-processes-lab/",
  "/random-processes-lab/index.html",
  "/scientific-computing-ch1/",
  "/scientific-computing-ch1/index.html",
]);

/** Validate the same exact Atlas destinations for drafts and saved task links. */
export function trustedAtlasLessonUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.origin !== ATLAS_ORIGIN || url.username || url.password) return null;
    if (url.href.length > MAX_TRUSTED_URL_LENGTH) return null;
    if (!SHARED_LESSON_PATH.test(url.pathname) && !APPROVED_LEGACY_PATHS.has(url.pathname)) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** A saved task can carry an Atlas URL as text, but only approved lesson paths become links. */
export function savedAtlasLessonUrl(description: string | undefined | null): string | null {
  if (!description?.split(/\r?\n/).some((line) => line === "From Learning Platform")) return null;

  const lines = description.split(/\r?\n/).filter((line) => line.startsWith("Open lesson: "));
  if (lines.length !== 1) return null;

  return trustedAtlasLessonUrl(lines[0].slice("Open lesson: ".length).trim());
}

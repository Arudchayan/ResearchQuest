import { trustedAtlasLessonUrl } from "./savedLessonLink";

export interface LearningTaskDraft {
  title: string;
  description: string;
  lessonUrl: string | null;
}

const HANDOFF_KEYS = ["source", "subject", "lesson", "title", "lessonUrl", "prompt"] as const;
const MAX_DESCRIPTION_LENGTH = 1000;

function clean(value: string | null, maxLength: number): string {
  return Array.from(value ?? "", char => {
    const code = char.charCodeAt(0);
    return code < 32 || code === 127 ? " " : char;
  }).join("").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

/** Read only the explicit learning-platform task handoff. No task is saved here. */
export function readLearningTaskHandoff(url: URL): LearningTaskDraft | null {
  if (url.pathname !== "/tasks" || url.searchParams.get("source") !== "learning-platform") {
    return null;
  }

  const title = clean(url.searchParams.get("title"), 200);
  if (!title) return null;

  const subject = clean(url.searchParams.get("subject"), 120);
  const lesson = clean(url.searchParams.get("lesson"), 200);
  const prompt = clean(url.searchParams.get("prompt"), 500);
  const lessonUrl = trustedAtlasLessonUrl(url.searchParams.get("lessonUrl"));
  const lines = ["From Learning Platform"];
  const returnLine = lessonUrl ? `Open lesson: ${lessonUrl}` : null;
  const reservedForReturn = returnLine ? 1 + returnLine.length : 0;
  for (const [label, value] of [
    ["Subject: ", subject],
    ["Lesson: ", lesson],
    ["Suggested investigation: ", prompt],
  ]) {
    if (!value) continue;
    const used = lines.join("\n").length;
    const available = MAX_DESCRIPTION_LENGTH - used - reservedForReturn - 1 - label.length;
    if (available > 0) lines.push(label + value.slice(0, available));
  }
  if (returnLine) lines.push(returnLine);
  const description = lines.join("\n");

  return { title, description, lessonUrl };
}

/** Remove consumed handoff fields while retaining unrelated query state. */
export function clearLearningTaskHandoff(url: URL): string {
  const cleaned = new URL(url);
  for (const key of HANDOFF_KEYS) cleaned.searchParams.delete(key);
  return `${cleaned.pathname}${cleaned.search}${cleaned.hash}`;
}


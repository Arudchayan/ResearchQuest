import { readLearningTaskHandoff } from "../components/tasks/learningHandoff";
import { DEMO_FIRST_RUN_PATH } from "./demoData";

/** Preserve a valid lesson task draft when entering demo; otherwise use first run. */
export function demoEntryPath(url: URL): string {
  if (!readLearningTaskHandoff(url)) return DEMO_FIRST_RUN_PATH;
  return `${url.pathname}${url.search}${url.hash}`;
}

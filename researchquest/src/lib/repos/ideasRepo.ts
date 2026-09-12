import { makeEntityRepo } from "./entityRepo";
import type { Idea } from "../../types/database";

/** ideas table access (PR15 item 39). Chains mirror useEntityCrud. */
export const ideasRepo = makeEntityRepo<Idea>("ideas");

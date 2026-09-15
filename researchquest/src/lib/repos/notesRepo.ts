import { makeEntityRepo } from "./entityRepo";
import type { Note } from "../../types/database";

/** notes table access (PR15 item 39). Chains mirror useEntityCrud. */
export const notesRepo = makeEntityRepo<Note>("notes");

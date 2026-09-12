import { makeEntityRepo } from "./entityRepo";
import type { Topic } from "../../types/database";

/** topics table access (PR15 item 39). Chains mirror useEntityCrud. */
export const topicsRepo = makeEntityRepo<Topic>("topics");

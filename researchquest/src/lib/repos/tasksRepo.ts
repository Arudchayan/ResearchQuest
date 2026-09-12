import { makeEntityRepo } from "./entityRepo";
import type { Task } from "../../types/database";

/** tasks table access (PR15 item 39). Chains mirror useEntityCrud. */
export const tasksRepo = makeEntityRepo<Task>("tasks");

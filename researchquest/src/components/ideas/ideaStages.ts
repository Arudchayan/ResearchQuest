import type { IdeaStage } from "../../types/database";
import type { BadgeVariant } from "../ui/Badge";

export interface IdeaStageDefinition {
  readonly id: IdeaStage;
  readonly label: string;
  readonly description: string;
  readonly badgeVariant: Extract<BadgeVariant, `stage-${string}`>;
  readonly selectClassName: string;
  readonly edgeClassName: string;
  readonly fillClassName: string;
}

export const IDEA_STAGES = [
  {
    id: "Seed",
    label: "Seed",
    description: "Fresh hypotheses waiting for exploration",
    badgeVariant: "stage-seed",
    selectClassName: "border-stage-seed bg-stage-seed-bg text-stage-seed",
    edgeClassName: "border-t-2 border-t-stage-seed",
    fillClassName: "bg-stage-seed",
  },
  {
    id: "Developing",
    label: "Developing",
    description: "Ideas being validated and connected",
    badgeVariant: "stage-developing",
    selectClassName:
      "border-stage-developing bg-stage-developing-bg text-stage-developing",
    edgeClassName: "border-t-2 border-t-stage-developing",
    fillClassName: "bg-stage-developing",
  },
  {
    id: "Supported",
    label: "Supported",
    description: "Concepts with evidence or linked notes",
    badgeVariant: "stage-supported",
    selectClassName:
      "border-stage-supported bg-stage-supported-bg text-stage-supported",
    edgeClassName: "border-t-2 border-t-stage-supported",
    fillClassName: "bg-stage-supported",
  },
  {
    id: "Mature",
    label: "Mature",
    description: "Ready to share, publish, or archive",
    badgeVariant: "stage-mature",
    selectClassName: "border-stage-mature bg-stage-mature-bg text-stage-mature",
    edgeClassName: "border-t-2 border-t-stage-mature",
    fillClassName: "bg-stage-mature",
  },
] as const satisfies readonly IdeaStageDefinition[];

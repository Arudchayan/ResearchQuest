import { memo } from "react";
import {
  Compass,
  FileText,
  BookOpen,
  Lightbulb,
  Target,
  ListChecks,
  Sprout,
  Sparkles,
  Coffee,
} from "lucide-react";
import type { ReadingStatus, IdeaStage } from "../../types/database";

interface FocusStudioWidgetProps {
  workspaceStats: {
    key: string;
    label: string;
    count: number;
    icon: React.ElementType;
  }[];
  readingStatusCounts: Record<ReadingStatus, number>;
  ideaStageCounts: Record<IdeaStage, number>;
  focusPrompts: { title: string; detail: string }[];
  focusReflection: string;
}

const FocusStudioWidgetComponent = ({
  workspaceStats,
  readingStatusCounts,
  ideaStageCounts,
  focusPrompts,
  focusReflection,
}: FocusStudioWidgetProps) => {
  return (
    <div className="mt-4 p-4 bg-bg-elevated rounded-lg border border-border-subtle space-y-4">
      <div className="flex items-center gap-2 text-text-primary">
        <Compass className="w-4 h-4 text-primary-500" />
        <h3 className="text-small font-semibold uppercase tracking-wide">
          Focus Studio
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {workspaceStats.map(({ key, label, count, icon: StatIcon }) => (
          <div
            key={key}
            className="flex items-center gap-3 p-3 bg-bg-base/60 rounded-md border border-border-subtle/60"
          >
            <StatIcon className="w-4 h-4 text-primary-500" />
            <div>
              <p className="text-lg font-semibold text-text-primary">{count}</p>
              <p className="text-caption text-text-secondary uppercase tracking-wide">
                {label}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-text-primary">
          <ListChecks className="w-4 h-4 text-primary-500" />
          <p className="text-small font-medium">Reading pipeline</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["To Read", "Reading", "Read"] as ReadingStatus[]).map((status) => (
            <span
              key={status}
              className="px-3 py-1 rounded-full border border-border-subtle text-caption text-text-secondary"
            >
              <span className="font-semibold text-text-primary">
                {readingStatusCounts[status]}
              </span>{" "}
              {status}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-text-primary">
          <Sprout className="w-4 h-4 text-success" />
          <p className="text-small font-medium">Idea garden</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["Seed", "Developing", "Supported", "Mature"] as IdeaStage[]).map(
            (stage) => (
              <span
                key={stage}
                className="px-3 py-1 rounded-full border border-border-subtle text-caption text-text-secondary"
              >
                <span className="font-semibold text-text-primary">
                  {ideaStageCounts[stage]}
                </span>{" "}
                {stage}
              </span>
            ),
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-text-primary">
          <Sparkles className="w-4 h-4 text-primary-500" />
          <p className="text-small font-medium">Focus prompts</p>
        </div>
        <ul className="space-y-2">
          {focusPrompts.map((prompt) => (
            <li
              key={prompt.title}
              className="p-3 rounded-md bg-bg-base/60 border border-border-subtle/60"
            >
              <p className="text-small font-semibold text-text-primary">
                {prompt.title}
              </p>
              <p className="text-caption text-text-secondary mt-1">
                {prompt.detail}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-start gap-3">
        <Coffee className="w-4 h-4 mt-1 text-success" />
        <p className="text-caption text-text-secondary leading-relaxed">
          {focusReflection}
        </p>
      </div>
    </div>
  );
};

export const FocusStudioWidget = memo(FocusStudioWidgetComponent);

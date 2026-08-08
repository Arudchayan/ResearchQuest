import type { ComponentType } from "react";
import { ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { Skeleton, ListSkeleton } from "../ui/Skeleton";
import { useAppStore } from "../../store/appStore";
import type {
  FocusTargetType,
  SelectedTarget,
  CollapsedGroups,
  CollapsiblePanel,
} from "./focusUtils";

interface QuickTargetItem {
  id: string;
  title: string;
  meta: string;
}

interface QuickTargetGroup {
  type: FocusTargetType;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  items: QuickTargetItem[];
}

interface FocusInsight {
  title: string;
  detail: string;
}

interface FocusTargetAsideProps {
  isLoading: boolean;
  quickTargets: QuickTargetGroup[];
  selectedTarget: SelectedTarget | null;
  handleTargetSelection: (target: SelectedTarget) => void;
  collapsedGroups: CollapsedGroups;
  toggleGroup: (type: FocusTargetType) => void;
  collapsedPanels: Record<CollapsiblePanel, boolean>;
  togglePanel: (panel: CollapsiblePanel) => void;
  focusInsights: FocusInsight[];
}

const GROUP_ICON_STYLES: Record<FocusTargetType, string> = {
  note: "bg-blue-soft text-blue-strong",
  paper: "bg-violet-soft text-violet-strong",
  task: "bg-coral-soft text-coral-strong",
};

export function FocusTargetAside({
  isLoading,
  quickTargets,
  selectedTarget,
  handleTargetSelection,
  collapsedGroups,
  toggleGroup,
  collapsedPanels,
  togglePanel,
  focusInsights,
}: FocusTargetAsideProps) {
  const setCurrentView = useAppStore((state) => state.setCurrentView);

  return (
    <aside className="space-y-6">
      {isLoading ? (
        <div className="space-y-4">
          {[
            { key: "note" as const, label: "Notes" },
            { key: "paper" as const, label: "Papers" },
            { key: "task" as const, label: "Tasks" },
          ].map(({ key, label }) => (
            <div
              key={key}
              className="surface-card p-5 space-y-4"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-text-secondary">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <span>{label}</span>
              </div>
              <ListSkeleton
                count={3}
                itemType={
                  key === "task"
                    ? "task"
                    : key === "paper"
                      ? "paper"
                      : "note"
                }
              />
            </div>
          ))}
        </div>
      ) : (
        quickTargets.map((group) => {
          const Icon = group.icon;
          const items = group.items;
          const isCollapsed = collapsedGroups[group.type];
          return (
            <div
              key={group.type}
              className="surface-card overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggleGroup(group.type)}
                className="w-full flex items-start justify-between gap-3 p-5 text-left"
                aria-expanded={!isCollapsed}
                aria-controls={`focus-group-${group.type}`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`icon-tile h-8 w-8 ${GROUP_ICON_STYLES[group.type]}`}>
                      <Icon className="w-4 h-4" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-text-primary">
                        {group.title}
                      </p>
                      <p className="text-caption text-text-tertiary mt-0.5">
                        {items.length} suggested
                      </p>
                    </div>
                  </div>
                  <p className="text-caption text-text-tertiary mt-1.5 ml-10">
                    {group.description}
                  </p>
                </div>
                {isCollapsed ? (
                  <ChevronRight
                    className="w-4 h-4 text-text-tertiary"
                    aria-hidden="true"
                  />
                ) : (
                  <ChevronDown
                    className="w-4 h-4 text-text-tertiary"
                    aria-hidden="true"
                  />
                )}
              </button>
              <div className="sr-only" role="status" aria-live="polite">
                {!isCollapsed && items.length === 0 ? (
                  group.type === "note"
                    ? "No notes yet. Create one to capture your thinking."
                    : group.type === "paper"
                    ? "No papers are marked for reading. Add one from the Papers tab."
                    : group.type === "task"
                    ? "No active tasks. Create a task to anchor your next focus sprint."
                    : ""
                ) : ""}
              </div>
              {!isCollapsed && (
                <div
                  id={`focus-group-${group.type}`}
                  className="border-t border-border-subtle"
                >
                  {items.length > 0 ? (
                    <ul className="divide-y divide-border-subtle/60">
                      {items.map((item) => {
                        const isActive =
                          selectedTarget?.type === group.type &&
                          selectedTarget.id === item.id;
                        return (
                          <li key={item.id}>
                            <button
                              onClick={() =>
                                handleTargetSelection({
                                  type: group.type,
                                  id: item.id,
                                })
                              }
                              className={`w-full text-left px-5 py-3 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                                isActive
                                  ? "bg-accent-soft text-accent-strong"
                                  : "hover:bg-bg-elevated"
                              }`}
                              type="button"
                              aria-pressed={isActive}
                              title={`Focus on ${item.title}`}
                            >
                              <p className="text-sm font-semibold text-text-primary line-clamp-2">
                                {item.title}
                              </p>
                              <p className="text-caption text-text-tertiary mt-1">
                                {item.meta}
                              </p>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="px-5 py-6 text-sm text-text-tertiary">
                      {group.type === "note" &&
                        "No notes yet. Create one to capture your thinking."}
                      {group.type === "paper" &&
                        "No papers are marked for reading. Add one from the Papers tab."}
                      {group.type === "task" &&
                        "No active tasks. Create a task to anchor your next focus sprint."}
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between px-5 py-3 border-t border-border-subtle/60 text-caption">
                <span className="sr-only">
                  {items.length} suggested {group.title.toLowerCase()}
                </span>
                <button
                  className="ml-auto inline-flex items-center gap-1 text-accent-strong hover:text-accent font-medium"
                  onClick={() => {
                    const targetView =
                      group.type === "task"
                        ? "tasks"
                        : group.type === "paper"
                          ? "papers"
                          : "notes";
                    setCurrentView(targetView);
                    window.history.pushState(
                      null,
                      "",
                      targetView === "notes" ? "/" : `/${targetView}`,
                    );
                  }}
                  type="button"
                  title={`Open all ${group.title.toLowerCase()}`}
                  aria-label={`Open the full ${group.title.toLowerCase()} view`}
                >
                  View all
                </button>
              </div>
            </div>
          );
        })
      )}

      <div className="surface-card overflow-hidden">
        <button
          type="button"
          onClick={() => togglePanel("suggestions")}
          className="w-full flex items-center justify-between gap-2 p-5 text-sm font-semibold text-text-primary hover:bg-bg-elevated transition-colors"
          aria-expanded={!collapsedPanels.suggestions}
        >
          <span className="inline-flex items-center gap-2">
            <span className="icon-tile h-8 w-8 bg-gold-soft text-gold-strong">
              <Sparkles className="w-4 h-4" aria-hidden="true" />
            </span>
            <span>
              <span className="block">Suggested moves</span>
              <span className="block text-caption font-normal text-text-tertiary mt-0.5">
                Focus intelligence
              </span>
            </span>
          </span>
          {collapsedPanels.suggestions ? (
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-4 h-4" aria-hidden="true" />
          )}
        </button>
        {!collapsedPanels.suggestions && (
          <ul className="p-5 pt-0 space-y-2">
            {focusInsights.map((insight) => (
              <li
                key={insight.title}
                className="p-3 rounded-lg bg-bg-elevated border border-border-subtle"
              >
                <p className="text-sm font-semibold text-text-primary">
                  {insight.title}
                </p>
                <p className="text-caption text-text-secondary mt-1">
                  {insight.detail}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

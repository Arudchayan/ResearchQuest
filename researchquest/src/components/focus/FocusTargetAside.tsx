import type { LucideIcon } from "lucide-react";
import { ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { useAppStore } from "../../store/appStore";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { EmptyState } from "../ui/EmptyState";
import { Skeleton, ListSkeleton } from "../ui/Skeleton";
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
  icon: LucideIcon;
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
    <aside
      className="min-w-0 space-y-6"
      aria-label="Focus targets and suggestions"
    >
      {isLoading ? (
        <div
          className="space-y-4"
          role="status"
          aria-busy="true"
          aria-label="Loading focus targets"
        >
          {[
            { key: "note" as const, label: "Notes" },
            { key: "paper" as const, label: "Papers" },
            { key: "task" as const, label: "Tasks" },
          ].map(({ key, label }) => (
            <Card key={key} className="space-y-4 p-4 sm:p-5">
              <div className="flex items-center gap-2 text-small font-semibold text-text-secondary">
                <Skeleton className="h-4 w-4 rounded-control" />
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
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4" aria-label="Suggested focus targets">
          {quickTargets.map((group) => {
            const Icon = group.icon;
            const items = group.items;
            const isCollapsed = collapsedGroups[group.type];
            return (
              <Card key={group.type} className="min-w-0 overflow-hidden">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => toggleGroup(group.type)}
                  className="h-auto min-h-11 w-full justify-between whitespace-normal rounded-none p-4 text-left sm:p-5"
                  aria-expanded={!isCollapsed}
                  aria-controls={`focus-group-${group.type}`}
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-small font-semibold text-text-secondary">
                      <Icon
                        className="h-4 w-4 shrink-0 text-text-tertiary"
                        aria-hidden="true"
                      />
                      <span>{group.title}</span>
                    </span>
                    <span className="mt-1 block text-small font-normal text-text-tertiary">
                      {group.description}
                    </span>
                  </span>
                  {isCollapsed ? (
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-text-tertiary"
                      aria-hidden="true"
                    />
                  ) : (
                    <ChevronDown
                      className="h-4 w-4 shrink-0 text-text-tertiary"
                      aria-hidden="true"
                    />
                  )}
                </Button>

                {!isCollapsed && (
                  <div
                    id={`focus-group-${group.type}`}
                    className="border-t border-border-subtle"
                  >
                    {items.length > 0 ? (
                      <ul className="divide-y divide-border-subtle">
                        {items.map((item) => {
                          const isActive =
                            selectedTarget?.type === group.type &&
                            selectedTarget.id === item.id;
                          return (
                            <li key={item.id}>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() =>
                                  handleTargetSelection({
                                    type: group.type,
                                    id: item.id,
                                  })
                                }
                                className={`h-auto min-h-11 w-full justify-start whitespace-normal rounded-none px-4 py-3 text-left sm:px-5 ${
                                  isActive
                                    ? "border-l-2 border-primary-500 bg-primary-50 text-primary-600"
                                    : "hover:bg-bg-elevated"
                                }`}
                                aria-pressed={isActive}
                                title={`Focus on ${item.title}`}
                              >
                                <span className="min-w-0">
                                  <span className="block break-words text-small font-semibold text-text-primary">
                                    {item.title}
                                  </span>
                                  <span className="mt-1 block text-caption text-text-tertiary">
                                    {item.meta}
                                  </span>
                                </span>
                              </Button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <EmptyState
                        className="items-start gap-2 p-4 text-left"
                        title={
                          group.type === "note"
                            ? "No notes yet"
                            : group.type === "paper"
                              ? "No papers to read"
                              : "No active tasks"
                        }
                        description={
                          group.type === "note"
                            ? "Create a note to capture your thinking."
                            : group.type === "paper"
                              ? "Add a paper from the Papers view."
                              : "Create a task to anchor your next sprint."
                        }
                      />
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle px-4 py-3 text-caption sm:px-5">
                  <span className="text-text-tertiary">
                    <span className="font-mono tabular-nums">{items.length}</span>{" "}
                    suggested {group.title.toLowerCase()}
                  </span>
                  <Button
                    variant="link"
                    type="button"
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
                        `/${targetView}`,
                      );
                    }}
                    className="h-auto min-h-11 px-0 py-0 text-small"
                    title={`Open all ${group.title.toLowerCase()}`}
                    aria-label={`Open the full ${group.title.toLowerCase()} view`}
                  >
                    View all
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="min-w-0 overflow-hidden">
        <Button
          type="button"
          variant="ghost"
          onClick={() => togglePanel("suggestions")}
          className="h-auto min-h-11 w-full justify-between rounded-none p-4 text-small font-semibold text-text-secondary sm:p-5"
          aria-expanded={!collapsedPanels.suggestions}
          aria-controls="focus-suggestions"
        >
          <span className="inline-flex items-center gap-2">
            <Sparkles
              className="h-4 w-4 text-text-tertiary"
              aria-hidden="true"
            />
            Suggested moves
          </span>
          {collapsedPanels.suggestions ? (
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
        {!collapsedPanels.suggestions && (
          <div id="focus-suggestions" className="border-t border-border-subtle">
            {focusInsights.length > 0 ? (
              <ul className="space-y-2 p-4 sm:p-5 sm:pt-4">
                {focusInsights.map((insight) => (
                  <li
                    key={insight.title}
                    className="rounded-control border border-border-subtle bg-bg-elevated p-3"
                  >
                    <p className="text-small font-semibold text-text-primary">
                      {insight.title}
                    </p>
                    <p className="mt-1 text-small text-text-secondary">
                      {insight.detail}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                className="items-start gap-2 p-4 text-left sm:p-5"
                title="No suggested moves"
                description="Your library is ready when you are."
              />
            )}
          </div>
        )}
      </Card>
    </aside>
  );
}

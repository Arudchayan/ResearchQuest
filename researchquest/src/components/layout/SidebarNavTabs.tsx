import type { LucideIcon } from "lucide-react";
import {
  FileText,
  BookOpen,
  Lightbulb,
  CheckSquare,
  Hash,
  Target,
} from "lucide-react";

type TabId = "notes" | "papers" | "ideas" | "tasks" | "topics" | "dashboard" | "focus";

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "notes", label: "Notes", icon: FileText },
  { id: "papers", label: "Papers", icon: BookOpen },
  { id: "ideas", label: "Ideas", icon: Lightbulb },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "topics", label: "Topics", icon: Hash },
  { id: "focus", label: "Focus", icon: Target },
];

interface SidebarNavTabsProps {
  currentView: TabId;
  handleTabClick: (tabId: TabId) => void;
  nextDeadlineBadge: string | null;
  activeBoost: unknown;
  boostCountdown: string | null;
}

export function SidebarNavTabs({
  currentView,
  handleTabClick,
  nextDeadlineBadge,
  activeBoost,
  boostCountdown,
}: SidebarNavTabsProps) {
  return (
    <nav className="space-y-1">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentView === tab.id;
        let badgeText: string | null = null;
        let badgeStyle = "";
        const badgeAlignment = isActive ? "ml-2" : "ml-auto";

        if (tab.id === "tasks" && nextDeadlineBadge) {
          badgeText = nextDeadlineBadge;
          badgeStyle =
            "bg-warning-bg text-warning border border-warning/30";
        } else if (tab.id === "notes" && activeBoost && boostCountdown) {
          badgeText = boostCountdown;
          badgeStyle =
            "bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-200";
        }

        return (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-md transition-all duration-200 relative focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 ${
              isActive
                ? "bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-100 font-semibold shadow-sm"
                : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
            }`}
            aria-current={isActive ? "page" : undefined}
          >
            <div
              className={`absolute left-2 top-1 bottom-1 w-1.5 bg-primary-500 rounded-full transition-all duration-200 ${
                isActive
                  ? "opacity-100 scale-y-100"
                  : "opacity-0 scale-y-0"
              }`}
              aria-hidden="true"
            />
            <Icon
              className={`w-5 h-5 ${
                isActive
                  ? "text-primary-600 dark:text-primary-200"
                  : "text-text-secondary"
              }`}
              aria-hidden="true"
            />
            <span
              className={`text-small ${isActive ? "font-semibold" : "font-medium"}`}
            >
              {tab.label}
            </span>
            {isActive && (
              <span
                className="ml-auto text-caption font-semibold text-primary-500 dark:text-primary-200"
                aria-hidden="true"
              >
                Active
              </span>
            )}
            {badgeText && (
              <span
                className={`${badgeAlignment} text-caption px-2 py-0.5 rounded-full font-semibold ${badgeStyle}`}
              >
                {badgeText}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

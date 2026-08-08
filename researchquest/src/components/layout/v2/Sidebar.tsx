import { useState, useEffect } from "react";
import {
  DashboardIcon,
  MagnifyingGlassIcon,
  TargetIcon,
  ExitIcon,
  ViewVerticalIcon,
  ActivityLogIcon,
} from "@radix-ui/react-icons";
import {
  FileText,
  Lightbulb,
  CheckSquare,
  Sun,
  Moon,
  Flame,
  Keyboard,
  Database,
  Maximize2,
  Hash,
  BookOpen,
  Inbox,
  Sparkles,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { useAppStore } from "../../../store/appStore";
import { cn } from "../../../lib/utils";
import { supabase } from "../../../lib/supabase";
import { XPExplainer } from "../XPExplainer";
import { ProfileDialog } from "../ProfileDialog";
import { DataManagementDialog } from "../../settings/DataManagementDialog";
import { useShallow } from "zustand/react/shallow";
import { Tooltip, TooltipTrigger, TooltipContent } from "../../ui/tooltip";

export function Sidebar() {
  const {
    currentView,
    setCurrentView,
    user,
    effectiveTheme,
    setTheme,
    isRightSidebarOpen,
    setIsRightSidebarOpen,
    setZenMode,
    setIsMobileSidebarOpen,
  } = useAppStore(
    useShallow((state) => ({
      currentView: state.currentView,
      setCurrentView: state.setCurrentView,
      user: state.user,
      effectiveTheme: state.effectiveTheme,
      setTheme: state.setTheme,
      isRightSidebarOpen: state.isRightSidebarOpen,
      setIsRightSidebarOpen: state.setIsRightSidebarOpen,
      setZenMode: state.setZenMode,
      setIsMobileSidebarOpen: state.setIsMobileSidebarOpen,
    })),
  );
  const [showXpGuide, setShowXpGuide] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showDataDialog, setShowDataDialog] = useState(false);

  useEffect(() => {
    const handleOpenDataManagement = () => setShowDataDialog(true);
    document.addEventListener("open-data-management", handleOpenDataManagement);
    return () =>
      document.removeEventListener(
        "open-data-management",
        handleOpenDataManagement,
      );
  }, []);

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: DashboardIcon },
    { id: "notes", label: "Notes", icon: FileText },
    { id: "papers", label: "Papers", icon: BookOpen },
    { id: "ideas", label: "Ideas", icon: Lightbulb },
    { id: "tasks", label: "Tasks", icon: CheckSquare },
    { id: "topics", label: "Topics", icon: Hash },
    { id: "feeds", label: "Feeds", icon: Inbox },
    { id: "focus", label: "Focus Studio", icon: TargetIcon },
    { id: "analysis", label: "Adversarial Analysis", icon: ShieldCheck },
  ] as const;

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const toggleTheme = () => {
    const newTheme = effectiveTheme === "light" ? "dark" : "light";
    setTheme(newTheme);
  };

  const handleOpenSearch = () => {
    document.dispatchEvent(new CustomEvent("open-command-palette"));
  };

  const handleOpenShortcuts = () => {
    document.dispatchEvent(new CustomEvent("open-shortcuts-help"));
  };

  const xpProgress = user ? ((user.total_xp % 500) / 500) * 100 : 0;
  const currentLevel = user?.current_level || 1;
  const xpInLevel = user ? user.total_xp % 500 : 0;

  return (
    <aside className="relative z-10 flex h-full w-full flex-col border-r border-border-subtle bg-bg-surface transition-colors duration-300">
      <div className="px-5 pb-4 pt-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="brand-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white shadow-glow">
            RQ
          </div>
          <div className="min-w-0">
            <div className="truncate font-serif text-lg font-bold text-text-primary">
              ResearchQuest
            </div>
            <div className="text-caption text-text-tertiary">Research cockpit</div>
          </div>
        </div>

        <button
          onClick={handleOpenSearch}
          className="group flex w-full items-center justify-between rounded-lg border border-border-moderate bg-bg-base px-3 py-2.5 text-small text-text-secondary shadow-sm transition-colors hover:border-accent hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
          aria-label="Search or type a command"
        >
          <span className="flex items-center gap-2">
            <MagnifyingGlassIcon className="h-4 w-4" aria-hidden="true" />
            <span>Search...</span>
          </span>
          <kbd className="hidden rounded-md border border-border-subtle bg-bg-surface px-1.5 py-0.5 text-caption font-medium text-text-tertiary sm:inline-block">
            Ctrl K
          </kbd>
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3" aria-label="Primary navigation">
        {navItems.map((item) => {
          const active = currentView === item.id;
          return (
            <a
              key={item.id}
              href={item.id === "dashboard" ? "/" : `/${item.id}`}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
                  return;
                }
                e.preventDefault();
                setCurrentView(item.id);
                setIsMobileSidebarOpen(false);
                window.history.pushState(
                  null,
                  "",
                  item.id === "dashboard" ? "/" : `/${item.id}`,
                );
              }}
              className={cn(
                "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-small font-medium transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2",
                active
                  ? "bg-accent-soft text-accent-strong shadow-sm"
                  : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary",
              )}
              aria-current={active ? "page" : undefined}
            >
              <item.icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  active ? "text-accent-strong" : "text-text-tertiary group-hover:text-text-secondary",
                )}
                aria-hidden="true"
              />
              <span className="flex-1">{item.label}</span>
              {active && (
                <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
              )}
            </a>
          );
        })}
      </nav>

      {user && (
        <div className="px-3 py-4">
          <div className="surface-card overflow-hidden p-3.5">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-caption font-bold uppercase tracking-wider text-text-primary">
                <Sparkles className="h-3.5 w-3.5 text-accent-strong" aria-hidden="true" />
                Level {currentLevel}
              </span>
              <button
                onClick={() => setShowXpGuide(true)}
                className="icon-btn -mr-1.5 -mt-1 h-7 w-7 text-text-tertiary"
                aria-label="Learn about XP and Levels"
              >
                <ActivityLogIcon className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
            <div className="progress-track h-2 w-full">
              <div className="progress-fill" style={{ width: `${xpProgress}%` }} />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-caption text-text-tertiary">
              <span>{xpInLevel} XP</span>
              <span>500 XP to level {currentLevel + 1}</span>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-1 border-t border-border-subtle px-3 py-3">
        <div className="flex items-center justify-between px-1 pb-1">
          <button
            onClick={() => setShowProfile(true)}
            className="group flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-bg-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            aria-label="User profile"
          >
            <span className="brand-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm">
              {user?.username?.charAt(0).toUpperCase() || "U"}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-small font-semibold text-text-primary">
                {user?.username || "User"}
              </span>
              <span className="flex items-center gap-1 text-caption text-text-secondary">
                <Flame className="h-3 w-3 text-gold" aria-hidden="true" />
                {user?.current_streak || 0} day streak
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-text-tertiary" aria-hidden="true" />
          </button>
          <div className="flex shrink-0 items-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleOpenShortcuts}
                  className="icon-btn"
                  aria-label="Keyboard Shortcuts"
                >
                  <Keyboard className="h-4 w-4" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Keyboard Shortcuts</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
                  className="icon-btn"
                  aria-label={
                    isRightSidebarOpen
                      ? "Close context panel"
                      : "Open context panel"
                  }
                >
                  <ViewVerticalIcon className="h-4 w-4" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Toggle Context Panel (Ctrl/Cmd+.)</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setZenMode(true)}
                  className="icon-btn"
                  aria-label="Enter Zen Mode"
                >
                  <Maximize2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Enter Zen Mode (Ctrl+Shift+F)</p>
              </TooltipContent>
            </Tooltip>

            <button
              onClick={toggleTheme}
              className="icon-btn"
              aria-label={
                effectiveTheme === "light"
                  ? "Switch to dark mode"
                  : "Switch to light mode"
              }
            >
              {effectiveTheme === "light" ? (
                <Moon className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Sun className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        <div className="divider-hairline" aria-hidden="true" />

        <button
          onClick={() => setShowDataDialog(true)}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-small font-medium text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          <Database className="h-4 w-4" aria-hidden="true" />
          Data & API
        </button>

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-small font-medium text-coral-strong transition-colors hover:bg-coral-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          <ExitIcon className="h-4 w-4" aria-hidden="true" />
          Sign Out
        </button>
      </div>

      <XPExplainer
        open={showXpGuide}
        onClose={() => setShowXpGuide(false)}
        currentLevel={currentLevel}
        totalXP={user?.total_xp || 0}
      />

      <ProfileDialog open={showProfile} onClose={() => setShowProfile(false)} />

      <DataManagementDialog
        open={showDataDialog}
        onClose={() => setShowDataDialog(false)}
      />
    </aside>
  );
}

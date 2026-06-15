import { useState, useEffect } from "react";
import {
  DashboardIcon,
  MagnifyingGlassIcon,
  TargetIcon,
  ExitIcon,
  PersonIcon,
  ViewVerticalIcon,
  ActivityLogIcon,
} from "@radix-ui/react-icons";
import {
  FileText,
  Lightbulb,
  CheckSquare,
  Clock,
  Sun,
  Moon,
  Flame,
  HelpCircle,
  Database,
  Keyboard,
  Maximize2,
  Hash,
  BookOpen,
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
    { id: "focus", label: "Focus Studio", icon: TargetIcon },
  ] as const;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // State update handled by auth listener in App.tsx
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
    <aside className="w-64 bg-bg-surface border-r border-border-subtle flex flex-col h-full transition-colors duration-300 relative z-10">
      <div className="p-6 pb-4">
        <div className="flex items-center gap-3 text-text-primary mb-6">
          <div className="w-8 h-8 bg-text-primary rounded-sm flex items-center justify-center text-bg-base font-serif font-bold text-lg">
            RQ
          </div>
          <span className="font-serif font-bold text-xl tracking-tight text-text-primary">
            ResearchQuest
          </span>
        </div>

        <button
          onClick={handleOpenSearch}
          className="w-full flex items-center justify-between px-3 py-2 rounded-sm bg-bg-base border border-border-moderate text-small text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors shadow-sm focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary-500 focus-visible:outline-offset-2"
          aria-label="Search or type a command"
        >
          <div className="flex items-center gap-2">
            <MagnifyingGlassIcon className="w-4 h-4" />
            <span>Search...</span>
          </div>
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-caption font-medium text-text-tertiary bg-bg-elevated rounded-sm border border-border-subtle">
            <span className="mr-0.5">{navigator.platform.includes("Mac") ? "⌘" : "Ctrl+"}</span>K
          </kbd>
        </button>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => (
          <a
            key={item.id}
            href={item.id === "dashboard" ? "/" : `/${item.id}`}
            onClick={(e) => {
              // Allow default behavior (new tab) if modifier keys are pressed
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
                return;
              }
              e.preventDefault();
              setCurrentView(item.id);
              setIsMobileSidebarOpen(false);
              // Update URL without reload
              window.history.pushState(
                null,
                "",
                item.id === "dashboard" ? "/" : `/${item.id}`,
              );
            }}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-sm text-small font-medium transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary-500 focus-visible:outline-offset-2",
              currentView === item.id
                ? "bg-primary-50 text-text-primary font-semibold"
                : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary",
            )}
            aria-current={currentView === item.id ? "page" : undefined}
          >
            <item.icon className="w-5 h-5" aria-hidden="true" />
            {item.label}
          </a>
        ))}
      </nav>

      {user && (
        <div className="px-4 py-4 space-y-4">
          {/* XP Card */}
          <div className="p-3 bg-bg-base rounded-sm border border-border-subtle shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-caption font-serif font-bold text-text-primary tracking-wide uppercase">
                Level {currentLevel}
              </span>
              <button
                onClick={() => setShowXpGuide(true)}
                className="text-text-tertiary hover:text-primary-500 rounded-sm focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary-500"
                aria-label="Learn about XP and Levels"
              >
                <ActivityLogIcon className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
            <div className="h-1.5 w-full bg-border-subtle rounded-none overflow-hidden mb-1">
              <div
                className="h-full bg-primary-500 transition-all duration-1000 ease-out"
                style={{ width: `${xpProgress}%` }}
              />
            </div>
            <div className="flex justify-between text-caption text-text-tertiary">
              <span>{xpInLevel} XP</span>
              <span>500 XP</span>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 border-t border-border-subtle space-y-1">
        <div className="flex items-center justify-between px-3 py-2">
          <button
            onClick={() => setShowProfile(true)}
            className="flex items-center gap-2 hover:bg-bg-elevated rounded-sm p-1 -ml-1 transition-colors text-left focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary-500"
            aria-label="User profile"
          >
            <div className="w-8 h-8 rounded-full bg-bg-base border border-border-moderate text-text-primary flex items-center justify-center font-serif font-bold">
              {user?.username?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="text-xs">
              <span className="block font-medium text-text-primary truncate max-w-[80px]">
                {user?.username || "User"}
              </span>
              <span className="flex items-center gap-1 text-text-secondary">
                <Flame className="w-3 h-3 text-warning" aria-hidden="true" />{" "}
                {user?.current_streak || 0}
              </span>
            </div>
          </button>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleOpenShortcuts}
                  className="p-1.5 text-text-secondary hover:bg-bg-elevated hover:text-text-primary rounded-sm transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary-500"
                  aria-label="Keyboard Shortcuts"
                >
                  <Keyboard className="w-4 h-4" aria-hidden="true" />
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
                  className="p-1.5 text-text-secondary hover:bg-bg-elevated hover:text-text-primary rounded-sm transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary-500"
                  aria-label={
                    isRightSidebarOpen
                      ? "Close context panel"
                      : "Open context panel"
                  }
                >
                  <ViewVerticalIcon className="w-4 h-4" aria-hidden="true" />
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
                  className="p-1.5 text-text-secondary hover:bg-bg-elevated hover:text-text-primary rounded-sm transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary-500"
                  aria-label="Enter Zen Mode"
                >
                  <Maximize2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Enter Zen Mode (Ctrl+Shift+F)</p>
              </TooltipContent>
            </Tooltip>

            <button
              onClick={toggleTheme}
              className="p-1.5 text-text-secondary hover:bg-bg-elevated hover:text-text-primary rounded-sm transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary-500"
              aria-label={
                effectiveTheme === "light"
                  ? "Switch to dark mode"
                  : "Switch to light mode"
              }
            >
              {effectiveTheme === "light" ? (
                <Moon className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Sun className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        <button
          onClick={() => setShowDataDialog(true)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-sm text-small font-medium text-text-secondary hover:bg-bg-elevated hover:text-text-primary transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary-500 focus-visible:outline-offset-2"
        >
          <Database className="w-4 h-4" aria-hidden="true" />
          Data & Backup
        </button>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-sm text-small font-medium text-warning hover:bg-warning-bg hover:text-warning transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary-500 focus-visible:outline-offset-2"
        >
          <ExitIcon className="w-4 h-4" aria-hidden="true" />
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
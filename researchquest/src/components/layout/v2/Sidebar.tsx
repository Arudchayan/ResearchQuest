import { useState, useEffect } from "react";
import {
  BookOpen,
  FileText,
  Lightbulb,
  CheckSquare,
  Clock,
  Settings,
  LogOut,
  User,
  Sun,
  Moon,
  Flame,
  HelpCircle,
  Database,
  PanelRightOpen,
  PanelRightClose,
  Keyboard,
  LayoutDashboard,
  Search,
  Maximize2,
} from "lucide-react";
import { useAppStore } from "../../../store/appStore";
import { cn } from "../../../lib/utils";
import { supabase } from "../../../lib/supabase";
import { XPExplainer } from "../XPExplainer";
import { ProfileDialog } from "../ProfileDialog";
import { DataManagementDialog } from "../../settings/DataManagementDialog";
import { useShallow } from "zustand/react/shallow";

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
    { id: "dashboard", label: "Home", icon: LayoutDashboard },
    { id: "notes", label: "Notes", icon: FileText },
    { id: "papers", label: "Papers", icon: BookOpen },
    { id: "ideas", label: "Ideas", icon: Lightbulb },
    { id: "tasks", label: "Tasks", icon: CheckSquare },
    { id: "focus", label: "Focus", icon: Clock },
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
    <aside className="w-64 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-full transition-colors duration-300">
      <div className="p-6 pb-4">
        <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400 mb-6">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
            RQ
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-slate-100">
            ResearchQuest
          </span>
        </div>

        <button
          onClick={handleOpenSearch}
          className="w-full flex items-center justify-between px-3 py-2 rounded-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2"
          aria-label="Search or type a command"
        >
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4" />
            <span>Search...</span>
          </div>
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700">
            <span className="mr-0.5">⌘</span>K
          </kbd>
        </button>
      </div>


      <div className="px-4 pb-4">
        <button
          onClick={handleOpenSearch}
          className="w-full flex items-center gap-2 px-3 py-2 bg-slate-200/50 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-md text-sm transition-colors border border-slate-200 dark:border-slate-700/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2"
          aria-label="Search"
        >
          <Search className="w-4 h-4" />
          <span className="flex-1 text-left">Search...</span>
          <kbd className="hidden sm:inline-block text-[10px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
            {navigator.platform.includes("Mac") ? "⌘K" : "Ctrl+K"}
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
              // Update URL without reload
              window.history.pushState(
                null,
                "",
                item.id === "dashboard" ? "/" : `/${item.id}`,
              );
            }}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2",
              currentView === item.id
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800",
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
          <div className="p-3 bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-900 dark:text-white">
                Level {currentLevel}
              </span>
              <button
                onClick={() => setShowXpGuide(true)}
                className="text-slate-400 hover:text-blue-500 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
                aria-label="Learn about XP and Levels"
              >
                <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-1">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${xpProgress}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>{xpInLevel} XP</span>
              <span>500 XP</span>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-1">
        <div className="flex items-center justify-between px-3 py-2">
          <button
            onClick={() => setShowProfile(true)}
            className="flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md p-1 -ml-1 transition-colors text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
            aria-label="User profile"
          >
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <User className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="text-xs">
              <span className="block font-medium text-slate-900 dark:text-white truncate max-w-[80px]">
                User
              </span>
              <span className="flex items-center gap-1 text-slate-500">
                <Flame className="w-3 h-3 text-orange-500" aria-hidden="true" />{" "}
                {user?.current_streak || 0}
              </span>
            </div>
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={handleOpenShortcuts}
              className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
              aria-label="Keyboard Shortcuts"
              title="Keyboard Shortcuts"
            >
              <Keyboard className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
              className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
              aria-label={
                isRightSidebarOpen
                  ? "Close context panel"
                  : "Open context panel"
              }
              title="Toggle Context Panel"
            >
              {isRightSidebarOpen ? (
                <PanelRightClose className="w-4 h-4" aria-hidden="true" />
              ) : (
                <PanelRightOpen className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
            <button
              onClick={() => setZenMode(true)}
              className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
              aria-label="Enter Zen Mode"
              title="Enter Zen Mode (Ctrl+Shift+F)"
            >
              <Maximize2 className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              onClick={toggleTheme}
              className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
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
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2"
        >
          <Database className="w-5 h-5" aria-hidden="true" />
          Data & Backup
        </button>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2"
        >
          <LogOut className="w-5 h-5" aria-hidden="true" />
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

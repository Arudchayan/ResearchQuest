import { ReactNode, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { RightSidebar } from "../RightSidebar";
import { HamburgerMenuIcon, Cross1Icon, DoubleArrowDownIcon, MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { useAppStore } from "../../../store/appStore";
import { cn } from "../../../lib/utils";
import { useShallow } from "zustand/react/shallow";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  // OPTIMIZATION: Use shallow selector to prevent unnecessary re-renders when other parts of the store change
  const {
    isMobileSidebarOpen,
    setIsMobileSidebarOpen,
    isRightSidebarOpen,
    isZenMode,
    toggleZenMode,
  } = useAppStore(
    useShallow((state) => ({
      isMobileSidebarOpen: state.isMobileSidebarOpen,
      setIsMobileSidebarOpen: state.setIsMobileSidebarOpen,
      isRightSidebarOpen: state.isRightSidebarOpen,
      isZenMode: state.isZenMode,
      toggleZenMode: state.toggleZenMode,
    })),
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle Zen Mode: Ctrl+Shift+F (or Cmd+Shift+F)
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        (e.key === "F" || e.key === "f")
      ) {
        e.preventDefault();
        toggleZenMode();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleZenMode]);

  return (
    <div className="flex h-screen bg-bg-base text-text-primary font-sans overflow-hidden relative selection:bg-primary-500 selection:text-bg-base">
      {/* Skip to content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-bg-surface focus:text-primary-500 focus:font-medium focus:outline-none focus:ring-1 focus:ring-primary-500 focus:rounded-sm focus:shadow-md"
      >
        Skip to content
      </a>

      {/* Desktop Sidebar */}
      {!isZenMode && (
        <div className="hidden lg:block h-full shrink-0">
          <Sidebar />
        </div>
      )}

      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && !isZenMode && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      {!isZenMode && (
        <div
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-64 bg-bg-elevated shadow-lg border-r border-border-subtle transition-transform duration-300 lg:hidden",
            isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <Sidebar />
          <button
            onClick={() => setIsMobileSidebarOpen(false)}
            className="absolute top-4 right-4 p-2 text-text-tertiary hover:text-text-primary rounded-sm focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary-500 bg-bg-surface"
            aria-label="Close sidebar"
          >
            <Cross1Icon className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        {!isZenMode && (
          <header className="lg:hidden h-16 flex items-center justify-between px-4 border-b border-border-subtle bg-bg-surface shrink-0">
            <div className="flex items-center">
              <button
                onClick={() => setIsMobileSidebarOpen(true)}
                className="p-2 -ml-2 text-text-secondary hover:text-text-primary hover:bg-bg-elevated rounded-sm focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary-500"
                aria-label="Open sidebar"
              >
                <HamburgerMenuIcon className="w-5 h-5" aria-hidden="true" />
              </button>
              <span className="ml-3 font-serif font-bold text-lg">ResearchQuest</span>
            </div>
            <button
              onClick={() => document.dispatchEvent(new CustomEvent('open-command-palette'))}
              className="p-2 -mr-2 text-text-secondary hover:text-text-primary hover:bg-bg-elevated rounded-sm focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary-500"
              aria-label="Open search"
            >
              <MagnifyingGlassIcon className="w-5 h-5" aria-hidden="true" />
            </button>
          </header>
        )}

        {/* Content Area */}
        <main id="main-content" className="flex-1 overflow-auto" tabIndex={-1}>
          {children}
        </main>
      </div>

      {/* Right Sidebar (Context Panel) */}
      {!isZenMode && (
        <div
          className={cn(
            "hidden xl:block h-full shrink-0 bg-bg-surface transition-all duration-300 ease-in-out overflow-hidden",
            isRightSidebarOpen
              ? "w-80 border-l border-border-subtle"
              : "w-0 border-l-0",
          )}
        >
          <div className="w-80 h-full">
            <RightSidebar />
          </div>
        </div>
      )}

      {/* Zen Mode Exit Button */}
      {isZenMode && (
        <button
          onClick={() => toggleZenMode()}
          className="fixed bottom-6 right-6 z-[100] p-3 rounded-full bg-bg-elevated/80 text-text-secondary hover:bg-bg-base hover:text-text-primary backdrop-blur-sm transition-all shadow-lg border border-border-moderate group focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary-500 focus-visible:outline-offset-2"
          title="Exit Zen Mode (Ctrl+Shift+F)"
          aria-label="Exit Zen Mode"
        >
          <DoubleArrowDownIcon className="w-5 h-5 group-hover:scale-110 transition-transform" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

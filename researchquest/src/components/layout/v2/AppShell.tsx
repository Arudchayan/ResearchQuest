import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { Sidebar } from "./Sidebar";
import { MobileTabBar } from "./MobileTabBar";
import { RightSidebar } from "../RightSidebar";
import { HamburgerMenuIcon, Cross1Icon, DoubleArrowDownIcon, MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { useAppStore } from "../../../store/appStore";
import { cn } from "../../../lib/utils";
import { useShallow } from "zustand/react/shallow";
import { Tooltip, TooltipTrigger, TooltipContent } from "../../ui/tooltip";
import { isDemoMode } from "../../../lib/supabase";
import { DEMO_FIRST_RUN_TOPIC_ID } from "../../../lib/demoData";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const mobileSidebarTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileDrawerRef = useRef<HTMLDivElement>(null);
  const mobileSidebarWasOpenRef = useRef(false);
  // OPTIMIZATION: Use shallow selector to prevent unnecessary re-renders when other parts of the store change
  const {
    isMobileSidebarOpen,
    setIsMobileSidebarOpen,
    isRightSidebarOpen,
    isZenMode,
    toggleZenMode,
    currentView,
    selectedTopic,
  } = useAppStore(
    useShallow((state) => ({
      isMobileSidebarOpen: state.isMobileSidebarOpen,
      setIsMobileSidebarOpen: state.setIsMobileSidebarOpen,
      isRightSidebarOpen: state.isRightSidebarOpen,
      isZenMode: state.isZenMode,
      toggleZenMode: state.toggleZenMode,
      currentView: state.currentView,
      selectedTopic: state.selectedTopic,
    })),
  );

  const pathMatchesFirstRun =
    typeof window !== "undefined" &&
    window.location.pathname === `/topics/${DEMO_FIRST_RUN_TOPIC_ID}`;

  const isFirstRunLanding =
    isDemoMode &&
    (pathMatchesFirstRun ||
      (currentView === "topics" &&
        selectedTopic?.id === DEMO_FIRST_RUN_TOPIC_ID));

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

      // Toggle Context Panel (Right Sidebar): Ctrl+. (or Cmd+.)
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === ".") {
        e.preventDefault();
        useAppStore.getState().setIsRightSidebarOpen(!useAppStore.getState().isRightSidebarOpen);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleZenMode]);

  useEffect(() => {
    if (!isMobileSidebarOpen) {
      if (mobileSidebarWasOpenRef.current) {
        mobileSidebarTriggerRef.current?.focus();
      }
      mobileSidebarWasOpenRef.current = false;
      return;
    }

    mobileSidebarWasOpenRef.current = true;

    const drawer = mobileDrawerRef.current;
    const closeButton = drawer?.querySelector<HTMLButtonElement>(
      '[aria-label="Close sidebar"]',
    );
    closeButton?.focus();

    const handleDrawerKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsMobileSidebarOpen(false);
        return;
      }

      if (event.key !== "Tab" || !drawer) {
        return;
      }

      const focusable = drawer.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!first || !last) {
        event.preventDefault();
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleDrawerKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleDrawerKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isMobileSidebarOpen, setIsMobileSidebarOpen]);

  if (isFirstRunLanding) {
    return (
      <div
        data-testid="app-shell"
        data-first-run="true"
        className="relative flex min-h-[100dvh] w-full min-w-0 overflow-x-hidden bg-bg-base font-sans text-text-primary selection:bg-primary-500 selection:text-bg-base"
      >
        <main id="main-content" className="min-w-0 flex-1 overflow-auto" tabIndex={-1}>
          {children}
        </main>
      </div>
    );
  }

  return (
    <div
      data-testid="app-shell"
      className="relative flex min-h-[100dvh] w-full min-w-0 overflow-x-hidden bg-bg-base font-sans text-text-primary selection:bg-primary-500 selection:text-bg-base"
    >
      {/* Skip to content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-bg-surface focus:text-primary-500 focus:font-medium focus:outline-none focus:ring-1 focus:ring-primary-500 focus:rounded-sm focus:shadow-md"
      >
        Skip to content
      </a>

      {/* Desktop Sidebar */}
      {!isZenMode && (
        <div
          className="hidden min-h-[100dvh] shrink-0 lg:block"
          {...(isMobileSidebarOpen ? { inert: true } : {})}
        >
          <Sidebar />
        </div>
      )}

      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && !isZenMode && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-overlay lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      {isMobileSidebarOpen && !isZenMode && (
        <div
          ref={mobileDrawerRef}
          role="dialog"
          aria-label="Main navigation"
          aria-modal="true"
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-64 max-w-[calc(100vw-1rem)] flex-col border-r border-border-subtle bg-bg-elevated shadow-lg lg:hidden",
          )}
        >
          <Sidebar />
          <button
            onClick={() => setIsMobileSidebarOpen(false)}
            className="absolute right-4 top-4 inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm bg-bg-surface text-text-tertiary hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
            aria-label="Close sidebar"
          >
            <Cross1Icon className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Main Content */}
      <div
        data-testid="app-shell-content"
        className="flex min-w-0 flex-1 flex-col overflow-hidden"
        {...(isMobileSidebarOpen ? { inert: true } : {})}
      >
        {/* Mobile Header */}
        {!isZenMode && (
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-border-subtle bg-bg-surface px-4 lg:hidden">
            <div className="flex items-center">
              <button
                ref={mobileSidebarTriggerRef}
                onClick={() => setIsMobileSidebarOpen(true)}
                className="-ml-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm text-text-secondary hover:bg-bg-elevated hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
                aria-label="Open sidebar"
              >
                <HamburgerMenuIcon className="w-5 h-5" aria-hidden="true" />
              </button>
              <span className="ml-3 font-serif font-bold text-lg">ResearchQuest</span>
            </div>
              <button
                onClick={() => document.dispatchEvent(new CustomEvent('open-command-palette'))}
                className="-mr-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm text-text-secondary hover:bg-bg-elevated hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
                aria-label="Open search"
            >
              <MagnifyingGlassIcon className="w-5 h-5" aria-hidden="true" />
            </button>
          </header>
        )}

        {/* Content Area */}
          <main
            id="main-content"
            className="min-w-0 flex-1 overflow-auto pb-20 lg:pb-0"
            tabIndex={-1}
          >
          {children}
        </main>

        {/* Mobile Bottom Tab Bar */}
        {!isZenMode && <MobileTabBar />}
      </div>

      {/* Right Sidebar (Context Panel) */}
      {!isZenMode && isRightSidebarOpen && (
        <aside
          data-testid="right-panel"
          aria-label="Context panel"
          className="hidden min-h-[100dvh] w-80 shrink-0 border-l border-border-subtle bg-bg-surface xl:flex"
          {...(isMobileSidebarOpen ? { inert: true } : {})}
        >
          <div className="h-full w-full min-w-0">
            <RightSidebar />
          </div>
        </aside>
      )}

      {/* Zen Mode Exit Button */}
      {isZenMode && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => toggleZenMode()}
              className="group fixed bottom-6 right-6 z-[100] inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border-moderate bg-bg-elevated/80 text-text-secondary shadow-lg backdrop-blur-sm transition-all hover:bg-bg-base hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
              aria-label="Exit Zen Mode"
            >
              <DoubleArrowDownIcon className="w-5 h-5 group-hover:scale-110 transition-transform" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Exit Zen Mode (Ctrl+Shift+F)</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

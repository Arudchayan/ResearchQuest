import { Fragment, useEffect, useRef, useState } from "react";
import {
  BookOpen,
  CheckSquare,
  FileText,
  Hash,
  LayoutDashboard,
  Lightbulb,
  Plus,
  Target,
  X,
} from "lucide-react";
import { useAppStore } from "../../../store/appStore";
import { useShallow } from "zustand/react/shallow";
import { cn } from "../../../lib/utils";
import { navigateToView } from "../../../lib/softNavigation";
import type { AppView } from "../../../lib/router";

const tabs = [
  { id: "dashboard", label: "Today", icon: LayoutDashboard },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "focus", label: "Focus", icon: Target },
] as const;

const sheetItems = [
  { id: "notes", label: "New Note" },
  { id: "ideas", label: "New Idea" },
  { id: "tasks", label: "New Task" },
] as const;

const libraryItems: { id: AppView; label: string; icon: typeof FileText }[] = [
  { id: "notes", label: "Notes", icon: FileText },
  { id: "papers", label: "Papers", icon: BookOpen },
  { id: "ideas", label: "Ideas", icon: Lightbulb },
  { id: "topics", label: "Topics", icon: Hash },
];

export function MobileTabBar() {
  const [sheet, setSheet] = useState<"add" | "library" | null>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const libraryRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const sheetWasOpenRef = useRef<"add" | "library" | null>(null);

  const {
    currentView,
    isMobileSidebarOpen,
    setIsMobileSidebarOpen,
  } = useAppStore(
    useShallow((state) => ({
      currentView: state.currentView,
      isMobileSidebarOpen: state.isMobileSidebarOpen,
      setIsMobileSidebarOpen: state.setIsMobileSidebarOpen,
    })),
  );

  const navigate = (view: AppView) => {
    setIsMobileSidebarOpen(false);
    navigateToView(view);
  };

  useEffect(() => {
    if (!sheet) {
      if (sheetWasOpenRef.current === "add") {
        fabRef.current?.focus();
      } else if (sheetWasOpenRef.current === "library") {
        libraryRef.current?.focus();
      }
      sheetWasOpenRef.current = null;
      return;
    }

    sheetWasOpenRef.current = sheet;

    const panel = sheetRef.current;
    const firstButton = panel?.querySelector<HTMLButtonElement>("button");
    firstButton?.focus();

    const handleSheetKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setSheet(null);
        return;
      }

      if (event.key !== "Tab" || !panel) {
        return;
      }

      const focusable = panel.querySelectorAll<HTMLElement>(
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

    document.addEventListener("keydown", handleSheetKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleSheetKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [sheet]);

  const closeSheet = () => setSheet(null);

  const handleSheetNavigate = (view: AppView) => {
    navigate(view);
    setSheet(null);
  };

  const isBarInert = isMobileSidebarOpen || sheet !== null;
  const libraryActive = libraryItems.some((item) => item.id === currentView);

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 min-h-12 border-t border-border-subtle bg-bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
        {...(isBarInert ? { inert: true } : {})}
      >
        <div className="grid min-h-12 grid-cols-5 items-center px-2">
          {tabs.map((tab) => (
            <Fragment key={tab.id}>
              <a
                href={tab.id === "dashboard" ? "/" : `/${tab.id}`}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
                    return;
                  }
                  e.preventDefault();
                  navigate(tab.id);
                }}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center gap-1 rounded-sm text-caption font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:-outline-offset-2",
                  currentView === tab.id
                    ? "bg-primary-50 text-primary-500"
                    : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary",
                )}
                aria-current={currentView === tab.id ? "page" : undefined}
              >
                <tab.icon className="h-5 w-5" aria-hidden="true" />
                {tab.label}
              </a>
              {tab.id === "tasks" && (
                <div className="flex items-center justify-center">
                  <button
                    ref={fabRef}
                    onClick={() => setSheet("add")}
                    aria-label="Quick add"
                    aria-haspopup="dialog"
                    aria-expanded={sheet === "add"}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-500 text-bg-base shadow-md transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
                  >
                    <Plus className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              )}
            </Fragment>
          ))}
          <button
            ref={libraryRef}
            type="button"
            onClick={() => setSheet("library")}
            aria-label="Library"
            aria-haspopup="dialog"
            aria-expanded={sheet === "library"}
            className={cn(
              "flex min-h-11 flex-col items-center justify-center gap-1 rounded-sm text-caption font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:-outline-offset-2",
              libraryActive
                ? "bg-primary-50 text-primary-500"
                : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary",
            )}
          >
            <BookOpen className="h-5 w-5" aria-hidden="true" />
            Library
          </button>
        </div>
      </nav>

      {sheet === "add" && (
        <>
          <div
            aria-hidden="true"
            className="fixed inset-0 z-40 bg-overlay lg:hidden"
            onClick={closeSheet}
          />
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="Quick add"
            className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md rounded-t-xl border-x border-t border-border-subtle bg-bg-elevated p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-lg lg:hidden"
          >
            <h2 className="font-serif font-bold text-lg text-text-primary">
              Quick add
            </h2>
            <div className="mt-4 space-y-2">
              {sheetItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSheetNavigate(item.id)}
                  className="flex min-h-11 w-full items-center gap-3 rounded-sm px-3 py-2.5 text-small font-medium text-text-secondary transition-colors hover:bg-bg-surface hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
                >
                  <Plus className="h-4 w-4 text-primary-500" aria-hidden="true" />
                  {item.label}
                </button>
              ))}
            </div>
            <button
              onClick={closeSheet}
              aria-label="Close quick add"
              className="absolute right-4 top-4 inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm text-text-tertiary hover:bg-bg-surface hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </>
      )}

      {sheet === "library" && (
        <>
          <div
            aria-hidden="true"
            className="fixed inset-0 z-40 bg-overlay lg:hidden"
            onClick={closeSheet}
          />
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="Library"
            className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md rounded-t-xl border-x border-t border-border-subtle bg-bg-elevated p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-lg lg:hidden"
          >
            <h2 className="font-serif font-bold text-lg text-text-primary">
              Library
            </h2>
            <div className="mt-4 space-y-2">
              {libraryItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSheetNavigate(item.id)}
                  className="flex min-h-11 w-full items-center gap-3 rounded-sm px-3 py-2.5 text-small font-medium text-text-secondary transition-colors hover:bg-bg-surface hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
                >
                  <item.icon className="h-4 w-4 text-primary-500" aria-hidden="true" />
                  {item.label}
                </button>
              ))}
            </div>
            <button
              onClick={closeSheet}
              aria-label="Close library"
              className="absolute right-4 top-4 inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm text-text-tertiary hover:bg-bg-surface hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </>
      )}
    </>
  );
}


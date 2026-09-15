import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  BookOpen,
  CheckSquare,
  FileText,
  Hash,
  Inbox,
  LayoutDashboard,
  LayoutGrid,
  Lightbulb,
  Plus,
  Target,
  X,
} from "lucide-react";
import { useAppStore } from "../../../store/appStore";
import { useShallow } from "zustand/react/shallow";
import { cn } from "../../../lib/utils";
import { NAV_ITEMS_FLAT } from "../navConfig";
import type { AppView } from "../../../lib/router";

const tabs = [
  { id: "notes", label: "Notes", icon: FileText },
  { id: "papers", label: "Papers", icon: BookOpen },
  { id: "ideas", label: "Ideas", icon: Lightbulb },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
] as const;

type TabId = (typeof tabs)[number]["id"];

const allViewsIcons: Record<AppView, typeof FileText> = {
  dashboard: LayoutDashboard,
  notes: FileText,
  papers: BookOpen,
  ideas: Lightbulb,
  tasks: CheckSquare,
  focus: Target,
  topics: Hash,
  feeds: Inbox,
};

const sheetItems = [
  { id: "notes", label: "New Note" },
  { id: "ideas", label: "New Idea" },
  { id: "tasks", label: "New Task" },
] as const;

interface BottomSheetProps {
  label: string;
  closeLabel: string;
  panelRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  children: ReactNode;
}

/** Shared bottom-sheet chrome for the mobile tab bar dialogs. */
function BottomSheet({
  label,
  closeLabel,
  panelRef,
  onClose,
  children,
}: BottomSheetProps) {
  return (
    <>
      <div
        aria-hidden="true"
        className="fixed inset-0 z-40 bg-overlay lg:hidden"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md rounded-t-xl border-x border-t border-border-subtle bg-bg-elevated p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-lg lg:hidden"
      >
        <h2 className="font-serif font-bold text-lg text-text-primary">
          {label}
        </h2>
        {children}
        <button
          onClick={onClose}
          aria-label={closeLabel}
          className="absolute right-4 top-4 inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm text-text-tertiary hover:bg-bg-surface hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </>
  );
}

/**
 * Focus trap + Escape-to-close + body scroll lock for a bottom sheet.
 * Restores focus to the trigger when the sheet closes.
 */
function useSheetFocusTrap(
  isOpen: boolean,
  panelRef: RefObject<HTMLDivElement | null>,
  triggerRef: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      if (wasOpenRef.current) {
        triggerRef.current?.focus();
      }
      wasOpenRef.current = false;
      return;
    }

    wasOpenRef.current = true;

    const panel = panelRef.current;
    const firstFocusable = panel?.querySelector<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    firstFocusable?.focus();

    const handleSheetKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
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
  }, [isOpen, onClose, panelRef, triggerRef]);
}

export function MobileTabBar() {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const fabRef = useRef<HTMLButtonElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const moreSheetRef = useRef<HTMLDivElement>(null);

  const {
    currentView,
    setCurrentView,
    isMobileSidebarOpen,
    setIsMobileSidebarOpen,
  } = useAppStore(
    useShallow((state) => ({
      currentView: state.currentView,
      setCurrentView: state.setCurrentView,
      isMobileSidebarOpen: state.isMobileSidebarOpen,
      setIsMobileSidebarOpen: state.setIsMobileSidebarOpen,
    })),
  );

  const navigate = (view: AppView) => {
    setCurrentView(view);
    setIsMobileSidebarOpen(false);
    window.history.pushState(
      null,
      "",
      view === "dashboard" ? "/" : `/${view}`,
    );
  };

  const closeSheet = () => setIsSheetOpen(false);
  const closeMore = () => setIsMoreOpen(false);

  useSheetFocusTrap(isSheetOpen, sheetRef, fabRef, closeSheet);
  useSheetFocusTrap(isMoreOpen, moreSheetRef, moreRef, closeMore);

  const handleSheetNavigate = (view: TabId) => {
    navigate(view);
    setIsSheetOpen(false);
  };

  const handleMoreNavigate = (view: AppView) => {
    setIsMoreOpen(false);
    navigate(view);
  };

  // Gated while the mobile drawer is open (AppShell also inert-gates its
  // content wrapper) or while either bottom sheet is open.
  const isBarInert = isMobileSidebarOpen || isSheetOpen || isMoreOpen;

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 min-h-12 border-t border-border-subtle bg-bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
        {...(isBarInert ? { inert: true } : {})}
      >
        <div className="grid min-h-12 grid-cols-6 items-center px-2">
          {tabs.map((tab) => (
            <Fragment key={tab.id}>
              {tab.id === "ideas" && (
                <div className="flex items-center justify-center">
                  <button
                    ref={fabRef}
                    onClick={() => setIsSheetOpen(true)}
                    aria-label="Quick add"
                    aria-haspopup="dialog"
                    aria-expanded={isSheetOpen}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-500 text-bg-base shadow-md transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
                  >
                    <Plus className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              )}
              <a
                href={`/${tab.id}`}
                onClick={(e) => {
                  // Allow default behavior (new tab) if modifier keys are pressed
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
            </Fragment>
          ))}
          <button
            ref={moreRef}
            type="button"
            onClick={() => setIsMoreOpen(true)}
            aria-label="All views"
            aria-haspopup="dialog"
            aria-expanded={isMoreOpen}
            className={cn(
              "flex min-h-11 flex-col items-center justify-center gap-1 rounded-sm text-caption font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:-outline-offset-2",
              ["dashboard", "focus", "topics", "feeds"].includes(currentView)
                ? "bg-primary-50 text-primary-500"
                : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary",
            )}
          >
            <LayoutGrid className="h-5 w-5" aria-hidden="true" />
            More
          </button>
        </div>
      </nav>

      {isSheetOpen && (
        <BottomSheet
          label="Quick add"
          closeLabel="Close quick add"
          panelRef={sheetRef}
          onClose={closeSheet}
        >
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
        </BottomSheet>
      )}

      {isMoreOpen && (
        <BottomSheet
          label="All views"
          closeLabel="Close all views"
          panelRef={moreSheetRef}
          onClose={closeMore}
        >
          <div className="mt-4 space-y-1">
            {NAV_ITEMS_FLAT.map((item) => {
              const Icon = allViewsIcons[item.id];
              return (
                <a
                  key={item.id}
                  href={item.href}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
                      return;
                    }
                    e.preventDefault();
                    handleMoreNavigate(item.id);
                  }}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-3 rounded-sm px-3 py-2.5 text-small font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2",
                    currentView === item.id
                      ? "bg-primary-50 text-primary-500"
                      : "text-text-secondary hover:bg-bg-surface hover:text-text-primary",
                  )}
                  aria-current={currentView === item.id ? "page" : undefined}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  {item.label}
                </a>
              );
            })}
          </div>
        </BottomSheet>
      )}
    </>
  );
}

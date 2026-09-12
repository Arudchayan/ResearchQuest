import type { AppView } from "../../lib/router";

/**
 * Single source of truth for primary navigation (PR17 IA).
 *
 * Canonical order follows the keyboard shortcuts 1–8:
 * dashboard(1) notes(2) papers(3) ideas(4) tasks(5) focus(6) topics(7) feeds(8).
 * Sidebar, MobileTabBar ("All views" sheet) and ShortcutsDialog all derive
 * their order from here; routes are unchanged.
 */
export interface NavItemDef {
  id: AppView;
  label: string;
  href: string;
  shortcutDigit: string;
}

export interface NavGroupDef {
  id: string;
  label: string;
  items: NavItemDef[];
}

export const NAV_GROUPS: NavGroupDef[] = [
  {
    id: "workspace",
    label: "Workspace",
    items: [
      { id: "dashboard", label: "Dashboard", href: "/", shortcutDigit: "1" },
      { id: "notes", label: "Notes", href: "/notes", shortcutDigit: "2" },
      { id: "papers", label: "Papers", href: "/papers", shortcutDigit: "3" },
      { id: "ideas", label: "Ideas", href: "/ideas", shortcutDigit: "4" },
    ],
  },
  {
    id: "plan",
    label: "Plan & Focus",
    items: [
      { id: "tasks", label: "Tasks", href: "/tasks", shortcutDigit: "5" },
      { id: "focus", label: "Focus Studio", href: "/focus", shortcutDigit: "6" },
    ],
  },
  {
    id: "organize",
    label: "Organize",
    items: [
      { id: "topics", label: "Topics", href: "/topics", shortcutDigit: "7" },
      { id: "feeds", label: "Feeds", href: "/feeds", shortcutDigit: "8" },
    ],
  },
];

/** Flat nav items in canonical shortcut order. */
export const NAV_ITEMS_FLAT: NavItemDef[] = NAV_GROUPS.flatMap(
  (group) => group.items,
);

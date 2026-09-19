/**
 * Soft (client-side) navigation for same-origin links.
 *
 * Primary nav uses `<a href>` for accessibility / open-in-new-tab. Without a
 * reliable preventDefault, those clicks become full document loads. This module
 * installs a capture-phase interceptor so every internal primary click stays in
 * the SPA, and exposes `softNavigate` / `navigateToView` for programmatic
 * view changes. `navigateToView` is the single owner: it no-ops when the
 * view and path are already current so interceptor + React onClick cannot
 * double-notify.
 */

import { parseRoute, type AppView } from "./router";
import { useShellStore } from "../store/shellStore";

type SoftNavListener = (path: string) => void;

export function pathForView(view: AppView, itemId?: string): string {
  if (view === "dashboard") return "/";
  return itemId ? `/${view}/${itemId}` : `/${view}`;
}

function currentLocationPath(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function applyViewFromPath(path: string): void {
  let pathname = path;
  try {
    pathname = new URL(path, window.location.origin).pathname;
  } catch {
    pathname = path.split("?")[0]?.split("#")[0] || path;
  }
  const route = parseRoute(pathname);
  if (route.isValid && route.view) {
    useShellStore.getState().setCurrentView(route.view);
  }
}

const listeners = new Set<SoftNavListener>();

/** Subscribe to soft navigations (link interceptor + `softNavigate`). */
export function subscribeSoftNavigation(listener: SoftNavListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(path: string): void {
  listeners.forEach((listener) => listener(path));
}

/** Update the URL via history and notify React without unloading the document. */
export function softNavigate(path: string): void {
  if (typeof window === "undefined") return;

  const current = currentLocationPath();
  if (path === current) {
    applyViewFromPath(path);
    return;
  }
  window.history.pushState(null, "", path);
  applyViewFromPath(path);
  notify(path);
}

/**
 * Programmatic SPA navigation. No-ops when the store already shows `view`
 * and the URL is already `path`, so overlapping interceptors/handlers
 * cannot fan out extra renders.
 */
export function navigateToView(view: AppView, path?: string): void {
  const resolved = path ?? pathForView(view);
  const store = useShellStore.getState();
  if (store.currentView === view && currentLocationPath() === resolved) {
    return;
  }
  store.setCurrentView(view);
  softNavigate(resolved);
}

function isModifiedClick(event: {
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

/**
 * Whether a click on this anchor should be handled as soft SPA navigation.
 * Exported for unit tests.
 */
export function shouldSoftNavigateAnchor(
  anchor: HTMLAnchorElement,
  event: Pick<
    MouseEvent,
    | "button"
    | "metaKey"
    | "ctrlKey"
    | "shiftKey"
    | "altKey"
    | "defaultPrevented"
  >,
  loc: Pick<Location, "origin" | "href"> = window.location,
): string | null {
  if (event.defaultPrevented) return null;
  if (event.button !== 0) return null;
  if (isModifiedClick(event)) return null;

  if (anchor.hasAttribute("download")) return null;
  // First-run demo CTA intentionally full-navigates after arming localStorage.
  if (anchor.hasAttribute("data-rq-demo-entry")) return null;

  const target = anchor.getAttribute("target");
  if (target && target !== "" && target !== "_self") return null;

  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(href, loc.href);
  } catch {
    return null;
  }

  if (url.origin !== loc.origin) return null;

  return `${url.pathname}${url.search}${url.hash}`;
}

/** Capture-phase click interceptor for same-origin anchors. */
export function installSoftLinkInterception(
  doc: Document = document,
): () => void {
  const onClick = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const anchor = target.closest("a[href]");
    if (!(anchor instanceof HTMLAnchorElement)) return;

    const path = shouldSoftNavigateAnchor(anchor, event);
    if (path === null) return;

    event.preventDefault();
    softNavigate(path);
  };

  doc.addEventListener("click", onClick, true);
  return () => doc.removeEventListener("click", onClick, true);
}

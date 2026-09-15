/**
 * Soft (client-side) navigation for same-origin links.
 *
 * Primary nav uses `<a href>` for accessibility / open-in-new-tab. Without a
 * reliable preventDefault, those clicks become full document loads. This module
 * installs a capture-phase interceptor so every internal primary click stays in
 * the SPA, and exposes `softNavigate` for programmatic view changes.
 */

type SoftNavListener = (path: string) => void;

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

  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (path !== current) {
    window.history.pushState(null, "", path);
  }
  notify(path);
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

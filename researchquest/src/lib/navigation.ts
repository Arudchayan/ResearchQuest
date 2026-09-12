import { useAppStore } from "../store/appStore";
import { parseRoute, type AppView } from "./router";

/**
 * Shared navigation helper (PR15 item 38).
 *
 * Single place that keeps the zustand view state and the browser URL in sync.
 * URL format is unchanged from the previously inlined call sites:
 * dashboard -> "/", other views -> "/<view>", entity views -> "/<view>/<id>".
 *
 * Note: this helper intentionally does NOT dispatch a `popstate` event
 * (matching the majority Dashboard/Sidebar pattern). Call sites that
 * previously dispatched one explicitly (PaperDetailView, IdeaDetailView)
 * keep their explicit dispatch so their behavior is unchanged.
 */
export function navigate(view: AppView, id?: string): void {
  const path = id ? `/${view}/${id}` : view === "dashboard" ? "/" : `/${view}`;
  useAppStore.getState().setCurrentView(view);
  window.history.pushState(null, "", path);
}

/**
 * Restore an arbitrary deep-link path (e.g. the post-sign-in redirect).
 * Pushes the path, parses it, and sets the view — falling back to the
 * dashboard for invalid routes. Same contract App previously inlined.
 */
export function navigateToPath(path: string): void {
  window.history.pushState(null, "", path);
  const route = parseRoute(path);
  if (route.isValid && route.view) {
    useAppStore.getState().setCurrentView(route.view);
  } else {
    useAppStore.getState().setCurrentView("dashboard");
  }
}

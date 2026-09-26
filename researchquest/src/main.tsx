import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { restoreRedirectPath } from "./lib/router";
import { installSoftLinkInterception } from "./lib/softNavigation";
import "./index.css";
import App from "./App.tsx";
import { ensureFocusSessionGuardAttached } from "./components/focus/focusSessionGuard.ts";

ensureFocusSessionGuardAttached();

// Recover deep links after public/404.html's full reload fallback (hosts
// without SPA rewrites). Must run before the first React render so App's
// route effect reads the restored pathname.
restoreRedirectPath();

// Capture-phase same-origin <a> clicks → history.pushState (no document reload).
installSoftLinkInterception();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

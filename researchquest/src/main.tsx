import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { restoreRedirectPath } from "./lib/router";
import "./index.css";
import App from "./App.tsx";

// Recover deep links after public/404.html's full reload fallback (hosts
// without SPA rewrites). Must run before the first React render so App's
// route effect reads the restored pathname.
restoreRedirectPath();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

/*
 * ResearchQuest static demo gate (loaded synchronously before the app bundle).
 * Kept as an external file (instead of an inline <script>) so the production
 * Content-Security-Policy can use `script-src 'self'` without 'unsafe-inline'.
 * Arms demo mode in localStorage when the first-run CTA is used, so the demo
 * workspace is clickable before React mounts. React replaces #root on boot.
 */
(function () {
  var KEY = "rq_demo_mode";
  var PATH = "/topics/topic-ai-agents";
  function armDemo() {
    try {
      localStorage.setItem(KEY, "1");
    } catch (e) {}
  }
  try {
    if (location.pathname === PATH) {
      armDemo();
    }
  } catch (e) {}
  document.addEventListener(
    "click",
    function (event) {
      var target = event.target;
      if (!target || !target.closest) return;
      var entry = target.closest("[data-rq-demo-entry]");
      if (!entry) return;
      armDemo();
      // Real link: let navigation proceed after arming.
      // Button fallback: assign explicitly.
      if (entry.tagName !== "A") {
        event.preventDefault();
        location.assign(PATH);
      }
    },
    true,
  );
})();

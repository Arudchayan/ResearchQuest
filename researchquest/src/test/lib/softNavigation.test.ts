import { afterEach, describe, expect, it, vi } from "vitest";
import {
  installSoftLinkInterception,
  shouldSoftNavigateAnchor,
  softNavigate,
  subscribeSoftNavigation,
} from "../../lib/softNavigation";

describe("shouldSoftNavigateAnchor", () => {
  const loc = { origin: "https://app.test", href: "https://app.test/notes" };

  function anchor(html: string): HTMLAnchorElement {
    document.body.innerHTML = html;
    return document.querySelector("a")!;
  }

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("soft-navigates plain same-origin primary clicks", () => {
    const el = anchor('<a href="/papers">Papers</a>');
    expect(
      shouldSoftNavigateAnchor(
        el,
        {
          button: 0,
          metaKey: false,
          ctrlKey: false,
          shiftKey: false,
          altKey: false,
          defaultPrevented: false,
        },
        loc,
      ),
    ).toBe("/papers");
  });

  it("allows modifier-clicks and demo hard-entry to use the browser", () => {
    const papers = anchor('<a href="/papers">Papers</a>');
    expect(
      shouldSoftNavigateAnchor(
        papers,
        {
          button: 0,
          metaKey: true,
          ctrlKey: false,
          shiftKey: false,
          altKey: false,
          defaultPrevented: false,
        },
        loc,
      ),
    ).toBeNull();

    const demo = anchor(
      '<a href="/topics/topic-ai-agents" data-rq-demo-entry>Demo</a>',
    );
    expect(
      shouldSoftNavigateAnchor(
        demo,
        {
          button: 0,
          metaKey: false,
          ctrlKey: false,
          shiftKey: false,
          altKey: false,
          defaultPrevented: false,
        },
        loc,
      ),
    ).toBeNull();
  });

  it("ignores hash, mailto, and cross-origin links", () => {
    expect(
      shouldSoftNavigateAnchor(
        anchor('<a href="#main-content">Skip</a>'),
        {
          button: 0,
          metaKey: false,
          ctrlKey: false,
          shiftKey: false,
          altKey: false,
          defaultPrevented: false,
        },
        loc,
      ),
    ).toBeNull();

    expect(
      shouldSoftNavigateAnchor(
        anchor('<a href="mailto:a@b.test">Mail</a>'),
        {
          button: 0,
          metaKey: false,
          ctrlKey: false,
          shiftKey: false,
          altKey: false,
          defaultPrevented: false,
        },
        loc,
      ),
    ).toBeNull();

    expect(
      shouldSoftNavigateAnchor(
        anchor('<a href="https://evil.test/x">Ext</a>'),
        {
          button: 0,
          metaKey: false,
          ctrlKey: false,
          shiftKey: false,
          altKey: false,
          defaultPrevented: false,
        },
        loc,
      ),
    ).toBeNull();
  });
});

describe("softNavigate + link interception", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    window.history.pushState(null, "", "/");
  });

  it("pushStates and notifies subscribers without reloading", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSoftNavigation(listener);
    const pushSpy = vi.spyOn(window.history, "pushState");

    softNavigate("/ideas");

    expect(pushSpy).toHaveBeenCalledWith(null, "", "/ideas");
    expect(listener).toHaveBeenCalledWith("/ideas");
    unsubscribe();
    pushSpy.mockRestore();
  });

  it("intercepts sidebar-style anchor clicks at capture time", () => {
    document.body.innerHTML = '<a href="/tasks">Tasks</a>';
    const uninstall = installSoftLinkInterception();
    const listener = vi.fn();
    const unsubscribe = subscribeSoftNavigation(listener);
    const pushSpy = vi.spyOn(window.history, "pushState");

    const link = document.querySelector("a")!;
    link.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
    );

    expect(pushSpy).toHaveBeenCalledWith(null, "", "/tasks");
    expect(listener).toHaveBeenCalledWith("/tasks");

    unsubscribe();
    uninstall();
    pushSpy.mockRestore();
  });
});

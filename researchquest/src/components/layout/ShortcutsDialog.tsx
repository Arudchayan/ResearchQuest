import * as Dialog from "@radix-ui/react-dialog";
import { X, Keyboard } from "lucide-react";
import { useState, useEffect } from "react";
import { useAppStore } from "../../store/appStore";

interface ShortcutItem {
  keys: string[];
  description: string;
}

interface ShortcutSection {
  title: string;
  shortcuts: ShortcutItem[];
}

type AppView = "dashboard" | "notes" | "papers" | "ideas" | "tasks" | "focus" | "topics";

const NAVIGATION_SHORTCUTS: Record<string, { view: AppView; url: string }> = {
  "1": { view: "dashboard", url: "/" },
  "2": { view: "notes", url: "/notes" },
  "3": { view: "papers", url: "/papers" },
  "4": { view: "ideas", url: "/ideas" },
  "5": { view: "tasks", url: "/tasks" },
  "6": { view: "focus", url: "/focus" },
  "7": { view: "topics", url: "/topics" },
};

const isMac =
  typeof window !== "undefined" && typeof window.navigator !== "undefined"
    ? /Mac|iPod|iPhone|iPad/.test(window.navigator.platform)
    : false;

const META_KEY = isMac ? "Cmd" : "Ctrl";
const META_SYMBOL = isMac ? "⌘" : "Ctrl";

const SHORTCUTS: ShortcutSection[] = [
  {
    title: "General",
    shortcuts: [
      { keys: [META_KEY, "K"], description: "Open Command Palette" },
      { keys: ["?"], description: "Show Keyboard Shortcuts" },
      { keys: ["/"], description: "Open Command Palette (Search)" },
    ],
  },
  {
    title: "Editor",
    shortcuts: [
      { keys: [META_KEY, "B"], description: "Bold" },
      { keys: [META_KEY, "I"], description: "Italic" },
      { keys: [META_KEY, "Shift", "C"], description: "Inline Code" },
      { keys: [META_KEY, "Shift", "L"], description: "Bulleted List" },
      { keys: [META_KEY, "K"], description: "Insert Link" },
      { keys: [META_KEY, "Shift", "E"], description: "Edit View" },
      { keys: [META_KEY, "Shift", "S"], description: "Split View" },
      { keys: [META_KEY, "Shift", "P"], description: "Preview View" },
    ],
  },
  {
    title: "Global Navigation",
    shortcuts: [
      { keys: [META_KEY, "Alt", "1"], description: "Go to Dashboard" },
      { keys: [META_KEY, "Alt", "2"], description: "Go to Notes" },
      { keys: [META_KEY, "Alt", "3"], description: "Go to Papers" },
      { keys: [META_KEY, "Alt", "4"], description: "Go to Ideas" },
      { keys: [META_KEY, "Alt", "5"], description: "Go to Tasks" },
      { keys: [META_KEY, "Alt", "6"], description: "Go to Focus" },
      { keys: [META_KEY, "Alt", "7"], description: "Go to Topics" },
    ],
  },
  {
    title: "Interface",
    shortcuts: [
      { keys: [META_KEY, "Shift", "F"], description: "Toggle Zen Mode" },
      { keys: ["Tab"], description: "Navigate Focus" },
      { keys: ["Enter"], description: "Select Item" },
      { keys: ["Esc"], description: "Close Dialogs" },
    ],
  },
];

export function ShortcutsDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Global Navigation (Mod+Alt+1-6)
      if (isMod && e.altKey) {
        const destination = NAVIGATION_SHORTCUTS[e.key];

        if (destination) {
          e.preventDefault();

          const {
            setCurrentView,
            setSelectedNote,
            setSelectedPaper,
            setSelectedIdea,
            setSelectedTopic,
          } = useAppStore.getState();

          // Clear selections when switching main views
          if (destination.view !== "notes") setSelectedNote(null);
          if (destination.view !== "papers") setSelectedPaper(null);
          if (destination.view !== "ideas") setSelectedIdea(null);
          if (destination.view !== "topics") setSelectedTopic(null);

          setCurrentView(destination.view);
          window.history.pushState(null, "", destination.url);
          return;
        }
      }

      // Ignore if typing in an input for other shortcuts
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (isInput) return;

      if (e.key === "?" && e.shiftKey) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    const handleCustomEvent = () => {
      setOpen(true);
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("open-shortcuts-help", handleCustomEvent);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("open-shortcuts-help", handleCustomEvent);
    };
  }, []);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-fade-in" />
        <Dialog.Content
          className="fixed left-[50%] top-[50%] max-h-[85vh] w-[90vw] max-w-[600px] translate-x-[-50%] translate-y-[-50%] rounded-xl bg-bg-surface p-0 shadow-2xl focus:outline-none z-50 animate-slide-in border border-border-subtle overflow-hidden flex flex-col"
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between p-4 border-b border-border-subtle bg-bg-elevated/50">
            <div className="flex items-center gap-2">
              <Keyboard className="w-5 h-5 text-primary-500" />
              <Dialog.Title className="text-lg font-semibold text-text-primary">
                Keyboard Shortcuts
              </Dialog.Title>
            </div>
            <Dialog.Close
              className="p-2 hover:bg-bg-elevated rounded-full transition-colors"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5 text-text-tertiary" aria-hidden="true" />
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {SHORTCUTS.map((section) => (
              <div key={section.title} className="space-y-4">
                <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
                  {section.title}
                </h3>
                <div className="grid gap-3">
                  {section.shortcuts.map((shortcut, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between group"
                    >
                      <span className="text-sm text-text-primary group-hover:text-primary-600 transition-colors">
                        {shortcut.description}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {shortcut.keys.map((key, kIndex) => (
                          <kbd
                            key={kIndex}
                            className="inline-flex items-center justify-center h-6 min-w-[24px] px-1.5 text-[11px] font-bold text-text-secondary bg-bg-elevated border border-border-subtle rounded shadow-sm font-mono"
                          >
                            {key === META_KEY ? (
                              <span className="text-xs">{META_SYMBOL}</span>
                            ) : (
                              key
                            )}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-border-subtle bg-bg-elevated/30 text-center">
            <p className="text-xs text-text-tertiary">
              Tip: Press{" "}
              <kbd className="font-mono font-bold text-text-secondary">?</kbd>{" "}
              anywhere to open this dialog.
            </p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

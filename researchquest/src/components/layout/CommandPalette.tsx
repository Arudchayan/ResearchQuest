import { useEffect, useState, useMemo } from "react";
import { Command } from "cmdk";
import {
  FileText,
  BookOpen,
  Lightbulb,
  Target,
  CheckSquare,
  Plus,
  Moon,
  Sun,
  Search,
  Download,
  Keyboard,
  Database,
  LayoutDashboard,
  Hash,
  Inbox,
} from "lucide-react";
import { useAppStore } from "../../store/appStore";
import type { AppView } from "../../store/appStore";
import { useShallow } from "zustand/react/shallow";
import { useNotes } from "../../hooks/useNotes";
import { usePapers } from "../../hooks/usePapers";
import { useIdeas } from "../../hooks/useIdeas";
import { exportData } from "../../utils/export";
import "./CommandPalette.css";

const SEARCH_RESULTS_LIMIT = 50;

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  // Using useShallow with an object selector to prevent CommandPalette from
  // unnecessarily re-rendering on unrelated state changes in the global appStore.
  const {
    setTheme,
    effectiveTheme,
    setCurrentView,
    setSelectedNote,
    setSelectedPaper,
    setSelectedIdea,
    setSelectedTopic,
    user,
    topics,
    tasks,
  } = useAppStore(
    useShallow((state) => ({
      setTheme: state.setTheme,
      effectiveTheme: state.effectiveTheme,
      setCurrentView: state.setCurrentView,
      setSelectedNote: state.setSelectedNote,
      setSelectedPaper: state.setSelectedPaper,
      setSelectedIdea: state.setSelectedIdea,
      setSelectedTopic: state.setSelectedTopic,
      user: state.user,
      topics: state.topics,
      tasks: state.tasks,
    }))
  );

  const topicsArray = useMemo(() => Object.values(topics), [topics]);

  // Fetch data for search
  const { notes } = useNotes(user?.id);
  const { papers } = usePapers(user?.id);
  const { ideas } = useIdeas(user?.id);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      } else if (e.key === "/") {
        const target = e.target as HTMLElement;
        const isInput =
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable;

        if (!isInput) {
          e.preventDefault();
          setOpen((open) => !open);
        }
      }
    };

    const handleOpenCommandPalette = () => {
      setOpen(true);
    };

    document.addEventListener("keydown", down);
    document.addEventListener("open-command-palette", handleOpenCommandPalette);

    return () => {
      document.removeEventListener("keydown", down);
      document.removeEventListener("open-command-palette", handleOpenCommandPalette);
    };
  }, []);

  // Navigation handlers using App's custom routing
  const handleNavigate = (view: AppView) => {
    setCurrentView(view);
    window.history.pushState(null, "", view === "dashboard" ? "/" : `/${view}`);
    // Trigger popstate event for other listeners if needed (App.tsx listens to it)
    window.dispatchEvent(new PopStateEvent("popstate"));
    setOpen(false);
  };

  const handleSelectNote = (note: any) => {
    setCurrentView("notes");
    setSelectedNote(note);
    window.history.pushState(null, "", `/notes/${note.id}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
    setOpen(false);
  };

  const handleSelectPaper = (paper: any) => {
    setCurrentView("papers");
    setSelectedPaper(paper);
    window.history.pushState(null, "", `/papers/${paper.id}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
    setOpen(false);
  };

  const handleSelectIdea = (idea: any) => {
    setCurrentView("ideas");
    setSelectedIdea(idea);
    window.history.pushState(null, "", `/ideas/${idea.id}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
    setOpen(false);
  };

  const handleSelectTask = (task: any) => {
    setCurrentView("tasks");
    window.history.pushState(null, "", `/tasks`);
    window.dispatchEvent(new PopStateEvent("popstate"));
    setOpen(false);
  };

  const handleSelectTopic = (topic: any) => {
    setCurrentView("topics");
    setSelectedTopic(topic);
    window.history.pushState(null, "", `/topics/${topic.id}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
    setOpen(false);
  };

  const toggleTheme = () => {
    const newTheme = effectiveTheme === "light" ? "dark" : "light";
    document.body.classList.add("theme-transitioning");
    setTheme(newTheme);
    setTimeout(() => {
      document.body.classList.remove("theme-transitioning");
    }, 300);
    setOpen(false);
  };

  const handleExport = async () => {
    const { user, notes, papers, ideas, topics, tasks } = useAppStore.getState();
    if (!user?.id) {
      setOpen(false);
      return;
    }

    const cleanTopics = Object.values(topics).map((t) => ({
      id: t.id,
      user_id: t.user_id,
      name: t.name,
      description: t.description,
      created_at: t.created_at,
      updated_at: t.updated_at,
    }));

    await exportData({
      userId: user.id,
      user,
      notes,
      papers,
      ideas,
      topics: cleanTopics,
      tasks,
    });
    setOpen(false);
  };

  const handleOpenDataManagement = () => {
    document.dispatchEvent(new CustomEvent("open-data-management"));
    setOpen(false);
  };

  // Memoize search items
  const searchItems = useMemo(() => {
    const results: any[] = [];
    const safeNotes = notes || [];
    for (let i = 0; i < safeNotes.length; i++) {
      results.push({
        type: "note",
        item: safeNotes[i],
        label: safeNotes[i].title || "Untitled Note",
      });
    }

    const safePapers = papers || [];
    for (let i = 0; i < safePapers.length; i++) {
      results.push({
        type: "paper",
        item: safePapers[i],
        label: safePapers[i].title,
      });
    }

    const safeIdeas = ideas || [];
    for (let i = 0; i < safeIdeas.length; i++) {
      results.push({
        type: "idea",
        item: safeIdeas[i],
        label: safeIdeas[i].title,
      });
    }

    const safeTasks = tasks || [];
    for (let i = 0; i < safeTasks.length; i++) {
      results.push({
        type: "task",
        item: safeTasks[i],
        label: safeTasks[i].title,
      });
    }

    const safeTopicsArray = topicsArray || [];
    for (let i = 0; i < safeTopicsArray.length; i++) {
      results.push({
        type: "topic",
        item: safeTopicsArray[i],
        label: safeTopicsArray[i].name,
      });
    }

    return results;
  }, [notes, papers, ideas, tasks, topicsArray]);

  const visibleSearchItems = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();

    if (!normalizedSearch) {
      return searchItems.slice(0, SEARCH_RESULTS_LIMIT);
    }

    const results = [];
    for (let i = 0; i < searchItems.length; i++) {
      const entry = searchItems[i];
      if (`${entry.type}: ${entry.label}`.toLowerCase().includes(normalizedSearch)) {
        results.push(entry);
        if (results.length === SEARCH_RESULTS_LIMIT) break;
      }
    }

    return results;
  }, [searchItems, searchValue]);

  return (
    <Command.Dialog open={open} onOpenChange={setOpen} label="Command Menu">
      <div
        className="flex items-center border-b border-border-subtle px-3"
        cmdk-input-wrapper=""
      >
        <Search className="w-5 h-5 text-text-tertiary mr-2" />
        <Command.Input
          placeholder="Type a command or search..."
          value={searchValue}
          onValueChange={setSearchValue}
        />
      </div>

      <Command.List>
        <Command.Empty role="status" aria-live="polite">No results found.</Command.Empty>

        <Command.Group heading="Navigation">
          <Command.Item onSelect={() => handleNavigate("dashboard")}>
            <LayoutDashboard />
            <span>Go to Dashboard</span>
          </Command.Item>
          <Command.Item onSelect={() => handleNavigate("notes")}>
            <FileText />
            <span>Go to Notes</span>
          </Command.Item>
          <Command.Item onSelect={() => handleNavigate("papers")}>
            <BookOpen />
            <span>Go to Papers</span>
          </Command.Item>
          <Command.Item onSelect={() => handleNavigate("ideas")}>
            <Lightbulb />
            <span>Go to Ideas</span>
          </Command.Item>
          <Command.Item onSelect={() => handleNavigate("tasks")}>
            <CheckSquare />
            <span>Go to Tasks</span>
          </Command.Item>
          <Command.Item onSelect={() => handleNavigate("topics")}>
            <Hash />
            <span>Go to Topics</span>
          </Command.Item>
          <Command.Item onSelect={() => handleNavigate("feeds")}>
            <Inbox />
            <span>Go to Feeds</span>
          </Command.Item>
          <Command.Item onSelect={() => handleNavigate("focus")}>
            <Target />
            <span>Go to Focus</span>
          </Command.Item>
        </Command.Group>

        <Command.Group heading="Actions">
          <Command.Item
            onSelect={() => {
              handleNavigate("notes");
            }}
          >
            <Plus />
            <span>New Note</span>
          </Command.Item>

          <Command.Item
            onSelect={() => {
              handleNavigate("papers");
            }}
          >
            <Plus />
            <span>New Paper</span>
          </Command.Item>

          <Command.Item
            onSelect={() => {
              handleNavigate("ideas");
            }}
          >
            <Plus />
            <span>New Idea</span>
          </Command.Item>

          <Command.Item
            onSelect={() => {
              handleNavigate("tasks");
            }}
          >
            <Plus />
            <span>New Task</span>
          </Command.Item>

          <Command.Item
            onSelect={() => {
              handleNavigate("topics");
            }}
          >
            <Plus />
            <span>New Topic</span>
          </Command.Item>

          <Command.Item onSelect={handleOpenDataManagement}>
            <Database />
            <span>Data & API Settings...</span>
          </Command.Item>

          <Command.Item onSelect={handleExport}>
            <Download />
            <span>Quick Export All Data</span>
          </Command.Item>

          <Command.Item onSelect={toggleTheme}>
            {effectiveTheme === "light" ? <Moon /> : <Sun />}
            <span>Toggle Theme</span>
          </Command.Item>

          <Command.Item
            onSelect={() => {
              document.dispatchEvent(new CustomEvent("open-shortcuts-help"));
              setOpen(false);
            }}
          >
            <Keyboard />
            <span>Keyboard Shortcuts</span>
          </Command.Item>
        </Command.Group>

        <Command.Group heading="Search Results">
          {visibleSearchItems.map((entry) => (
            <Command.Item
              key={`${entry.type}-${entry.item.id}`}
              onSelect={() => {
                if (entry.type === "note") handleSelectNote(entry.item);
                if (entry.type === "paper") handleSelectPaper(entry.item);
                if (entry.type === "idea") handleSelectIdea(entry.item);
                if (entry.type === "task") handleSelectTask(entry.item);
                if (entry.type === "topic") handleSelectTopic(entry.item);
              }}
              value={`${entry.type}: ${entry.label}`}
            >
              {entry.type === "note" && (
                <FileText className="text-primary-500" />
              )}
              {entry.type === "paper" && <BookOpen className="text-blue-500" />}
              {entry.type === "idea" && (
                <Lightbulb className="text-yellow-500" />
              )}
              {entry.type === "task" && (
                <CheckSquare className="text-green-500" />
              )}
              {entry.type === "topic" && (
                <Hash className="text-purple-500" />
              )}
              <div className="flex flex-col">
                <span>{entry.label}</span>
                <span className="text-xs text-text-tertiary capitalize">
                  {entry.type}
                </span>
              </div>
            </Command.Item>
          ))}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}

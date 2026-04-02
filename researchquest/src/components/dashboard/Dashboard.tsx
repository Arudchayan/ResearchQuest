import { useMemo } from "react";
import {
  FileText,
  Plus,
  Flame,
  Award,
  Star,
  Sparkles,
  CheckSquare,
  BookOpen,
} from "lucide-react";
import {
  ActivityLogIcon,
  TargetIcon,
  ArrowRightIcon,
  ClockIcon,
} from "@radix-ui/react-icons";
import { useAppStore } from "../../store/appStore";
import { useShallow } from "zustand/react/shallow";
import { getLevelTitle } from "../../utils/gamification";
import { ListSkeleton } from "../ui/Skeleton";

export function Dashboard() {
  // ⚡ PERFORMANCE OPTIMIZATION:
  // Using useShallow to prevent unnecessary re-renders of the entire Dashboard
  // when unrelated properties in the global appStore change.
  const {
    user,
    notes,
    papers,
    tasks,
    notesLoading,
    papersLoading,
    tasksLoading,
    setCurrentView,
    setSelectedNote,
    setSelectedPaper,
  } = useAppStore(
    useShallow((state) => ({
      user: state.user,
      notes: state.notes,
      papers: state.papers,
      tasks: state.tasks,
      notesLoading: state.notesLoading,
      papersLoading: state.papersLoading,
      tasksLoading: state.tasksLoading,
      setCurrentView: state.setCurrentView,
      setSelectedNote: state.setSelectedNote,
      setSelectedPaper: state.setSelectedPaper,
    }))
  );

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const stats = useMemo(() => {
    if (!user) return null;
    const xpInLevel = (user.total_xp || 0) % 500;
    const progress = Math.min(100, (xpInLevel / 500) * 100);

    return {
      level: user.current_level || 1,
      title: getLevelTitle(user.current_level || 1),
      xp: user.total_xp || 0,
      streak: user.current_streak || 0,
      progress,
    };
  }, [user]);

  const recentNotes = useMemo(() => {
    return [...notes]
      .sort((a, b) => {
        // Optimization: Use direct string comparison for ISO dates instead of localeCompare
        return b.updated_at > a.updated_at
          ? 1
          : b.updated_at < a.updated_at
            ? -1
            : 0;
      })
      .slice(0, 3);
  }, [notes]);

  const readingList = useMemo(() => {
    return papers
      .filter((p) => p.status === "To Read")
      .sort((a, b) => {
        // Optimization: Use direct string comparison for ISO dates instead of localeCompare
        return b.created_at > a.created_at
          ? 1
          : b.created_at < a.created_at
            ? -1
            : 0;
      })
      .slice(0, 3);
  }, [papers]);

  const upcomingTasks = useMemo(() => {
    return tasks
      .filter((t) => !t.completed)
      .sort((a, b) => {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        // Optimization: Use direct string comparison for ISO dates instead of localeCompare
        return a.due_date > b.due_date
          ? 1
          : a.due_date < b.due_date
            ? -1
            : 0;
      })
      .slice(0, 3);
  }, [tasks]);

  const handleCreateNote = () => {
    setCurrentView("notes");
  };

  const navigateTo = (view: "notes" | "papers" | "focus" | "tasks") => {
    setCurrentView(view);
    window.history.pushState(null, "", view === "notes" ? "/" : `/${view}`);
  };

  if (!user) {
    return null;
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-title font-serif font-bold text-text-primary flex items-center gap-2">
            {greeting}, {user.username || "Scholar"}{" "}
            <Sparkles className="w-6 h-6 text-warning" />
          </h1>
          <p className="text-small text-text-secondary mt-1 font-serif italic">
            Ready to make some progress today?
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateTo("focus")}
            className="flex items-center gap-2 px-4 py-2 bg-text-primary text-bg-base rounded-sm font-medium hover:opacity-90 transition-opacity"
          >
            <TargetIcon className="w-4 h-4" aria-hidden="true" />
            Start Focus Session
          </button>
        </div>
      </div>

      {stats && stats.progress !== undefined && (
        /* Stats Grid */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Level Card */}
          <div className="bg-bg-surface p-5 rounded-sm border border-border-moderate shadow-sm relative overflow-hidden group hover:border-primary-500 transition-colors">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Award className="w-24 h-24 text-text-primary" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-primary-600 font-semibold mb-2">
                <Star className="w-4 h-4" />
                <span className="uppercase tracking-widest text-caption">Level {stats?.level}</span>
              </div>
              <div className="text-2xl font-serif font-bold text-text-primary mb-1">
                {stats?.title}
              </div>
              <div className="text-small text-text-secondary mb-3 font-serif italic">
                {stats?.xp.toLocaleString()} XP Total
              </div>
              <div className="w-full bg-border-subtle h-1.5 rounded-none overflow-hidden">
                <div
                  className="bg-primary-500 h-full transition-all duration-1000 ease-out"
                  style={{ width: `${stats?.progress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Streak Card */}
          <div className="bg-bg-surface p-5 rounded-sm border border-border-moderate shadow-sm relative overflow-hidden group hover:border-warning transition-colors">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Flame className="w-24 h-24 text-warning" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-warning font-semibold mb-2">
                <Flame className="w-4 h-4" />
                <span className="uppercase tracking-widest text-caption">Day Streak</span>
              </div>
              <div className="text-2xl font-serif font-bold text-text-primary mb-1">
                {stats?.streak} Days
              </div>
              <div className="text-small text-text-secondary font-serif italic">
                Keep it up to earn bonus XP.
              </div>
            </div>
          </div>

          {/* Focus Card - Placeholder for now, maybe total focus time? */}
          <div className="bg-bg-surface p-5 rounded-sm border border-border-moderate shadow-sm relative overflow-hidden group hover:border-purple transition-colors">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <ClockIcon className="w-24 h-24 text-purple" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-purple font-semibold mb-2">
                <TargetIcon className="w-4 h-4" />
                <span className="uppercase tracking-widest text-caption">Active Tasks</span>
              </div>
              <div className="text-2xl font-serif font-bold text-text-primary mb-1">
                {tasks.filter((t) => !t.completed).length} Pending
              </div>
              <div className="text-small text-text-secondary font-serif italic">
                {tasks.filter((t) => t.completed).length} completed so far
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Notes */}
        <section>
          <div className="flex items-center justify-between mb-4 border-b border-border-subtle pb-2">
            <h2 className="font-serif text-lg font-bold text-text-primary flex items-center gap-2">
              <FileText className="w-5 h-5 text-text-tertiary" />
              Recent Notes
            </h2>
            <button
              onClick={() => navigateTo("notes")}
              className="text-small text-text-secondary hover:text-text-primary font-medium flex items-center gap-1 uppercase tracking-wider transition-colors"
            >
              View all <ArrowRightIcon className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <div className="space-y-3">
            {notesLoading ? (
              <ListSkeleton count={3} itemType="note" />
            ) : recentNotes.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-border-strong rounded-sm bg-bg-elevated font-serif italic text-text-tertiary">
                <p className="mb-3">No notes yet</p>
                <button
                  onClick={() => navigateTo("notes")}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-bg-surface border border-border-moderate rounded-sm text-small font-sans not-italic font-medium text-text-primary hover:border-border-strong transition-colors"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" /> Create Note
                </button>
              </div>
            ) : (
              recentNotes.map((note) => (
                <button
                  key={note.id}
                  onClick={() => {
                    setSelectedNote(note);
                    navigateTo("notes");
                    window.history.pushState(null, "", `/notes/${note.id}`);
                  }}
                  className="w-full text-left group p-4 bg-bg-surface border border-border-moderate rounded-sm hover:border-border-strong cursor-pointer transition-all shadow-sm"
                >
                  <h3 className="font-semibold text-text-primary mb-1 truncate group-hover:underline decoration-border-strong underline-offset-2 transition-all">
                    {note.title || "Untitled Note"}
                  </h3>
                  <p className="text-small text-text-secondary line-clamp-2">
                    {note.markdown_body.slice(0, 150) || "No content"}
                  </p>
                  <div className="mt-3 text-caption text-text-tertiary">
                    Updated {new Date(note.updated_at).toLocaleDateString()}
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        {/* Reading List & Tasks */}
        <div className="space-y-8">
          {/* Reading List */}
          <section>
            <div className="flex items-center justify-between mb-4 border-b border-border-subtle pb-2">
              <h2 className="font-serif text-lg font-bold text-text-primary flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-text-tertiary" />
                Up Next to Read
              </h2>
              <button
                onClick={() => navigateTo("papers")}
                className="text-small text-text-secondary hover:text-text-primary font-medium flex items-center gap-1 uppercase tracking-wider transition-colors"
              >
                View Library <ArrowRightIcon className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-3">
              {papersLoading ? (
                <ListSkeleton count={3} itemType="paper" />
              ) : readingList.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-border-strong rounded-sm bg-bg-elevated font-serif italic text-text-tertiary">
                  <p className="mb-3">
                    Your reading list is empty.
                  </p>
                  <button
                    onClick={() => navigateTo("papers")}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-bg-surface border border-border-moderate rounded-sm text-small font-sans not-italic font-medium text-text-primary hover:border-border-strong transition-colors"
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" /> Add Paper
                  </button>
                </div>
              ) : (
                readingList.map((paper) => (
                  <button
                    key={paper.id}
                    onClick={() => {
                      setSelectedPaper(paper);
                      navigateTo("papers");
                      window.history.pushState(null, "", `/papers/${paper.id}`);
                    }}
                    className="w-full text-left flex items-start gap-3 p-3 bg-bg-surface border border-border-moderate rounded-sm hover:bg-bg-elevated hover:border-border-strong cursor-pointer transition-colors"
                  >
                    <div className="p-2 bg-bg-base border border-border-moderate text-text-primary rounded-sm shrink-0">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-medium text-text-primary truncate">
                        {paper.title}
                      </h4>
                      <p className="text-caption text-text-secondary truncate mt-0.5 font-serif italic">
                        {paper.authors?.join(", ") || "Unknown Author"}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          {/* Due Soon */}
          <section>
            <div className="flex items-center justify-between mb-4 border-b border-border-subtle pb-2">
              <h2 className="font-serif text-lg font-bold text-text-primary flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-text-tertiary" />
                Tasks Due Soon
              </h2>
              <button
                onClick={() => navigateTo("tasks")}
                className="text-small text-text-secondary hover:text-text-primary font-medium flex items-center gap-1 uppercase tracking-wider transition-colors"
              >
                All Tasks <ArrowRightIcon className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-3">
              {tasksLoading ? (
                <ListSkeleton count={3} itemType="task" />
              ) : upcomingTasks.length === 0 ? (
                <div className="p-4 text-center text-small font-serif italic text-text-tertiary">
                  No upcoming tasks. You're all caught up.
                </div>
              ) : (
                upcomingTasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => navigateTo("tasks")}
                    className="w-full text-left flex items-center justify-between p-3 bg-bg-surface border border-border-moderate rounded-sm hover:border-border-strong cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-2 h-2 rounded-none shrink-0 ${
                          task.priority === "high"
                            ? "bg-warning"
                            : task.priority === "medium"
                              ? "bg-primary-500"
                              : "bg-success"
                        }`}
                      />
                      <span className="text-small font-medium text-text-primary truncate">
                        {task.title}
                      </span>
                    </div>
                    {task.due_date && (
                      <span className="text-caption font-serif italic text-text-tertiary shrink-0">
                        {new Date(task.due_date).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

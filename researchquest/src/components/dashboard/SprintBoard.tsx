import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  Plus,
  Target,
  Trash2,
  TrendingUp,
} from "lucide-react";
import {
  sprintGoalsForWeek,
  useSprintStore,
} from "../../store/sprintStore";

export function SprintBoard() {
  const days = useSprintStore((state) => state.days);
  const goals = useSprintStore((state) => state.goals);
  const addGoal = useSprintStore((state) => state.addGoal);
  const completeGoal = useSprintStore((state) => state.completeGoal);
  const deleteGoal = useSprintStore((state) => state.deleteGoal);
  const [goalTitle, setGoalTitle] = useState("");
  const [showGoalForm, setShowGoalForm] = useState(false);

  useEffect(() => {
    useSprintStore.getState().resetIfNeeded();
  }, []);

  const weekGoals = useMemo(() => sprintGoalsForWeek(goals), [goals]);
  const weekDays = useMemo(
    () =>
      Object.values(days).sort((a, b) => (a.date > b.date ? 1 : -1)),
    [days],
  );

  const weekXp = weekDays.reduce((sum, day) => sum + day.xp, 0);
  const weekMinutes = weekDays.reduce((sum, day) => sum + day.minutes, 0);
  const activeGoals = weekGoals.filter((goal) => goal.status === "active").length;
  const doneGoals = weekGoals.filter((goal) => goal.status === "done").length;
  const goalProgress = weekGoals.length
    ? Math.round((doneGoals / weekGoals.length) * 100)
    : 0;
  const today = new Date().toISOString().split("T")[0];
  const todayDay = weekDays.find((day) => day.date === today);
  const maxXp = Math.max(1, ...weekDays.map((day) => day.xp));

  const submitGoal = (event: React.FormEvent) => {
    event.preventDefault();
    if (!goalTitle.trim()) return;
    addGoal(goalTitle);
    setGoalTitle("");
    setShowGoalForm(false);
  };

  return (
    <div className="surface-panel overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border-subtle px-6 py-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="icon-tile bg-violet-soft text-violet-strong">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2 className="font-serif text-lg font-bold text-text-primary">
              Research sprint
            </h2>
          </div>
          <p className="mt-1 text-caption text-text-tertiary">
            This week&apos;s activity and goals
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2 text-center">
            <div className="text-lg font-bold text-text-primary">{weekXp} XP</div>
            <div className="text-caption text-text-tertiary">This week</div>
          </div>
          <div className="rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2 text-center">
            <div className="text-lg font-bold text-text-primary">{weekMinutes} min</div>
            <div className="text-caption text-text-tertiary">Focus</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        {/* Week calendar */}
        <div>
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day) => {
              const isToday = day.date === today;
              const height = Math.max(10, Math.round((day.xp / maxXp) * 96));
              return (
                <div
                  key={day.date}
                  className={`flex flex-col items-center gap-2 rounded-xl border p-2 ${
                    isToday
                      ? "border-accent/40 bg-accent-soft shadow-glow"
                      : "border-border-subtle bg-bg-elevated"
                  }`}
                >
                  <div className="text-caption font-bold text-text-secondary">
                    {day.label}
                  </div>
                  <div className="flex h-24 w-full items-end justify-center">
                    <div
                      className={`w-full max-w-6 rounded-t-md ${
                        isToday ? "brand-gradient" : "bg-accent/35"
                      }`}
                      style={{ height }}
                      title={`${day.xp} XP`}
                    />
                  </div>
                  <div className="text-caption font-semibold text-text-primary">
                    {day.xp}
                  </div>
                  <div className="flex flex-wrap justify-center gap-1">
                    {day.events.slice(-3).map((event, index) => (
                      <span
                        key={`${event}-${index}`}
                        className="rounded-full bg-bg-surface px-1.5 py-0.5 text-caption text-text-secondary"
                      >
                        {event}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {todayDay && todayDay.events.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-border-subtle bg-bg-elevated p-3">
              <TrendingUp className="h-4 w-4 shrink-0 text-accent-strong" aria-hidden="true" />
              <span className="text-caption font-medium text-text-secondary">
                Today: {todayDay.xp} XP · {todayDay.minutes} focus minutes
              </span>
              {todayDay.events.map((event, index) => (
                <span
                  key={`${event}-${index}`}
                  className="rounded-full border border-border-subtle bg-bg-surface px-2 py-0.5 text-caption text-text-secondary"
                >
                  {event}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Goals */}
        <div className="flex flex-col">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-small font-bold uppercase tracking-wider text-text-primary">
                Sprint goals
              </h3>
              <p className="mt-0.5 text-caption text-text-tertiary">
                {activeGoals} open · {doneGoals} complete
              </p>
            </div>
            <button
              onClick={() => setShowGoalForm((open) => !open)}
              className="icon-btn bg-accent-soft text-accent-strong hover:bg-accent/20"
              aria-label="Add sprint goal"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {weekGoals.length > 0 && (
            <div className="mb-4 flex items-center gap-3">
              <div className="progress-track h-2 flex-1">
                <div
                  className="progress-fill"
                  style={{ width: `${goalProgress}%` }}
                />
              </div>
              <span className="text-caption font-semibold text-text-secondary">
                {goalProgress}%
              </span>
            </div>
          )}

          {showGoalForm && (
            <form
              onSubmit={submitGoal}
              className="mb-3 rounded-xl border border-accent/30 bg-accent-soft p-3"
            >
              <label htmlFor="sprint-goal-title" className="sr-only">
                Goal title
              </label>
              <input
                id="sprint-goal-title"
                value={goalTitle}
                onChange={(event) => setGoalTitle(event.target.value)}
                maxLength={120}
                placeholder="What should this week accomplish?"
                className="w-full rounded-lg border border-border-moderate bg-bg-surface px-3 py-2 text-small text-text-primary shadow-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
              />
              <button
                type="submit"
                className="mt-2 inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-accent-strong px-3 text-small font-semibold text-accent-contrast shadow-sm transition-transform hover:-translate-y-0.5"
              >
                <Target className="h-4 w-4" aria-hidden="true" />
                Add goal
              </button>
            </form>
          )}

          <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
            {weekGoals.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border-moderate bg-bg-elevated p-5 text-center">
                <Target className="mx-auto h-5 w-5 text-text-tertiary" aria-hidden="true" />
                <p className="mt-2 text-small font-medium text-text-secondary">
                  No goals yet
                </p>
                <p className="mt-1 text-caption text-text-tertiary">
                  Add a weekly goal to keep the sprint focused.
                </p>
              </div>
            ) : (
              weekGoals.map((goal) => (
                <div
                  key={goal.id}
                  className={`surface-card flex items-start gap-3 p-3.5 ${
                    goal.status === "done" ? "opacity-75" : ""
                  }`}
                >
                  <button
                    onClick={() => completeGoal(goal.id)}
                    className="mt-0.5 shrink-0 text-text-tertiary transition-colors hover:text-accent-strong"
                    aria-label={goal.status === "done" ? "Goal complete" : "Complete goal"}
                  >
                    {goal.status === "done" ? (
                      <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
                    ) : (
                      <Circle className="h-5 w-5" aria-hidden="true" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-small font-semibold ${
                        goal.status === "done"
                          ? "text-text-tertiary line-through"
                          : "text-text-primary"
                      }`}
                    >
                      {goal.title}
                    </div>
                    {goal.detail && (
                      <p className="mt-0.5 line-clamp-2 text-caption text-text-tertiary">
                        {goal.detail}
                      </p>
                    )}
                    <div className="mt-1 flex items-center gap-2 text-caption text-text-tertiary">
                      {goal.status === "done" ? (
                        <span className="inline-flex items-center gap-1 text-success">
                          <Check className="h-3 w-3" aria-hidden="true" />
                          Completed
                        </span>
                      ) : (
                        <span>Active</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteGoal(goal.id)}
                    className="icon-btn h-7 w-7 shrink-0 text-text-tertiary hover:bg-coral-soft hover:text-coral-strong"
                    aria-label="Delete sprint goal"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useMemo } from 'react'
import {
  FileText,
  BookOpen,
  Target,
  Plus,
  Flame,
  Award,
  Star,
  ArrowRight,
  Clock,
  Sparkles,
  CheckSquare
} from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import { getLevelTitle } from '../../utils/gamification'
import { ListSkeleton } from '../ui/Skeleton'

export function Dashboard() {
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
    setSelectedPaper
  } = useAppStore()

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }, [])

  const stats = useMemo(() => {
    if (!user) return null
    const xpInLevel = (user.total_xp || 0) % 500
    const progress = Math.min(100, (xpInLevel / 500) * 100)

    return {
      level: user.current_level || 1,
      title: getLevelTitle(user.current_level || 1),
      xp: user.total_xp || 0,
      streak: user.current_streak || 0,
      progress
    }
  }, [user])

  const recentNotes = useMemo(() => {
    return [...notes]
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(0, 3)
  }, [notes])

  const readingList = useMemo(() => {
    return papers
      .filter(p => p.status === 'To Read')
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 3)
  }, [papers])

  const upcomingTasks = useMemo(() => {
    return tasks
      .filter(t => !t.completed)
      .sort((a, b) => {
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return a.due_date.localeCompare(b.due_date)
      })
      .slice(0, 3)
  }, [tasks])

  const handleCreateNote = () => {
    setCurrentView('notes')
  }

  const navigateTo = (view: 'notes' | 'papers' | 'focus' | 'tasks') => {
    setCurrentView(view)
    window.history.pushState(null, '', view === 'notes' ? '/' : `/${view}`)
  }

  if (!user) {
      return null
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            {greeting}, {user.username || 'Researcher'} <Sparkles className="w-6 h-6 text-yellow-500" />
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Ready to make some progress today?
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateTo('focus')}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            <Target className="w-4 h-4" />
            Start Focus Session
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Level Card */}
        <div className="bg-white dark:bg-slate-950 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-blue-500/50 transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Award className="w-24 h-24 text-blue-500" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold mb-2">
              <Star className="w-4 h-4" />
              <span>Level {stats?.level}</span>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
              {stats?.title}
            </div>
            <div className="text-sm text-slate-500 mb-3">
              {stats?.xp.toLocaleString()} XP Total
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-blue-500 h-full rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${stats?.progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Streak Card */}
        <div className="bg-white dark:bg-slate-950 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-orange-500/50 transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Flame className="w-24 h-24 text-orange-500" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 font-semibold mb-2">
              <Flame className="w-4 h-4" />
              <span>Day Streak</span>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
              {stats?.streak} Days
            </div>
            <div className="text-sm text-slate-500">
              Keep it up to earn bonus XP!
            </div>
          </div>
        </div>

        {/* Focus Card - Placeholder for now, maybe total focus time? */}
        <div className="bg-white dark:bg-slate-950 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-purple-500/50 transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Clock className="w-24 h-24 text-purple-500" />
          </div>
          <div className="relative z-10">
             <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-semibold mb-2">
              <Target className="w-4 h-4" />
              <span>Active Tasks</span>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
              {tasks.filter(t => !t.completed).length} Pending
            </div>
             <div className="text-sm text-slate-500">
              {tasks.filter(t => t.completed).length} completed so far
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Notes */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-400" />
              Recent Notes
            </h2>
            <button
              onClick={() => navigateTo('notes')}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium flex items-center gap-1"
            >
              View all <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            {notesLoading ? (
              <ListSkeleton count={3} itemType="note" />
            ) : recentNotes.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
                <p className="text-slate-500 mb-3">No notes yet</p>
                <button
                  onClick={() => navigateTo('notes')}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:border-blue-500 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Create Note
                </button>
              </div>
            ) : (
              recentNotes.map(note => (
                <button
                  key={note.id}
                  onClick={() => {
                    setSelectedNote(note)
                    navigateTo('notes')
                    window.history.pushState(null, '', `/notes/${note.id}`)
                  }}
                  className="w-full text-left group p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-blue-400 dark:hover:border-blue-600 cursor-pointer transition-all shadow-sm hover:shadow-md"
                >
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-1 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {note.title || 'Untitled Note'}
                  </h3>
                  <p className="text-sm text-slate-500 line-clamp-2">
                     {note.markdown_body.slice(0, 150) || 'No content'}
                  </p>
                  <div className="mt-3 text-xs text-slate-400">
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
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-slate-400" />
                Up Next to Read
              </h2>
              <button
                onClick={() => navigateTo('papers')}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium flex items-center gap-1"
              >
                View Library <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {papersLoading ? (
                <ListSkeleton count={3} itemType="paper" />
              ) : readingList.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
                  <p className="text-slate-500 mb-3">Your reading list is empty!</p>
                  <button
                    onClick={() => navigateTo('papers')}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:border-blue-500 transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Add Paper
                  </button>
                </div>
              ) : (
                readingList.map(paper => (
                   <button
                    key={paper.id}
                    onClick={() => {
                      setSelectedPaper(paper)
                      navigateTo('papers')
                      window.history.pushState(null, '', `/papers/${paper.id}`)
                    }}
                    className="w-full text-left flex items-start gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                  >
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg shrink-0">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-medium text-slate-900 dark:text-white truncate">
                        {paper.title}
                      </h4>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {paper.authors?.join(', ') || 'Unknown Author'}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          {/* Due Soon */}
          <section>
             <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-slate-400" />
                Tasks Due Soon
              </h2>
              <button
                onClick={() => navigateTo('tasks')}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium flex items-center gap-1"
              >
                All Tasks <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
               {tasksLoading ? (
                 <ListSkeleton count={3} itemType="task" />
               ) : upcomingTasks.length === 0 ? (
                 <div className="p-4 text-center text-sm text-slate-500 italic">
                   No upcoming tasks. You're all caught up!
                 </div>
               ) : (
                 upcomingTasks.map(task => (
                   <button
                     key={task.id}
                     onClick={() => navigateTo('tasks')}
                     className="w-full text-left flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer transition-colors"
                   >
                     <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${
                          task.priority === 'high' ? 'bg-red-500' :
                          task.priority === 'medium' ? 'bg-amber-500' : 'bg-green-500'
                        }`} />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                          {task.title}
                        </span>
                     </div>
                     {task.due_date && (
                       <span className="text-xs text-slate-400 shrink-0">
                         {new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
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
  )
}

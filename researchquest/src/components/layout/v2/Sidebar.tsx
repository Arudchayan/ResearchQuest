import { useState, useRef } from 'react'
import {
  BookOpen,
  FileText,
  Lightbulb,
  CheckSquare,
  Clock,
  Settings,
  LogOut,
  User,
  Sun,
  Moon,
  Flame,
  HelpCircle,
  Download,
  Upload,
  PanelRightOpen,
  PanelRightClose,
  Keyboard
} from 'lucide-react'
import { useAppStore } from '../../../store/appStore'
import { cn } from '../../../lib/utils'
import { supabase } from '../../../lib/supabase'
import { XPExplainer } from '../XPExplainer'
import { ProfileDialog } from '../ProfileDialog'
import { exportData } from '../../../utils/export'
import { importData } from '../../../utils/import'

export function Sidebar() {
  const { currentView, setCurrentView, user, effectiveTheme, setTheme, isRightSidebarOpen, setIsRightSidebarOpen } = useAppStore()
  const [showXpGuide, setShowXpGuide] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = () => {
    const { user, notes, papers, ideas, topics } = useAppStore.getState()

    // Map TopicWithCounts to Topic (strip counts)
    const cleanTopics = topics.map(t => ({
      id: t.id,
      user_id: t.user_id,
      name: t.name,
      description: t.description,
      created_at: t.created_at,
      updated_at: t.updated_at
    }))

    exportData({ user, notes, papers, ideas, topics: cleanTopics })
  }

  const handleImport = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && user?.id) {
      importData(file, user.id)
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const navItems = [
    { id: 'notes', label: 'Notes', icon: FileText },
    { id: 'papers', label: 'Papers', icon: BookOpen },
    { id: 'ideas', label: 'Ideas', icon: Lightbulb },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'focus', label: 'Focus', icon: Clock },
  ] as const

  const handleLogout = async () => {
    await supabase.auth.signOut()
    // State update handled by auth listener in App.tsx
  }

  const toggleTheme = () => {
    const newTheme = effectiveTheme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
  }

  const handleOpenShortcuts = () => {
    document.dispatchEvent(new CustomEvent('open-shortcuts-help'))
  }

  const xpProgress = user ? (user.total_xp % 500) / 500 * 100 : 0
  const currentLevel = user?.current_level || 1
  const xpInLevel = user ? user.total_xp % 500 : 0

  return (
    <aside className="w-64 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-full transition-colors duration-300">
      <div className="p-6">
        <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
            RQ
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-slate-100">
            ResearchQuest
          </span>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              setCurrentView(item.id)
              // Update URL without reload
              window.history.pushState(null, '', `/${item.id}`)
            }}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
              currentView === item.id
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            )}
            aria-current={currentView === item.id ? 'page' : undefined}
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </button>
        ))}
      </nav>

      {user && (
        <div className="px-4 py-4 space-y-4">
          {/* XP Card */}
          <div className="p-3 bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
             <div className="flex items-center justify-between mb-2">
               <span className="text-xs font-semibold text-slate-900 dark:text-white">Level {currentLevel}</span>
               <button
                 onClick={() => setShowXpGuide(true)}
                 className="text-slate-400 hover:text-blue-500"
                 aria-label="Learn about XP and Levels"
               >
                 <HelpCircle className="w-3.5 h-3.5" />
               </button>
             </div>
             <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-1">
               <div className="h-full bg-blue-500 rounded-full" style={{ width: `${xpProgress}%` }} />
             </div>
             <div className="flex justify-between text-[10px] text-slate-500">
               <span>{xpInLevel} XP</span>
               <span>500 XP</span>
             </div>
          </div>
        </div>
      )}

      <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-1">
        <div className="flex items-center justify-between px-3 py-2">
           <button
             onClick={() => setShowProfile(true)}
             className="flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md p-1 -ml-1 transition-colors text-left"
             aria-label="User profile"
           >
             <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
               <User className="w-4 h-4" />
             </div>
             <div className="text-xs">
               <span className="block font-medium text-slate-900 dark:text-white truncate max-w-[80px]">User</span>
               <span className="flex items-center gap-1 text-slate-500">
                 <Flame className="w-3 h-3 text-orange-500" /> {user?.current_streak || 0}
               </span>
             </div>
           </button>
           <div className="flex items-center gap-1">
             <button
               onClick={handleOpenShortcuts}
               className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
               aria-label="Keyboard Shortcuts"
               title="Keyboard Shortcuts"
             >
               <Keyboard className="w-4 h-4" />
             </button>
             <button
               onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
               className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
               aria-label={isRightSidebarOpen ? 'Close context panel' : 'Open context panel'}
               title="Toggle Context Panel"
             >
               {isRightSidebarOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
             </button>
             <button
               onClick={toggleTheme}
               className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
               aria-label={effectiveTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
             >
               {effectiveTheme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
             </button>
           </div>
        </div>

        <button
          onClick={handleExport}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
        >
          <Download className="w-5 h-5" />
          Export Data
        </button>

        <button
          onClick={handleImport}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
        >
          <Upload className="w-5 h-5" />
          Import Data
        </button>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".json"
          className="hidden"
        />

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>

      <XPExplainer
        open={showXpGuide}
        onClose={() => setShowXpGuide(false)}
        currentLevel={currentLevel}
        totalXP={user?.total_xp || 0}
      />

      <ProfileDialog
        open={showProfile}
        onClose={() => setShowProfile(false)}
      />
    </aside>
  )
}

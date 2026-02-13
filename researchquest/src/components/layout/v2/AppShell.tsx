import { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { RightSidebar } from '../RightSidebar'
import { Menu, X } from 'lucide-react'
import { useAppStore } from '../../../store/appStore'
import { cn } from '../../../lib/utils'
import { useShallow } from 'zustand/react/shallow'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  // OPTIMIZATION: Use shallow selector to prevent unnecessary re-renders when other parts of the store change
  const { isMobileSidebarOpen, setIsMobileSidebarOpen, isRightSidebarOpen } = useAppStore(
    useShallow((state) => ({
      isMobileSidebarOpen: state.isMobileSidebarOpen,
      setIsMobileSidebarOpen: state.setIsMobileSidebarOpen,
      isRightSidebarOpen: state.isRightSidebarOpen,
    }))
  )

  return (
    <div className="flex h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans overflow-hidden">
      {/* Skip to content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-white focus:text-blue-600 focus:font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:rounded-md focus:shadow-lg"
      >
        Skip to content
      </a>

      {/* Desktop Sidebar */}
      <div className="hidden lg:block h-full shrink-0">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-slate-50 dark:bg-slate-900 shadow-xl transition-transform duration-300 lg:hidden",
        isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <Sidebar />
        <button
          onClick={() => setIsMobileSidebarOpen(false)}
          className="absolute top-4 right-4 p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden h-16 flex items-center px-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shrink-0">
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 rounded-md"
            aria-label="Open sidebar"
          >
            <Menu className="w-6 h-6" />
          </button>
          <span className="ml-3 font-semibold text-lg">ResearchQuest</span>
        </header>

        {/* Content Area */}
        <main id="main-content" className="flex-1 overflow-auto" tabIndex={-1}>
          {children}
        </main>
      </div>

      {/* Right Sidebar (Context Panel) */}
      <div className={cn(
        "hidden xl:block h-full shrink-0 bg-slate-50 dark:bg-slate-900 transition-all duration-300 ease-in-out overflow-hidden",
        isRightSidebarOpen ? "w-80 border-l border-slate-200 dark:border-slate-800" : "w-0 border-l-0"
      )}>
        <div className="w-80 h-full">
          <RightSidebar />
        </div>
      </div>
    </div>
  )
}

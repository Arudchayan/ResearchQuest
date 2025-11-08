import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { LeftSidebar } from './LeftSidebar'

export function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Mobile Menu Button - Only visible on mobile/tablet */}
      <button
        onClick={() => setIsOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 w-10 h-10 flex items-center justify-center bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors shadow-lg"
        aria-label="Open navigation menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-50 transition-opacity"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Drawer - Slide out from left */}
      <div
        className={`lg:hidden fixed top-0 left-0 bottom-0 w-80 max-w-[85vw] bg-bg-surface z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Close Button */}
        <button
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-md hover:bg-bg-elevated transition-colors"
          aria-label="Close navigation menu"
        >
          <X className="w-5 h-5 text-text-secondary" />
        </button>

        {/* Sidebar Content */}
        <div className="h-full overflow-y-auto pt-2">
          <LeftSidebar onNavigate={() => setIsOpen(false)} />
        </div>
      </div>
    </>
  )
}

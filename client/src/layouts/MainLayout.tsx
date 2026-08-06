import { FC, useState } from 'react'
import { Outlet, NavLink, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Home, Phone, Settings, Activity, LogOut, Menu, X } from 'lucide-react'
import { NotificationDropdown } from '../components/NotificationDropdown'

const navItems = [
  { to: '/', label: 'Dashboard', icon: Home, exact: true },
  { to: '/calls', label: 'Calls', icon: Phone },
  { to: '/settings', label: 'Settings', icon: Settings },
]

const MainLayout: FC = () => {
  const { user, logout } = useAuth()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="h-screen overflow-hidden bg-surface-page flex flex-col">
      {/* Header */}
      <header className="bg-surface-card border-b border-border sticky top-0 z-40">
        <div className="px-4 sm:px-6 h-16 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            {/* Mobile Hamburger Menu Toggle Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-text-secondary hover:bg-surface-page hover:text-text-primary transition-colors cursor-pointer"
              title="Toggle Menu"
              aria-label="Toggle Menu"
            >
              {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            <h1 className="text-xl font-semibold text-text-primary">
              Mantra Tech
            </h1>
          </div>

          <div className="flex items-center space-x-3 sm:space-x-6">
            <div className="flex items-center space-x-4">
              <NotificationDropdown />
            </div>

            <div className="h-6 w-px bg-border hidden sm:block" />

            <div className="flex items-center space-x-3">
              <Link
                to="/profile"
                className="flex items-center space-x-2.5 group hover:opacity-80 transition-opacity"
                title="View Profile Settings"
              >
                <span className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors hidden sm:inline">
                  {user?.name || 'Admin User'}
                </span>
                <div className="w-8 h-8 bg-surface-page rounded-full flex items-center justify-center text-text-primary text-xs font-semibold border border-border group-hover:border-accent transition-colors shadow-sm">
                  {user?.name?.charAt(0).toUpperCase() || 'A'}
                </div>
              </Link>
              <button
                onClick={logout}
                className="flex items-center space-x-1.5 ml-1 text-sm font-medium text-text-secondary hover:text-status-escalated transition-colors cursor-pointer"
                title="Logout"
              >
                <LogOut size={18} strokeWidth={1.75} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile Sidebar Overlay Backdrop */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar (Responsive drawer on mobile, static on desktop) */}
        <aside
          className={`bg-surface-card border-r border-border shrink-0 h-full overflow-y-auto scrollbar-thin z-50 transition-all duration-200 ${
            isMobileMenuOpen
              ? 'fixed inset-y-0 left-0 w-64 shadow-2xl pt-16 md:pt-0'
              : 'hidden md:block w-60'
          }`}
        >
          <nav className="p-4">
            <p className="px-3 text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Main Menu</p>
            <ul className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.exact}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center px-3 h-10 space-x-2 text-sm font-medium rounded-md transition-colors ${isActive
                          ? 'bg-text-primary text-surface-card'
                          : 'text-text-secondary hover:bg-surface-page hover:text-text-primary'
                        }`
                      }
                    >
                      <Icon size={20} strokeWidth={1.75} />
                      <span>{item.label}</span>
                    </NavLink>
                  </li>
                )
              })}

              {/* Super Admin only — Usage */}
              {user?.role === 'super_admin' && (
                <li className="mt-6">
                  <NavLink
                    to="/usage"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center px-3 h-10 space-x-2 text-sm font-medium rounded-md transition-colors ${isActive
                        ? 'bg-text-primary text-surface-card'
                        : 'text-text-secondary hover:bg-surface-page hover:text-text-primary'
                      }`
                    }
                  >
                    <Activity size={20} strokeWidth={1.75} />
                    <span>Usage</span>
                  </NavLink>
                </li>
              )}
            </ul>
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default MainLayout
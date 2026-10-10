import { FC, useState } from 'react'
import { Outlet, NavLink, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  Home,
  Phone,
  Settings,
  Activity,
  LogOut,
  Menu,
  X,
  AudioWaveform,
  User,
} from 'lucide-react'
import { NotificationDropdown } from '../components/NotificationDropdown'

const navItems = [
  { to: '/', label: 'Dashboard', icon: Home, exact: true },
  { to: '/calls', label: 'Calls', icon: Phone },
  { to: '/settings', label: 'Settings', icon: Settings },
]

const MainLayout: FC = () => {
  const { user, logout } = useAuth()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <div className="h-screen overflow-hidden bg-surface-page flex flex-col font-sans text-text-primary antialiased">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="bg-surface-card border-b border-border sticky top-0 z-40 shrink-0">
        <div className="px-4 sm:px-6 h-15 flex justify-between items-center gap-4">
          {/* Brand */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 -ml-2 rounded-xl text-text-secondary hover:bg-surface-page hover:text-text-primary transition-colors cursor-pointer"
              title="Toggle Menu"
              aria-label="Toggle Menu"
            >
              {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            <Link to="/" className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-text-primary text-surface-card flex items-center justify-center shadow-xs">
                <AudioWaveform size={17} strokeWidth={2.25} />
              </div>
              <span className="text-base font-semibold tracking-tight text-text-primary">
                Mantra Tech
              </span>
            </Link>
          </div>

          {/* Right Header: Notifications & Profile */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            <div className="flex items-center">
              <NotificationDropdown />
            </div>

            <div className="h-4 w-px bg-border hidden sm:block" />

            <div className="flex items-center space-x-2">
              <Link
                to="/profile"
                className="flex items-center space-x-2.5 px-2 py-1 rounded-xl hover:bg-surface-page border border-transparent hover:border-border transition-all group"
                title="View Profile Settings"
              >
                <div className="w-7.5 h-7.5 bg-surface-page rounded-full flex items-center justify-center text-text-primary text-xs font-semibold border border-border shadow-2xs group-hover:border-text-primary transition-colors">
                  {user?.name?.charAt(0).toUpperCase() || <User size={14} />}
                </div>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-xs font-semibold text-text-primary leading-tight group-hover:text-accent transition-colors">
                    {user?.name || 'Admin User'}
                  </span>
                  <span className="text-[10px] text-text-muted capitalize leading-none">
                    {user?.role?.replace('_', ' ') || 'User'}
                  </span>
                </div>
              </Link>

              <button
                onClick={logout}
                className="p-2 rounded-xl text-text-secondary hover:text-status-escalated hover:bg-red-500/10 transition-colors cursor-pointer"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut size={16} strokeWidth={1.75} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Area ─────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile Backdrop */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/30 md:hidden backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`bg-surface-card border-r border-border shrink-0 h-full overflow-y-auto scrollbar-narrow z-50 transition-all duration-200 flex flex-col justify-between ${
            isMobileMenuOpen
              ? 'fixed inset-y-0 left-0 w-60 shadow-2xl pt-16 md:pt-0'
              : 'hidden md:flex w-56'
          }`}
        >
          <div className="p-3 space-y-4">
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
                        `flex items-center px-3 h-9.5 space-x-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                          isActive
                            ? 'bg-text-primary text-surface-card shadow-xs'
                            : 'text-text-secondary hover:bg-surface-page hover:text-text-primary'
                        }`
                      }
                    >
                      <Icon size={16} strokeWidth={2} />
                      <span>{item.label}</span>
                    </NavLink>
                  </li>
                )
              })}

              {/* Super Admin only — Usage */}
              {user?.role === 'super_admin' && (
                <li>
                  <NavLink
                    to="/usage"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center px-3 h-9.5 space-x-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                        isActive
                          ? 'bg-text-primary text-surface-card shadow-xs'
                          : 'text-text-secondary hover:bg-surface-page hover:text-text-primary'
                      }`
                    }
                  >
                    <Activity size={16} strokeWidth={2} />
                    <span>Usage</span>
                  </NavLink>
                </li>
              )}
            </ul>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default MainLayout
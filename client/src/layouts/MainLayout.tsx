import { FC } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Home, Phone, BarChart2, Settings, Activity, Bell, Mail, LogOut } from 'lucide-react'

const navItems = [
  { to: '/', label: 'Dashboard', icon: Home, exact: true },
  { to: '/calls', label: 'Calls', icon: Phone },
  { to: '/analytics', label: 'Analytics', icon: BarChart2 },
]

const MainLayout: FC = () => {
  const { user, logout } = useAuth()

  return (
    <div className="h-screen overflow-hidden bg-surface-page flex flex-col">
      {/* Header */}
      <header className="bg-surface-card border-b border-border sticky top-0 z-10">
        <div className="px-6 h-16 flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-xl font-semibold text-text-primary">
              Mantra Tech
            </h1>
          </div>
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-4">
              <button className="text-text-secondary hover:text-text-primary transition-colors">
                <Bell size={20} strokeWidth={1.75} />
              </button>
              <button className="text-text-secondary hover:text-text-primary transition-colors">
                <Mail size={20} strokeWidth={1.75} />
              </button>
            </div>
            
            <div className="h-6 w-px bg-border" />
            
            <div className="flex items-center space-x-3">
              <span className="text-sm font-medium text-text-primary">{user?.name || 'Admin User'}</span>
              <div className="w-8 h-8 bg-border rounded-full flex items-center justify-center text-text-secondary text-xs font-medium border border-border-strong">
                {user?.name?.charAt(0) || 'A'}
              </div>
              <button
                onClick={logout}
                className="flex items-center space-x-1.5 ml-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
                title="Logout"
              >
                <LogOut size={20} strokeWidth={1.75} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-60 bg-surface-card border-r border-border shrink-0 h-full overflow-y-auto scrollbar-thin">
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
                      className={({ isActive }) =>
                        `flex items-center px-3 h-10 space-x-2 text-sm font-medium rounded-md transition-colors ${
                          isActive
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

              {/* Settings — disabled (coming soon) */}
              <li>
                <div className="flex items-center px-3 h-10 space-x-2 text-sm font-medium rounded-md cursor-not-allowed opacity-40 select-none text-text-secondary">
                  <Settings size={20} strokeWidth={1.75} />
                  <span>Settings</span>
                </div>
              </li>

              {/* Super Admin only — Usage */}
              {user?.role === 'super_admin' && (
                <li className="mt-6">
                  <NavLink
                    to="/usage"
                    className={({ isActive }) =>
                      `flex items-center px-3 h-10 space-x-2 text-sm font-medium rounded-md transition-colors ${
                        isActive
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

        {/* Main Content */}
        <main className="flex-1 overflow-hidden h-full">
          <div className="h-full p-6 lg:p-8 overflow-y-auto scrollbar-thin">
            <div className="max-w-7xl mx-auto h-full">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default MainLayout
import { FC } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const navItems = [
  { to: '/', label: 'Dashboard', exact: true },
  { to: '/calls', label: 'Calls' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/settings', label: 'Settings' },
]

const MainLayout: FC = () => {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between items-center">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-slate-800">
                Mantra Tech Admin
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-slate-600">{user?.name || 'Admin User'}</span>
              <div className="w-8 h-8 bg-slate-300 rounded-full"></div>
              <button
                onClick={logout}
                className="text-sm text-slate-600 hover:text-slate-800"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white min-h-[calc(100vh-4rem)] border-r border-slate-200">
          <nav className="p-4">
            <ul className="space-y-1">
              {navItems.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.exact}
                    className={({ isActive }) =>
                      `flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                        isActive
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
              {/* Super Admin only - Usage */}
              {user?.role === 'super_admin' && (
                <li>
                  <NavLink
                    to="/usage"
                    className={({ isActive }) =>
                      `flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                        isActive
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`
                    }
                  >
                    Usage
                  </NavLink>
                </li>
              )}
            </ul>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default MainLayout
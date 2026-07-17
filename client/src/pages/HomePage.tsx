import { FC } from 'react'

const HomePage: FC = () => {
  const stats = [
    { label: 'Active Agents', value: '12', change: '+2%' },
    { label: 'Total Sessions', value: '1,248', change: '+12%' },
    { label: 'Avg Response Time', value: '1.2s', change: '-5%' },
    { label: 'Success Rate', value: '98.5%', change: '+1%' },
  ]

  return (
    <div>
      <h2 className="text-2xl font-semibold text-slate-800 mb-6">Dashboard</h2>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-sm text-slate-600">{stat.label}</p>
            <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
            <p className="text-xs text-slate-500">{stat.change} from last week</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
        <h3 className="text-lg font-medium text-slate-800 mb-4">Quick Actions</h3>
        <div className="flex space-x-4">
          <button className="px-4 py-2 bg-slate-800 text-white rounded-md hover:bg-slate-700 text-sm">
            Create New Agent
          </button>
          <button className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 text-sm">
            View Reports
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-lg font-medium text-slate-800 mb-4">Recent Activity</h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
              <div>
                <p className="text-sm font-medium text-slate-700">Agent session completed</p>
                <p className="text-xs text-slate-500">Voice agent #00{i} • 2 hours ago</p>
              </div>
              <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">Success</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default HomePage
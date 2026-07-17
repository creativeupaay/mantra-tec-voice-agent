import { FC, useEffect, useState } from 'react'
import { analyticsApi } from '../api/client'

const AnalyticsPage: FC = () => {
  const [analytics, setAnalytics] = useState<{
    totalUsers: number
    totalAgents: number
    totalSessions: number
    totalCreditsUsed: number
    monthlyStats: { _id: { year: number; month: number; day: number }; totalUsed: number }[]
  } | null>(null)

  useEffect(() => {
    analyticsApi.getDashboard()
      .then(res => setAnalytics(res.data.data))
      .catch(() => setAnalytics(null))
  }, [])

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Analytics Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total Users</h3>
          <p className="text-3xl font-bold text-gray-900">{analytics?.totalUsers ?? '-'}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total Agents</h3>
          <p className="text-3xl font-bold text-gray-900">{analytics?.totalAgents ?? '-'}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total Sessions</h3>
          <p className="text-3xl font-bold text-gray-900">{analytics?.totalSessions ?? '-'}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Credits Used (30d)</h3>
          <p className="text-3xl font-bold text-gray-900">{analytics?.totalCreditsUsed ?? '-'}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Monthly Usage</h2>
        <div className="h-64 flex items-center justify-center text-gray-500">
          Chart will be displayed here
        </div>
      </div>
    </div>
  )
}

export default AnalyticsPage
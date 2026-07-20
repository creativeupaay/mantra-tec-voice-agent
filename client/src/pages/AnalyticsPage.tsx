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
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-text-primary">Analytics Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-card p-6 rounded-2xl border border-border">
          <p className="text-[13px] font-medium text-text-secondary mb-2">Total Users</p>
          <p className="text-3xl font-semibold text-text-primary font-mono tabular-nums mb-1">{analytics?.totalUsers ?? '-'}</p>
        </div>
        <div className="bg-surface-card p-6 rounded-2xl border border-border">
          <p className="text-[13px] font-medium text-text-secondary mb-2">Total Agents</p>
          <p className="text-3xl font-semibold text-text-primary font-mono tabular-nums mb-1">{analytics?.totalAgents ?? '-'}</p>
        </div>
        <div className="bg-surface-card p-6 rounded-2xl border border-border">
          <p className="text-[13px] font-medium text-text-secondary mb-2">Total Sessions</p>
          <p className="text-3xl font-semibold text-text-primary font-mono tabular-nums mb-1">{analytics?.totalSessions ?? '-'}</p>
        </div>
        <div className="bg-surface-card p-6 rounded-2xl border border-border">
          <p className="text-[13px] font-medium text-text-secondary mb-2">Credits Used (30d)</p>
          <p className="text-3xl font-semibold text-text-primary font-mono tabular-nums mb-1">{analytics?.totalCreditsUsed ?? '-'}</p>
        </div>
      </div>

      <div className="bg-surface-card p-6 rounded-2xl border border-border">
        <h3 className="text-[15px] font-semibold text-text-primary mb-4">Monthly Usage</h3>
        <div className="h-64 flex items-center justify-center text-sm font-medium text-text-muted border border-dashed border-border rounded-xl">
          Chart will be displayed here
        </div>
      </div>
    </div>
  )
}

export default AnalyticsPage
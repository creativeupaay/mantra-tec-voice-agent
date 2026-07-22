import { FC, useEffect, useState } from 'react'
import { AudioWaveform, Users, Clock, CheckCircle, AlertTriangle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { analyticsApi, sessionApi, agentApi } from '../api/client'

// Helper to generate a simple SVG sparkline from data points
const Sparkline = ({ data }: { data: number[] }) => {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * 70
      const y = 18 - ((val - min) / range) * 18
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg width="70" height="18" className="overflow-visible">
      <polyline
        fill="none"
        stroke="var(--color-text-muted)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  )
}

const HomePage: FC = () => {
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'super_admin'

  // State for dashboard data
  const [stats, setStats] = useState<{
    totalUsers: number
    totalSessions: number
    totalCalls: number
    totalCreditsUsed: number
    activeAgents: number
    avgResponseTime: number
    successRate: number
  }>({
    totalUsers: 0,
    totalSessions: 0,
    totalCalls: 0,
    totalCreditsUsed: 0,
    activeAgents: 0,
    avgResponseTime: 0,
    successRate: 0,
  })

  const [trendData, setTrendData] = useState<{
    users: number[]
    sessions: number[]
    calls: number[]
    redFlags: number[]
  }>({
    users: [0, 0, 0, 0, 0, 0, 0],
    sessions: [0, 0, 0, 0, 0, 0, 0],
    calls: [0, 0, 0, 0, 0, 0, 0],
    redFlags: [0, 0, 0, 0, 0, 0, 0],
  })

  const [callAnalytics, setCallAnalytics] = useState<{
    kpis: {
      totalCalls: number
      resolvedCount: number
      escalatedCount: number
      missedCount: number
      liveCount: number
      redFlagCount: number
      avgDurationSeconds: number
    } | null
    callVolume: { date: string; count: number }[]
    statusBreakdown: { name: string; value: number }[]
    intentBreakdown: { intent: string; count: number }[]
    recentRedFlags: any[]
  }>({
    kpis: null,
    callVolume: [],
    statusBreakdown: [],
    intentBreakdown: [],
    recentRedFlags: [],
  })

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch all analytics in parallel
        const [
          platformAnalyticsRes,
          callAnalyticsRes,
          agentsRes,
          sessionsRes,
        ] = await Promise.all([
          // Platform analytics (super_admin only)
          isSuperAdmin ? analyticsApi.getDashboard() : Promise.resolve({ data: { data: null, success: false } }),
          // Call analytics (admin + super_admin)
          analyticsApi.getCallAnalytics(),
          // Agents list
          agentApi.getAll(),
          // Sessions list
          sessionApi.getAll(),
        ])

        // Process platform analytics
        if (isSuperAdmin && platformAnalyticsRes.data.success && platformAnalyticsRes.data.data) {
          const pa = platformAnalyticsRes.data.data

          // Build 7-day trends from monthlyStats
          const dailyStats = pa.monthlyStats || []
          const last7Days = dailyStats.slice(-7)

          // Calculate sessions trend from sessionsRes
          const sessionsList = sessionsRes.data.data || []
          const sessionsTrend = Array(7).fill(0)
          const now = new Date()
          for (let i = 0; i < 7; i++) {
            const d = new Date()
            d.setDate(now.getDate() - (6 - i))
            const dateStr = d.toDateString()
            sessionsTrend[i] = sessionsList.filter((s: any) => {
              const sDate = s.startTime || s.createdAt
              return sDate ? new Date(sDate).toDateString() === dateStr : false
            }).length
          }

          const callsTrend = callAnalyticsRes.data.data?.callVolume?.slice(-7).map((d: any) => d.count) || Array(7).fill(0)

          setStats({
            totalUsers: pa.totalUsers || 0,
            totalSessions: pa.totalSessions,
            totalCalls: callAnalyticsRes.data.data?.kpis?.totalCalls || 0,
            totalCreditsUsed: pa.totalCreditsUsed,
            activeAgents: pa.totalAgents, // approximation
            avgResponseTime: 0, // will be updated from call analytics
            successRate: 0, // will be updated from call analytics
          })

          setTrendData({
            users: last7Days.map(d => d.totalUsed || 0),
            sessions: sessionsTrend,
            calls: callsTrend,
            redFlags: Array(7).fill(callAnalyticsRes.data.data?.kpis?.redFlagCount || 0),
          })
        } else {
          // For regular admins, use call analytics + basic counts
          const sessionsList = sessionsRes.data.data || []
          const sessionsTrend = Array(7).fill(0)
          const now = new Date()
          for (let i = 0; i < 7; i++) {
            const d = new Date()
            d.setDate(now.getDate() - (6 - i))
            const dateStr = d.toDateString()
            sessionsTrend[i] = sessionsList.filter((s: any) => {
              const sDate = s.startTime || s.createdAt
              return sDate ? new Date(sDate).toDateString() === dateStr : false
            }).length
          }

          const callsTrend = callAnalyticsRes.data.data?.callVolume?.slice(-7).map((d: any) => d.count) || Array(7).fill(0)

          setStats({
            totalUsers: 0,
            totalSessions: sessionsList.length,
            totalCalls: callAnalyticsRes.data.data?.kpis?.totalCalls || 0,
            totalCreditsUsed: 0,
            activeAgents: agentsRes.data.data?.filter((a: any) => a.isActive).length || 0,
            avgResponseTime: 0,
            successRate: 0,
          })

          // Simple mock trend for non-super-admin
          setTrendData({
            users: Array(7).fill(0),
            sessions: sessionsTrend,
            calls: callsTrend,
            redFlags: Array(7).fill(callAnalyticsRes.data.data?.kpis?.redFlagCount || 0),
          })
        }

        // Process call analytics
        if (callAnalyticsRes.data.success) {
          const ca = callAnalyticsRes.data.data
          setCallAnalytics(ca)

          // Calculate derived metrics
          const kpis = ca.kpis
          if (kpis) {
            const totalCompleted = kpis.resolvedCount + kpis.escalatedCount
            const successRate = kpis.totalCalls > 0
              ? ((kpis.resolvedCount / kpis.totalCalls) * 100).toFixed(1)
              : 0
            const avgDuration = kpis.avgDurationSeconds > 0
              ? (kpis.avgDurationSeconds / 60).toFixed(1)
              : 0

            setStats(prev => ({
              ...prev,
              avgResponseTime: parseFloat(avgDuration || "0"),
              successRate: parseFloat(successRate || "0"),
            }))
          }
        }

      } catch (err: any) {
        console.error('Dashboard fetch error:', err)
        setError(err.response?.data?.message || 'Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [isSuperAdmin])

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-text-primary">Dashboard</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-surface-card rounded-2xl border border-border p-6 animate-pulse">
              <div className="h-4 bg-surface-page rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-surface-page rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-surface-card rounded-2xl border border-border p-8 text-center">
        <AlertTriangle className="w-12 h-12 text-text-muted mx-auto mb-4" />
        <p className="text-text-secondary">{error}</p>
      </div>
    )
  }

  const kpis = callAnalytics.kpis

  const statCards = isSuperAdmin
    ? [
      {
        label: 'Total Users',
        value: stats.totalUsers.toLocaleString(),
        trendData: trendData.users,
        icon: Users,
      },
      {
        label: 'Total Sessions',
        value: stats.totalSessions.toLocaleString(),
        trendData: trendData.sessions,
        icon: Clock,
      },
      {
        label: 'Total Calls',
        value: kpis?.totalCalls?.toLocaleString() || stats.totalCalls.toLocaleString(),
        trendData: trendData.calls,
        icon: AudioWaveform,
        isLive: (kpis?.liveCount || 0) > 0,
      },
      {
        label: 'Total Red Flags',
        value: kpis?.redFlagCount || 0,
        trendData: trendData.redFlags,
        icon: AlertTriangle,
      },
    ]
    : [
      {
        label: 'Total Sessions',
        value: stats.totalSessions.toLocaleString(),
        trendData: trendData.sessions,
        icon: Clock,
      },
      {
        label: 'Total Calls',
        value: kpis?.totalCalls?.toLocaleString() || stats.totalCalls.toLocaleString(),
        trendData: trendData.calls,
        icon: AudioWaveform,
        isLive: (kpis?.liveCount || 0) > 0,
      },
      {
        label: 'Total Red Flags',
        value: kpis?.redFlagCount || 0,
        trendData: trendData.redFlags,
        icon: AlertTriangle,
      },
    ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-text-primary">Dashboard</h2>
        {isSuperAdmin && (
          <span className="px-2 py-1 text-[11px] font-medium bg-accent/10 text-accent rounded-full">
            Super Admin
          </span>
        )}
      </div>

      {/* Stats Grid */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${isSuperAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-6`}>
        {statCards.map((stat) => (
          <div key={stat.label} className="bg-surface-card rounded-2xl border border-border p-6 flex flex-col justify-between min-h-35">
            <div>
              <div className="flex items-center space-x-2 mb-2">
                {stat.isLive && (
                  <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" style={{ backgroundColor: 'var(--color-accent)' }} />
                )}
                <stat.icon className="w-4 h-4 text-text-muted" strokeWidth={2} />
                <p className="text-[13px] font-medium text-text-secondary">{stat.label}</p>
              </div>
              <p className="text-3xl font-semibold text-text-primary font-mono tabular-nums mb-2">{stat.value}</p>
            </div>
            <div className="pt-2">
              <Sparkline data={stat.trendData} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Call Analytics - Main Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* KPIs Row */}
          {kpis && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-surface-card rounded-xl border border-border p-4 flex flex-col justify-between min-h-22.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-status-resolved)' }} />
                  <p className="text-[12px] font-medium text-text-secondary">Resolved</p>
                </div>
                <p className="text-2xl font-semibold text-text-primary font-mono tabular-nums mt-1">{kpis.resolvedCount}</p>
              </div>
              <div className="bg-surface-card rounded-xl border border-border p-4 flex flex-col justify-between min-h-22.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-status-escalated)' }} />
                  <p className="text-[12px] font-medium text-text-secondary">Escalated</p>
                </div>
                <p className="text-2xl font-semibold text-text-primary font-mono tabular-nums mt-1">{kpis.escalatedCount}</p>
              </div>
              <div className="bg-surface-card rounded-xl border border-border p-4 flex flex-col justify-between min-h-22.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-status-missed)' }} />
                  <p className="text-[12px] font-medium text-text-secondary">Missed</p>
                </div>
                <p className="text-2xl font-semibold text-text-primary font-mono tabular-nums mt-1">{kpis.missedCount}</p>
              </div>
              <div className="bg-surface-card rounded-xl border border-border p-4 flex flex-col justify-between min-h-22.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--color-status-live)' }} />
                  <p className="text-[12px] font-medium text-text-secondary">Live Calls</p>
                </div>
                <p className="text-2xl font-semibold text-text-primary font-mono tabular-nums mt-1">{kpis.liveCount}</p>
              </div>
            </div>
          )}

          {/* Call Volume Chart */}
          <div className="bg-surface-card rounded-2xl border border-border p-6">
            <h3 className="text-[15px] font-semibold text-text-primary mb-4">Call Volume (Last 30 Days)</h3>
            <div className="h-64">
              <CallVolumeChart data={callAnalytics.callVolume} />
            </div>
          </div>

          {/* Recent Red Flags */}
          {callAnalytics.recentRedFlags.length > 0 && (
            <div className="bg-surface-card rounded-2xl border border-border p-6">
              <h3 className="text-[15px] font-semibold text-text-primary mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Recent Red Flagged Calls
              </h3>
              <div className="space-y-0">
                {callAnalytics.recentRedFlags.map((call: any) => (
                  <div key={call._id} className="flex items-start justify-between gap-4 py-4 border-b border-border last:border-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-text-primary truncate">
                          {call.caller_name || call.phone_number}
                        </p>
                        {call.detected_intent && (
                          <span className="shrink-0 px-2 py-0.5 text-[11px] rounded-full bg-surface-page border border-border text-text-secondary capitalize">
                            {call.detected_intent}
                          </span>
                        )}
                      </div>
                      {call.call_summary && (
                        <p className="text-[12px] text-text-secondary line-clamp-2">{call.call_summary}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[11px] text-text-muted tabular-nums">
                        {new Date(call.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                      <span
                        className="text-[11px] font-medium capitalize"
                        style={{ color: STATUS_COLORS[call.status] || 'var(--color-text-muted)' }}
                      >
                        {call.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar - Charts and Performance stacked vertically */}
        <div className="space-y-6">
          {/* Performance Overview */}
          <div className="bg-surface-card rounded-2xl border border-border p-6">
            <h3 className="text-[15px] font-semibold text-text-primary mb-4">Performance Overview</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-text-muted" strokeWidth={2} />
                  <span className="text-[13px] font-medium text-text-secondary">Avg Call Duration</span>
                </div>
                <span className="text-[14px] font-semibold text-text-primary font-mono tabular-nums">{stats.avgResponseTime} min</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-text-muted" strokeWidth={2} />
                  <span className="text-[13px] font-medium text-text-secondary">Resolution Rate</span>
                </div>
                <span className="text-[14px] font-semibold text-text-primary font-mono tabular-nums">{stats.successRate}%</span>
              </div>
            </div>
          </div>

          <div className="bg-surface-card rounded-2xl border border-border p-6">
            <h3 className="text-[15px] font-semibold text-text-primary mb-4">Call Status</h3>
            <div className="h-48">
              <DonutChart data={callAnalytics.statusBreakdown} />
            </div>
          </div>
          <div className="bg-surface-card rounded-2xl border border-border p-6">
            <h3 className="text-[15px] font-semibold text-text-primary mb-4">Top Intents</h3>
            <div className="h-48">
              <BarChart data={callAnalytics.intentBreakdown} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Simple SVG-based Call Volume Chart
const CallVolumeChart = ({ data }: { data: { date: string; count: number }[] }) => {
  if (!data.length) return <div className="h-full flex items-center justify-center text-text-muted text-sm">No data</div>

  const maxCount = Math.max(...data.map(d => d.count), 1)

  return (
    <svg width="100%" height="100%" className="overflow-visible" viewBox={`0 0 ${data.length * 20} 200`}>
      {data.map((d, i) => {
        const h = (d.count / maxCount) * 160
        const x = i * 20 + 4
        return (
          <g key={d.date}>
            <rect
              x={x}
              y={180 - h}
              width={12}
              height={h}
              rx={2}
              fill="var(--color-accent)"
              opacity={0.8}
            />
            <text
              x={x + 6}
              y={195}
              textAnchor="middle"
              fontSize="8"
              fill="var(--color-text-muted)"
              fontFamily="system-ui"
            >
              {d.date.split(' ')[0]}
            </text>
            {d.count > 0 && (
              <text
                x={x + 6}
                y={176 - h}
                textAnchor="middle"
                fontSize="9"
                fontWeight="600"
                fill="var(--color-text-primary)"
                fontFamily="system-ui"
              >
                {d.count}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// Simple Donut Chart
const DonutChart = ({ data }: { data: { name: string; value: number }[] }) => {
  if (!data.length) return <div className="h-full flex items-center justify-center text-text-muted text-sm">No data</div>

  const total = data.reduce((sum, d) => sum + d.value, 0)
  const radius = 60
  const strokeWidth = 16
  const circumference = 2 * Math.PI * radius

  const colors = {
    resolved: '#22c55e',
    escalated: '#f59e0b',
    missed: '#ef4444',
    live: '#3b82f6',
    default: '#6b7280',
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <svg width="160" height="160" viewBox="0 0 160 160">
        <circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={strokeWidth}
        />
        {data.map((d, i) => {
          const percentage = total > 0 ? d.value / total : 0
          const dashOffset = circumference * (1 - percentage)
          const color = colors[d.name as keyof typeof colors] || colors.default

          return (
            <circle
              key={d.name}
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              transform={`rotate(-90 80 80)`}
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          )
        })}
      </svg>
      <div className="flex flex-wrap justify-center gap-3 text-center">
        {data.map((d) => {
          const color = colors[d.name as keyof typeof colors] || colors.default
          const percentage = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0'
          return (
            <div key={d.name} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[12px] text-text-secondary capitalize">{d.name}</span>
              <span className="text-[12px] font-medium text-text-primary">{percentage}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Simple Bar Chart
const BarChart = ({ data }: { data: { intent: string; count: number }[] }) => {
  if (!data.length) return <div className="h-full flex items-center justify-center text-text-muted text-sm">No data</div>

  const maxCount = Math.max(...data.map(d => d.count), 1)
  const topData = data.slice(0, 6)

  return (
    <div className="h-full flex items-end justify-around p-2">
      {topData.map((d, i) => {
        const h = (d.count / maxCount) * 140
        return (
          <div key={d.intent} className="flex flex-col items-center gap-1 w-16">
            <div className="w-full">
              <div
                className="rounded-t bg-accent"
                style={{ height: `${h}px`, minHeight: d.count > 0 ? '8px' : '0' }}
              />
            </div>
            <text className="text-[10px] text-text-secondary text-center truncate w-16" style={{ fontFamily: 'system-ui' }}>
              {d.intent.length > 10 ? d.intent.slice(0, 10) + '…' : d.intent}
            </text>
            <text className="text-[10px] font-medium text-text-primary tabular-nums" style={{ fontFamily: 'system-ui' }}>
              {d.count}
            </text>
          </div>
        )
      })}
    </div>
  )
}

const QuickStatRow = ({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) => (
  <div className="flex items-center gap-3">
    <div className="w-10 h-10 rounded-lg bg-surface-page border border-border flex items-center justify-center">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[12px] text-text-secondary">{label}</p>
      <p className="text-[14px] font-semibold text-text-primary font-mono tabular-nums">{value}</p>
    </div>
  </div>
)

const STATUS_COLORS: Record<string, string> = {
  resolved: '#22c55e',
  escalated: '#f59e0b',
  missed: '#ef4444',
  live: '#3b82f6',
  pending: '#6b7280',
}

export default HomePage
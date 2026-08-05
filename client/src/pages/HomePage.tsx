import { FC, useEffect, useState, useMemo } from 'react'
import {
  AudioWaveform,
  Users,
  Clock,
  CheckCircle,
  AlertTriangle,
  PhoneCall,
  PhoneOff,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { analyticsApi, callApi } from '../api/client'
import { ICall } from '../types/call'

// Helper for generating SVG sparklines
const Sparkline = ({ data }: { data: number[] }) => {
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
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

  // Calls list for metrics derivation
  const [callsList, setCallsList] = useState<ICall[]>([])
  
  // Platform metrics for super admin
  const [platformStats, setPlatformStats] = useState<{
    totalUsers: number
    totalSessions: number
    totalCreditsUsed: number
    monthlyStats: any[]
  }>({
    totalUsers: 0,
    totalSessions: 0,
    totalCreditsUsed: 0,
    monthlyStats: [],
  })

  // Call volume and breakdown for charts
  const [callVolume, setCallVolume] = useState<{ date: string; count: number }[]>([])
  const [intentBreakdown, setIntentBreakdown] = useState<{ intent: string; count: number }[]>([])
  const [avgDurationSeconds, setAvgDurationSeconds] = useState<number>(0)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── Unified Data Fetching ───────────────────────────────────────────
  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [
        platformRes,
        analyticsRes,
        allCallsRes,
      ] = await Promise.all([
        isSuperAdmin
          ? analyticsApi.getDashboard().catch(() => ({ data: { data: null, success: false } }))
          : Promise.resolve({ data: { data: null, success: false } }),
        analyticsApi.getCallAnalytics().catch(() => ({ data: { data: null, success: false } })),
        callApi.getAll().catch(() => ({ data: { data: [], success: true } })),
      ])

      // 1. Process all calls list
      if (allCallsRes?.data?.success && Array.isArray(allCallsRes.data.data)) {
        setCallsList(allCallsRes.data.data)
      }

      // 2. Process Platform Analytics
      if (isSuperAdmin && platformRes?.data?.success && platformRes.data.data) {
        const pa = platformRes.data.data
        setPlatformStats({
          totalUsers: pa.totalUsers || 0,
          totalSessions: pa.totalSessions || 0,
          totalCreditsUsed: pa.totalCreditsUsed || 0,
          monthlyStats: pa.monthlyStats || [],
        })
      }

      // 3. Process Call Analytics for charts
      if (analyticsRes?.data?.success && analyticsRes.data.data) {
        const ca = analyticsRes.data.data
        setCallVolume(ca.callVolume || [])
        setIntentBreakdown(ca.intentBreakdown || [])
        if (ca.kpis?.avgDurationSeconds) {
          setAvgDurationSeconds(ca.kpis.avgDurationSeconds)
        }
      }

    } catch (err: any) {
      console.error('Dashboard fetch error:', err)
      setError(err.response?.data?.message || 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()

    // Listen for call status updates to automatically refresh metrics
    const handleStatusUpdate = () => {
      fetchDashboardData()
    }
    window.addEventListener('call-status-updated', handleStatusUpdate)
    return () => window.removeEventListener('call-status-updated', handleStatusUpdate)
  }, [isSuperAdmin])

  // ── DERIVED METRICS ──────────────────────────────────────────────────
  const escalatedCount = useMemo(() => callsList.filter(c => c.status === 'escalated').length, [callsList])
  const resolvedCount = useMemo(() => callsList.filter(c => c.status === 'resolved').length, [callsList])
  const missedCount = useMemo(() => callsList.filter(c => c.status === 'missed').length, [callsList])
  const liveCount = useMemo(() => callsList.filter(c => c.status === 'live' || !c.status).length, [callsList])
  const redFlagCount = useMemo(() => callsList.filter(c => Boolean(c.is_red_flag || c.is_red_flagged)).length, [callsList])
  const totalCallsCount = callsList.length
  const totalSessionsCount = isSuperAdmin ? platformStats.totalSessions : totalCallsCount

  const resolutionRate = useMemo(() => {
    if (totalCallsCount === 0) return 0
    return parseFloat(((resolvedCount / totalCallsCount) * 100).toFixed(1))
  }, [resolvedCount, totalCallsCount])

  const avgDurationMinutes = useMemo(() => {
    if (!avgDurationSeconds) return '0.0'
    return (avgDurationSeconds / 60).toFixed(1)
  }, [avgDurationSeconds])

  // Status breakdown for donut chart derived strictly from state
  const statusBreakdownData = useMemo(() => [
    { name: 'resolved', value: resolvedCount },
    { name: 'escalated', value: escalatedCount },
    { name: 'missed', value: missedCount },
    { name: 'live', value: liveCount },
  ], [resolvedCount, escalatedCount, missedCount, liveCount])

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-text-primary">Dashboard</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
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

  // Original Dashboard Metrics:
  // - Total Users (if SuperAdmin)
  // - Total Sessions
  // - Total Calls
  // - Total Red Flags
  // - Resolved Calls
  // - Missed Calls
  // - Live Calls
  const kpiCards = [
    ...(isSuperAdmin ? [{
      label: 'Total Users',
      value: platformStats.totalUsers.toLocaleString(),
      trendData: [0, 1, 2, 2, 3, 3, platformStats.totalUsers],
      icon: Users,
    }] : []),
    {
      label: 'Total Sessions',
      value: totalSessionsCount.toLocaleString(),
      trendData: [2, 4, 3, 6, 5, 8, totalSessionsCount],
      icon: Clock,
    },
    {
      label: 'Total Calls',
      value: totalCallsCount.toLocaleString(),
      trendData: [5, 8, 12, 14, 18, 22, totalCallsCount],
      icon: AudioWaveform,
      isLive: liveCount > 0,
    },
    {
      label: 'Total Red Flags',
      value: redFlagCount,
      trendData: [0, 0, 1, 0, 0, 0, redFlagCount],
      icon: AlertTriangle,
    },
    {
      label: 'Resolved Calls',
      value: resolvedCount,
      trendData: [1, 3, 5, 8, 10, 12, resolvedCount],
      icon: CheckCircle,
    },
    {
      label: 'Missed Calls',
      value: missedCount,
      trendData: [0, 1, 0, 2, 1, 0, missedCount],
      icon: PhoneOff,
    },
    {
      label: 'Live Calls',
      value: liveCount,
      trendData: [1, 2, 1, 3, 2, 4, liveCount],
      icon: PhoneCall,
      isLive: liveCount > 0,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-text-primary">Dashboard Overview</h2>
          <p className="text-xs text-text-secondary mt-1">Real-time voice agent metrics & performance analytics</p>
        </div>
        {isSuperAdmin && (
          <span className="px-3 py-1 text-xs font-semibold bg-accent/10 text-accent rounded-full border border-accent/20">
            Super Admin
          </span>
        )}
      </div>

      {/* ORIGINAL KPI CARDS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {kpiCards.map((stat) => (
          <div
            key={stat.label}
            className="bg-surface-card rounded-2xl border border-border p-5 flex flex-col justify-between hover:border-border-strong transition-all shadow-2xs"
          >
            <div>
              <div className="flex items-center space-x-2 mb-2">
                {stat.isLive && (
                  <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                )}
                <stat.icon className="w-4 h-4 text-text-muted" strokeWidth={2} />
                <p className="text-[13px] font-medium text-text-secondary">{stat.label}</p>
              </div>
              <p className="text-2xl font-semibold text-text-primary font-mono tabular-nums mb-2">
                {stat.value}
              </p>
            </div>
            <div className="pt-2">
              <Sparkline data={stat.trendData} />
            </div>
          </div>
        ))}
      </div>

      {/* CHARTS AND PERFORMANCE SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Call Volume Chart (Col-span-2) */}
        <div className="lg:col-span-2 bg-surface-card rounded-2xl border border-border p-6 shadow-2xs">
          <h3 className="text-base font-semibold text-text-primary mb-4">Call Volume (Last 30 Days)</h3>
          <div className="h-64">
            <CallVolumeChart data={callVolume} />
          </div>
        </div>

        {/* Sidebar Analytics (Col-span-1) */}
        <div className="space-y-6">
          {/* Performance Overview */}
          <div className="bg-surface-card rounded-2xl border border-border p-6 shadow-2xs">
            <h3 className="text-base font-semibold text-text-primary mb-4">Performance Overview</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-text-muted" strokeWidth={2} />
                  <span className="text-xs font-medium text-text-secondary">Avg Call Duration</span>
                </div>
                <span className="text-sm font-semibold text-text-primary font-mono tabular-nums">
                  {avgDurationMinutes} min
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-text-muted" strokeWidth={2} />
                  <span className="text-xs font-medium text-text-secondary">Resolution Rate</span>
                </div>
                <span className="text-sm font-semibold text-text-primary font-mono tabular-nums">
                  {resolutionRate}%
                </span>
              </div>
            </div>
          </div>

          {/* Donut Chart: Call Status */}
          <div className="bg-surface-card rounded-2xl border border-border p-6 shadow-2xs">
            <h3 className="text-base font-semibold text-text-primary mb-4">Call Status Breakdown</h3>
            <div className="h-48">
              <DonutChart data={statusBreakdownData} />
            </div>
          </div>

          {/* Bar Chart: Top Intents */}
          <div className="bg-surface-card rounded-2xl border border-border p-6 shadow-2xs">
            <h3 className="text-base font-semibold text-text-primary mb-4">Top Customer Intents</h3>
            <div className="h-48">
              <BarChart data={intentBreakdown} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Simple SVG-based Call Volume Chart
const CallVolumeChart = ({ data }: { data: { date: string; count: number }[] }) => {
  if (!data.length) return <div className="h-full flex items-center justify-center text-text-muted text-xs">No data</div>

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
  if (!data.length) return <div className="h-full flex items-center justify-center text-text-muted text-xs">No data</div>

  const total = data.reduce((sum, d) => sum + d.value, 0)
  const radius = 60
  const strokeWidth = 16
  const circumference = 2 * Math.PI * radius

  const colors = {
    resolved: '#5B8C5A',
    escalated: '#C1554A',
    missed: '#C98A3B',
    live: '#2451DA',
    default: '#71717A',
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
        {data.map((d) => {
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
  if (!data.length) return <div className="h-full flex items-center justify-center text-text-muted text-xs">No data</div>

  const maxCount = Math.max(...data.map(d => d.count), 1)
  const topData = data.slice(0, 6)

  return (
    <div className="h-full flex items-end justify-around p-2">
      {topData.map((d) => {
        const h = (d.count / maxCount) * 140
        return (
          <div key={d.intent} className="flex flex-col items-center gap-1 w-16">
            <div className="w-full">
              <div
                className="rounded-t bg-accent opacity-80"
                style={{ height: `${h}px`, minHeight: d.count > 0 ? '8px' : '0' }}
              />
            </div>
            <span className="text-[10px] text-text-secondary text-center truncate w-16" style={{ fontFamily: 'system-ui' }}>
              {d.intent.length > 10 ? d.intent.slice(0, 10) + '…' : d.intent}
            </span>
            <span className="text-[10px] font-medium text-text-primary tabular-nums" style={{ fontFamily: 'system-ui' }}>
              {d.count}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default HomePage
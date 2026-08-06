import { FC, useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AudioWaveform,
  Users,
  Clock,
  CheckCircle,
  AlertTriangle,
  PhoneCall,
  PhoneOff,
  AlertOctagon,
  ChevronDown,
} from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  BarChart as RechartsBarChart,
  Bar as RechartsBar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts'
import { useAuth } from '../hooks/useAuth'
import { analyticsApi, callApi } from '../api/client'
import { ICall } from '../types/call'
import { parseToDate } from '../utils/format'

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
  const navigate = useNavigate()
  const isSuperAdmin = user?.role === 'super_admin'

  // Calls list for metrics derivation
  const [callsList, setCallsList] = useState<ICall[]>([])
  const [selectedMonthRange, setSelectedMonthRange] = useState<string>('current')
  
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
  const [avgDurationSecondsState, setAvgDurationSecondsState] = useState<number>(0)

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
        callApi.getAll({ limit: 1000 }).catch(() => ({ success: true, data: [] as any[] })),
      ])

      // 1. Process all calls list
      if (allCallsRes?.success && Array.isArray(allCallsRes.data)) {
        setCallsList(allCallsRes.data)
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
          setAvgDurationSecondsState(ca.kpis.avgDurationSeconds)
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

  // ── DYNAMIC MONTH OPTIONS (Month names: August 2026, July 2026, etc.) ───
  const monthOptions = useMemo(() => {
    const options = []
    const now = new Date()

    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      const value = i === 0 ? 'current' : i === 1 ? 'previous' : `month-${d.getFullYear()}-${d.getMonth()}`
      options.push({ value, label, year: d.getFullYear(), month: d.getMonth() })
    }

    return [
      ...options,
      { value: '3months', label: 'Last 3 Months' },
      { value: '6months', label: 'Last 6 Months' },
      { value: '12months', label: 'Last 12 Months' },
    ]
  }, [])

  const selectedMonthLabel = useMemo(() => {
    const found = monthOptions.find(o => o.value === selectedMonthRange)
    return found ? found.label : 'Current Month'
  }, [monthOptions, selectedMonthRange])

  // ── FILTERED CALLS BY SELECTED MONTH RANGE ─────────────────────────
  const filteredCalls = useMemo(() => {
    if (!callsList || callsList.length === 0) return []
    const now = new Date()

    return callsList.filter(c => {
      const timestamp = c.timestamp || c.createdAt
      if (!timestamp) return true
      const callDate = parseToDate(timestamp)
      if (!callDate || isNaN(callDate.getTime())) return true

      if (selectedMonthRange === 'current') {
        return callDate.getFullYear() === now.getFullYear() && callDate.getMonth() === now.getMonth()
      } else if (selectedMonthRange === 'previous') {
        const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        return callDate.getFullYear() === prevMonthDate.getFullYear() && callDate.getMonth() === prevMonthDate.getMonth()
      } else if (selectedMonthRange.startsWith('month-')) {
        const parts = selectedMonthRange.split('-')
        const targetYear = parseInt(parts[1], 10)
        const targetMonth = parseInt(parts[2], 10)
        return callDate.getFullYear() === targetYear && callDate.getMonth() === targetMonth
      } else if (selectedMonthRange === '3months') {
        const startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1)
        return callDate >= startDate
      } else if (selectedMonthRange === '6months') {
        const startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1)
        return callDate >= startDate
      } else if (selectedMonthRange === '12months') {
        const startDate = new Date(now.getFullYear() - 1, now.getMonth() + 1, 1)
        return callDate >= startDate
      }
      return true
    })
  }, [callsList, selectedMonthRange])

  // ── DERIVED METRICS ──────────────────────────────────────────────────
  const escalatedCount = useMemo(() => filteredCalls.filter(c => c.status === 'escalated').length, [filteredCalls])
  const resolvedCount = useMemo(() => filteredCalls.filter(c => c.status === 'resolved').length, [filteredCalls])
  const missedCount = useMemo(() => filteredCalls.filter(c => c.status === 'missed').length, [filteredCalls])
  const liveCount = useMemo(() => filteredCalls.filter(c => c.status === 'live' || !c.status).length, [filteredCalls])
  const redFlagCount = useMemo(() => filteredCalls.filter(c => Boolean(c.is_red_flag || c.is_red_flagged)).length, [filteredCalls])
  const totalCallsCount = filteredCalls.length

  // Check if viewing a multi-month range (3 months, 6 months, 12 months)
  const isMultiMonth = useMemo(() => {
    return ['3months', '6months', '12months'].includes(selectedMonthRange)
  }, [selectedMonthRange])

  // Minutes Used metric (Monthly limit = 4000 mins)
  const totalDurationSeconds = useMemo(() => filteredCalls.reduce((sum, c) => sum + (c.duration || 0), 0), [filteredCalls])
  const minutesAllocated = 4000
  const minutesUsed = useMemo(() => Math.round(totalDurationSeconds / 60), [totalDurationSeconds])
  const minutesRemaining = useMemo(() => Math.max(0, minutesAllocated - minutesUsed), [minutesUsed])
  const usagePercent = useMemo(() => Math.min(100, parseFloat(((minutesUsed / minutesAllocated) * 100).toFixed(1))), [minutesUsed])

  const resolutionRate = useMemo(() => {
    if (totalCallsCount === 0) return 0
    return parseFloat(((resolvedCount / totalCallsCount) * 100).toFixed(1))
  }, [resolvedCount, totalCallsCount])

  const avgDurationSeconds = useMemo(() => {
    if (totalCallsCount === 0) return avgDurationSecondsState || 0
    return Math.round(totalDurationSeconds / totalCallsCount)
  }, [totalCallsCount, totalDurationSeconds, avgDurationSecondsState])

  const avgDurationMinutes = useMemo(() => {
    if (!avgDurationSeconds) return '0.0'
    return (avgDurationSeconds / 60).toFixed(1)
  }, [avgDurationSeconds])

  // Status breakdown for donut chart derived strictly from filtered state
  const statusBreakdownData = useMemo(() => [
    { name: 'resolved', value: resolvedCount },
    { name: 'escalated', value: escalatedCount },
    { name: 'missed', value: missedCount },
    { name: 'live', value: liveCount },
  ], [resolvedCount, escalatedCount, missedCount, liveCount])

  // Dynamic Call Volume per day of month
  const callVolumeData = useMemo(() => {
    const now = new Date()
    let targetYear = now.getFullYear()
    let targetMonth = now.getMonth()

    if (selectedMonthRange === 'previous') {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      targetYear = prev.getFullYear()
      targetMonth = prev.getMonth()
    } else if (selectedMonthRange.startsWith('month-')) {
      const parts = selectedMonthRange.split('-')
      targetYear = parseInt(parts[1], 10)
      targetMonth = parseInt(parts[2], 10)
    }

    if (['current', 'previous'].includes(selectedMonthRange) || selectedMonthRange.startsWith('month-')) {
      const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate()
      const monthName = new Date(targetYear, targetMonth, 1).toLocaleDateString('en-US', { month: 'short' })

      const volumeMap: Record<number, number> = {}
      filteredCalls.forEach(c => {
        const timestamp = c.timestamp || c.createdAt
        if (!timestamp) return
        const d = new Date(timestamp)
        if (!isNaN(d.getTime()) && d.getFullYear() === targetYear && d.getMonth() === targetMonth) {
          const day = d.getDate()
          volumeMap[day] = (volumeMap[day] || 0) + 1
        }
      })

      const result = []
      for (let day = 1; day <= daysInMonth; day++) {
        result.push({
          date: `${monthName} ${day}`,
          dayNumber: String(day),
          count: volumeMap[day] || 0
        })
      }
      return result
    }

    const volumeMap: Record<string, number> = {}
    filteredCalls.forEach(c => {
      const timestamp = c.timestamp || c.createdAt
      if (!timestamp) return
      const d = new Date(timestamp)
      if (!isNaN(d.getTime())) {
        const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        volumeMap[label] = (volumeMap[label] || 0) + 1
      }
    })
    const entries = Object.entries(volumeMap).map(([date, count]) => ({ date, dayNumber: date.split(' ')[1] || date, count }))
    return entries.length > 0 ? entries : callVolume.map(v => ({ ...v, dayNumber: v.date.split(' ')[1] || v.date }))
  }, [filteredCalls, callVolume, selectedMonthRange])

  // Dynamic Intent Breakdown for selected range
  const intentBreakdownData = useMemo(() => {
    if (filteredCalls.length === 0) return intentBreakdown
    const intentMap: Record<string, number> = {}
    filteredCalls.forEach(c => {
      const raw = c.detected_intent || c.call_category || 'General Query'
      const formatted = raw.charAt(0).toUpperCase() + raw.slice(1).replace(/_/g, ' ')
      intentMap[formatted] = (intentMap[formatted] || 0) + 1
    })
    const entries = Object.entries(intentMap).map(([intent, count]) => ({ intent, count }))
    return entries.length > 0 ? entries : intentBreakdown
  }, [filteredCalls, intentBreakdown])

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
    {
      label: 'Escalated Calls',
      value: escalatedCount,
      trendData: [0, 1, 0, 1, 2, 1, escalatedCount],
      icon: AlertOctagon,
      isEscalated: true,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-text-primary">Dashboard Overview</h2>
          <p className="text-xs text-text-secondary mt-1">Real-time voice agent metrics & performance analytics</p>
        </div>
        <div className="flex items-center space-x-3">
          {/* Month Selector Dropdown */}
          <div className="relative shrink-0">
            <select
              value={selectedMonthRange}
              onChange={(e) => setSelectedMonthRange(e.target.value)}
              className="appearance-none pl-3.5 pr-8 py-2 bg-surface-card border border-border rounded-xl text-xs font-semibold text-text-primary focus:outline-none focus:border-border-strong cursor-pointer transition-colors"
            >
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-text-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {isSuperAdmin && (
            <span className="px-3 py-1 text-xs font-semibold bg-accent/10 text-accent rounded-full border border-accent/20">
              Super Admin
            </span>
          )}
        </div>
      </div>

      {/* KPI CARDS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {/* Total Users (Super Admin Only) */}
        {isSuperAdmin && (
          <div className="bg-surface-card border border-border hover:border-border-strong rounded-2xl p-5 flex flex-col justify-between transition-all shadow-2xs">
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <Users className="w-4 h-4 text-text-muted" strokeWidth={2} />
                <p className="text-[13px] font-medium text-text-secondary">Total Users</p>
              </div>
              <p className="text-2xl font-semibold font-mono tabular-nums mb-2 text-text-primary">
                {platformStats.totalUsers.toLocaleString()}
              </p>
            </div>
            <div className="pt-2">
              <Sparkline data={[0, 1, 2, 2, 3, 3, platformStats.totalUsers]} />
            </div>
          </div>
        )}

        {/* Minutes Used Card (Single month quota vs Multi-month total) */}
        <div className="bg-surface-card border border-border hover:border-border-strong rounded-2xl p-5 flex flex-col justify-between transition-all shadow-2xs">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-text-muted" strokeWidth={2} />
                <p className="text-[13px] font-medium text-text-secondary">Minutes Used</p>
              </div>
              {!isMultiMonth && (
                <span className="text-[11px] font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded-full border border-accent/20">
                  {usagePercent}%
                </span>
              )}
            </div>

            {isMultiMonth ? (
              <>
                <div className="flex items-baseline mb-1">
                  <p className="text-2xl font-semibold font-mono tabular-nums text-text-primary">
                    {minutesUsed.toLocaleString()} <span className="text-xs font-sans text-text-muted font-normal">mins used</span>
                  </p>
                </div>
                <div className="pt-2">
                  <Sparkline data={[5, 12, 18, 24, 32, 45, minutesUsed]} />
                </div>
              </>
            ) : (
              <>
                <div className="flex items-baseline mb-1">
                  <p className="text-2xl font-semibold font-mono tabular-nums text-text-primary">
                    {minutesUsed.toLocaleString()} <span className="text-xs font-sans text-text-muted font-normal">/ {minutesAllocated.toLocaleString()} mins</span>
                  </p>
                </div>
                <div className="w-full bg-surface-page rounded-full h-1.5 overflow-hidden my-2.5 border border-border/50">
                  <div
                    className="bg-accent h-full rounded-full transition-all duration-500"
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
                <p className="text-[11px] text-text-muted">
                  Remaining: <span className="font-semibold text-text-secondary">{minutesRemaining.toLocaleString()} mins</span>
                </p>
              </>
            )}
          </div>
        </div>

        {/* Other KPI Cards */}
        {kpiCards.map((stat) => {
          const isEscalated = (stat as any).isEscalated
          return (
            <div
              key={stat.label}
              onClick={isEscalated ? () => navigate('/calls?tab=escalated') : undefined}
              className={`rounded-2xl border p-5 flex flex-col justify-between transition-all shadow-2xs ${
                isEscalated
                  ? 'bg-red-500/5 border-red-500/30 hover:border-red-500/60 cursor-pointer hover:bg-red-500/10'
                  : 'bg-surface-card border-border hover:border-border-strong'
              }`}
            >
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  {stat.isLive && (
                    <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                  )}
                  {isEscalated && escalatedCount > 0 && (
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  )}
                  <stat.icon
                    className={`w-4 h-4 ${isEscalated ? 'text-red-500' : 'text-text-muted'}`}
                    strokeWidth={2}
                  />
                  <p className={`text-[13px] font-medium ${isEscalated ? 'text-red-400' : 'text-text-secondary'}`}>
                    {stat.label}
                  </p>
                </div>
                <p className={`text-2xl font-semibold font-mono tabular-nums mb-2 ${
                  isEscalated ? 'text-red-500' : 'text-text-primary'
                }`}>
                  {stat.value}
                </p>
                {isEscalated && escalatedCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-500 uppercase tracking-wider">
                    Action Required
                  </span>
                )}
              </div>
              <div className="pt-2">
                <Sparkline data={stat.trendData} />
              </div>
            </div>
          )
        })}
      </div>

      {/* CHARTS AND PERFORMANCE SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Call Volume Chart (Col-span-2) */}
        <div className="lg:col-span-2 bg-surface-card rounded-2xl border border-border p-6 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-text-primary">Call Volume</h3>
            <span className="text-xs font-semibold text-text-secondary bg-surface-page px-2.5 py-1 rounded-md border border-border">
              {selectedMonthLabel}
            </span>
          </div>
          <div className="h-64 w-full overflow-x-auto scrollbar-thin">
            <div className="h-full min-w-[480px]">
              <CallVolumeChart data={callVolumeData} />
            </div>
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
            <h3 className="text-base font-semibold text-text-primary mb-2">Call Status Breakdown</h3>
            <div className="h-56">
              <DonutChart data={statusBreakdownData} totalCalls={totalCallsCount} />
            </div>
          </div>

          {/* Bar Chart: Top Intents */}
          <div className="bg-surface-card rounded-2xl border border-border p-6 shadow-2xs">
            <h3 className="text-base font-semibold text-text-primary mb-4">Top Customer Intents</h3>
            <div className="h-48">
              <BarChart data={intentBreakdownData} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Simple SVG-based Call Volume Chart
const CallVolumeChart = ({ data }: { data: { date: string; dayNumber?: string; count: number }[] }) => {
  if (!data.length) return <div className="h-full flex items-center justify-center text-text-muted text-xs">No data</div>

  const maxCount = Math.max(...data.map(d => d.count), 1)

  return (
    <svg width="100%" height="100%" className="overflow-visible" viewBox={`0 0 ${data.length * 20} 200`}>
      {data.map((d, i) => {
        const h = (d.count / maxCount) * 160
        const x = i * 20 + 4
        const labelText = d.dayNumber || d.date.split(' ')[1] || d.date.split(' ')[0]
        return (
          <g key={d.date}>
            <title>{`${d.date}: ${d.count} calls`}</title>
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
              {labelText}
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

// Recharts Donut Chart for Call Status Breakdown
const STATUS_COLORS: Record<string, string> = {
  resolved: '#5B8C5A',
  escalated: '#C1554A',
  missed: '#C98A3B',
  live: '#2451DA',
}

const DonutChart = ({ data, totalCalls }: { data: { name: string; value: number }[]; totalCalls: number }) => {
  const activeData = data.filter(d => d.value > 0)

  if (totalCalls === 0 || activeData.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-text-muted text-xs">
        No call status data
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="w-full h-36">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={activeData}
              cx="50%"
              cy="50%"
              innerRadius={38}
              outerRadius={56}
              paddingAngle={activeData.length > 1 ? 4 : 0}
              dataKey="value"
              stroke="none"
            >
              {activeData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={STATUS_COLORS[entry.name] || '#71717A'}
                />
              ))}
            </Pie>
            <RechartsTooltip
              formatter={(val: any) => [val, 'calls']}
              contentStyle={{
                backgroundColor: 'var(--color-surface-card)',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                fontSize: '12px',
                color: 'var(--color-text-primary)',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend with percentages */}
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 mt-2 text-center">
        {data.map((d) => {
          const color = STATUS_COLORS[d.name] || '#71717A'
          const pct = totalCalls > 0 ? ((d.value / totalCalls) * 100).toFixed(1) : '0.0'
          return (
            <div key={d.name} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className="text-[11px] text-text-secondary capitalize">{d.name}</span>
              <span className="text-[11px] font-semibold text-text-primary tabular-nums">{d.value}</span>
              <span className="text-[10px] text-text-muted tabular-nums">({pct}%)</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Recharts Bar Chart for Top Customer Intents
const BarChart = ({ data }: { data: { intent: string; count: number }[] }) => {
  if (!data.length) return <div className="h-full flex items-center justify-center text-text-muted text-xs">No data</div>

  const topData = data.slice(0, 6)

  return (
    <div className="w-full h-full pt-1">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart data={topData} margin={{ top: 10, right: 10, left: -25, bottom: 20 }}>
          <XAxis
            dataKey="intent"
            tick={{ fontSize: 10, fill: 'var(--color-text-secondary)' }}
            interval={0}
            tickFormatter={(val) => (val.length > 8 ? val.slice(0, 8) + '…' : val)}
          />
          <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} allowDecimals={false} />
          <RechartsTooltip
            formatter={(val: any) => [val, 'calls']}
            contentStyle={{
              backgroundColor: 'var(--color-surface-card)',
              borderRadius: '8px',
              border: '1px solid var(--color-border)',
              fontSize: '12px',
              color: 'var(--color-text-primary)',
            }}
          />
          <RechartsBar dataKey="count" fill="var(--color-accent)" radius={[4, 4, 0, 0]} maxBarSize={36} />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default HomePage
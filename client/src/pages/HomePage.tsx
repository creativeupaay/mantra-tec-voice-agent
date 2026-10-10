import { FC, useEffect, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
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
  ChevronRight,
  CheckCheck,
  ArrowUpRight,
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
import { ICall, CallStatus } from '../types/call'
import { parseToDate } from '../utils/format'
import CallTable from '../components/calls/CallTable'
import CallDetailPanel from '../components/calls/CallDetailPanel'
import Modal from '../components/Modal'

const STATUS_LABELS: Record<CallStatus, string> = {
  live: 'Live',
  resolved: 'Resolved',
  escalated: 'Escalated',
  missed: 'Missed',
  callback_required: 'Callback Required',
}

// Helper for generating SVG sparklines
const Sparkline = ({ data, color = 'var(--color-text-muted)' }: { data: number[]; color?: string }) => {
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * 68
      const y = 18 - ((val - min) / range) * 16 - 1
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg width="68" height="20" className="overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.75"
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

  // Calls list for metrics and table
  const [callsList, setCallsList] = useState<ICall[]>([])
  const [selectedMonthRange, setSelectedMonthRange] = useState<string>('all')

  // Real backend server KPIs
  const [serverKpis, setServerKpis] = useState<{
    totalCalls: number
    resolvedCount: number
    escalatedCount: number
    missedCount: number
    liveCount: number
    redFlagCount: number
    reviewedCount: number
    unreviewedCount: number
    avgDurationSeconds: number
  } | null>(null)

  // Real backend server counts from calls endpoint
  const [serverCounts, setServerCounts] = useState<{
    escalated: number
    resolved: number
    callback_required: number
    reviewed: number
    unreviewed: number
  } | null>(null)

  const [serverTotalCalls, setServerTotalCalls] = useState<number>(0)

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

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Call review & detail drawer states
  const [selectedCall, setSelectedCall] = useState<ICall | null>(null)
  const [togglingReviewedId, setTogglingReviewedId] = useState<string | null>(null)
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalTitle, setModalTitle] = useState('')
  const [modalContent, setModalContent] = useState('')

  // ── Unified Data Fetching ───────────────────────────────────────────
  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [platformRes, analyticsRes, allCallsRes] = await Promise.all([
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
      if (allCallsRes?.pagination?.total !== undefined) {
        setServerTotalCalls(allCallsRes.pagination.total)
      }
      if (allCallsRes?.counts) {
        setServerCounts(allCallsRes.counts)
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

      // 3. Process Call Analytics for charts & true database KPIs
      if (analyticsRes?.data?.success && analyticsRes.data.data) {
        const ca = analyticsRes.data.data
        setCallVolume(ca.callVolume || [])
        setIntentBreakdown(ca.intentBreakdown || [])
        if (ca.kpis) {
          setServerKpis(ca.kpis)
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

    const handleStatusUpdate = () => {
      fetchDashboardData()
    }
    window.addEventListener('call-status-updated', handleStatusUpdate)
    return () => window.removeEventListener('call-status-updated', handleStatusUpdate)
  }, [isSuperAdmin])

  // ── DYNAMIC MONTH OPTIONS ──────────────────────────────────────────
  const monthOptions = useMemo(() => {
    const options = [{ value: 'all', label: 'All Time' }]
    const now = new Date()

    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      const value = i === 0 ? 'current' : i === 1 ? 'previous' : `month-${d.getFullYear()}-${d.getMonth()}`
      options.push({ value, label })
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
    return found ? found.label : 'All Time'
  }, [monthOptions, selectedMonthRange])

  // ── FILTERED CALLS BY SELECTED MONTH RANGE ─────────────────────────
  const filteredCalls = useMemo(() => {
    if (!callsList || callsList.length === 0) return []
    if (selectedMonthRange === 'all') return callsList

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

  // ── ACCURATE DATABASE METRICS ───────────────────────────────────────
  // When 'all', use the true DB counts from server; when specific month, derive from filtered set
  const isAllTime = selectedMonthRange === 'all'

  const totalCallsCount = useMemo(() => {
    if (isAllTime) {
      return serverKpis?.totalCalls || serverTotalCalls || callsList.length
    }
    return filteredCalls.length
  }, [isAllTime, serverKpis, serverTotalCalls, callsList.length, filteredCalls.length])

  const resolvedCount = useMemo(() => {
    if (isAllTime && (serverKpis?.resolvedCount !== undefined || serverCounts?.resolved !== undefined)) {
      return serverKpis?.resolvedCount ?? serverCounts?.resolved ?? 0
    }
    return filteredCalls.filter(c => c.status === 'resolved').length
  }, [isAllTime, serverKpis, serverCounts, filteredCalls])

  const escalatedCount = useMemo(() => {
    if (isAllTime && (serverKpis?.escalatedCount !== undefined || serverCounts?.escalated !== undefined)) {
      return serverKpis?.escalatedCount ?? serverCounts?.escalated ?? 0
    }
    return filteredCalls.filter(c => c.status === 'escalated').length
  }, [isAllTime, serverKpis, serverCounts, filteredCalls])

  const callbackRequiredCount = useMemo(() => {
    if (isAllTime && serverCounts?.callback_required !== undefined) {
      return serverCounts.callback_required
    }
    return filteredCalls.filter(c => c.status === 'callback_required').length
  }, [isAllTime, serverCounts, filteredCalls])

  const missedCount = useMemo(() => {
    if (isAllTime && serverKpis?.missedCount !== undefined) {
      return serverKpis.missedCount
    }
    return filteredCalls.filter(c => c.status === 'missed').length
  }, [isAllTime, serverKpis, filteredCalls])

  const liveCount = useMemo(() => {
    if (isAllTime && serverKpis?.liveCount !== undefined) {
      return serverKpis.liveCount
    }
    return filteredCalls.filter(c => c.status === 'live' || !c.status).length
  }, [isAllTime, serverKpis, filteredCalls])

  const redFlagCount = useMemo(() => {
    if (isAllTime && serverKpis?.redFlagCount !== undefined) {
      return serverKpis.redFlagCount
    }
    return filteredCalls.filter(c => Boolean(c.is_red_flag || c.is_red_flagged)).length
  }, [isAllTime, serverKpis, filteredCalls])

  const reviewedCount = useMemo(() => {
    if (isAllTime && (serverKpis?.reviewedCount !== undefined || serverCounts?.reviewed !== undefined)) {
      return serverKpis?.reviewedCount ?? serverCounts?.reviewed ?? 0
    }
    return filteredCalls.filter(c => Boolean(c.is_reviewed)).length
  }, [isAllTime, serverKpis, serverCounts, filteredCalls])

  const recentCallsToDisplay = useMemo(() => {
    return filteredCalls.slice(0, 8)
  }, [filteredCalls])

  const handleToggleReviewed = async (call: ICall) => {
    const targetId = call._id || call.call_id
    if (!targetId) return

    const newReviewedState = !Boolean(call.is_reviewed)

    setCallsList(prev =>
      prev.map(c => {
        if (c._id === targetId || c.call_id === targetId) {
          return {
            ...c,
            is_reviewed: newReviewedState,
            reviewed_at: newReviewedState ? new Date().toISOString() : undefined,
          }
        }
        return c
      })
    )

    if (selectedCall && (selectedCall._id === targetId || selectedCall.call_id === targetId)) {
      setSelectedCall(prev =>
        prev
          ? {
              ...prev,
              is_reviewed: newReviewedState,
              reviewed_at: newReviewedState ? new Date().toISOString() : undefined,
            }
          : null
      )
    }

    try {
      setTogglingReviewedId(targetId)
      const res = await callApi.updateReviewed(targetId, newReviewedState)
      if (res && res.success) {
        window.dispatchEvent(
          new CustomEvent('call-status-updated', {
            detail: { callId: targetId, is_reviewed: newReviewedState },
          })
        )
      }
    } catch (err) {
      console.error('Failed to toggle review status from dashboard:', err)
      fetchDashboardData()
    } finally {
      setTogglingReviewedId(null)
    }
  }

  const handleResolveCall = async (callId: string) => {
    try {
      setResolvingId(callId)
      await callApi.updateStatus(callId, 'resolved')
      fetchDashboardData()
    } catch (err) {
      console.error('Failed to resolve call from dashboard:', err)
    } finally {
      setResolvingId(null)
    }
  }

  const openModal = (title: string, content: string) => {
    setModalTitle(title)
    setModalContent(content)
    setIsModalOpen(true)
  }

  // Quota & duration metrics
  const totalDurationSeconds = useMemo(() => filteredCalls.reduce((sum, c) => sum + (c.duration || 0), 0), [filteredCalls])
  const minutesAllocated = 4000
  const minutesUsed = useMemo(() => Math.round(totalDurationSeconds / 60), [totalDurationSeconds])
  const minutesRemaining = useMemo(() => Math.max(0, minutesAllocated - minutesUsed), [minutesUsed])
  const usagePercent = useMemo(() => Math.min(100, parseFloat(((minutesUsed / minutesAllocated) * 100).toFixed(1))), [minutesUsed])

  const resolutionRate = useMemo(() => {
    if (totalCallsCount === 0) return 0
    return parseFloat(((resolvedCount / totalCallsCount) * 100).toFixed(1))
  }, [resolvedCount, totalCallsCount])

  const avgDurationMinutes = useMemo(() => {
    const avgSec = isAllTime && serverKpis?.avgDurationSeconds
      ? serverKpis.avgDurationSeconds
      : totalCallsCount > 0
        ? Math.round(totalDurationSeconds / totalCallsCount)
        : 0
    return (avgSec / 60).toFixed(1)
  }, [isAllTime, serverKpis, totalCallsCount, totalDurationSeconds])

  // Donut chart status breakdown
  const statusBreakdownData = useMemo(() => [
    { name: 'resolved', value: resolvedCount },
    { name: 'callback_required', value: callbackRequiredCount },
    { name: 'escalated', value: escalatedCount },
    { name: 'missed', value: missedCount },
    { name: 'live', value: liveCount },
  ], [resolvedCount, callbackRequiredCount, escalatedCount, missedCount, liveCount])

  // Dynamic Call Volume per day
  const callVolumeData = useMemo(() => {
    if (callVolume.length > 0 && selectedMonthRange === 'all') {
      return callVolume.map(v => ({ ...v, dayNumber: v.date.split(' ')[1] || v.date }))
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
    const entries = Object.entries(volumeMap).map(([date, count]) => ({
      date,
      dayNumber: date.split(' ')[1] || date,
      count,
    }))
    return entries.length > 0
      ? entries
      : callVolume.map(v => ({ ...v, dayNumber: v.date.split(' ')[1] || v.date }))
  }, [filteredCalls, callVolume, selectedMonthRange])

  // Intent breakdown
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
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-surface-card rounded-xl w-64 border border-border" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-surface-card rounded-2xl border border-border p-5 h-32" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-surface-card rounded-2xl border border-border p-8 text-center shadow-xs">
        <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
        <p className="text-sm font-semibold text-text-primary mb-1">Failed to load dashboard</p>
        <p className="text-xs text-text-secondary">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 font-sans">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-text-primary">
            Dashboard
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Call metrics and performance analytics
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          {/* Month Selector Pill */}
          <div className="relative shrink-0">
            <select
              value={selectedMonthRange}
              onChange={e => setSelectedMonthRange(e.target.value)}
              className="appearance-none pl-3.5 pr-8 py-1.5 bg-surface-card border border-border hover:border-border-strong rounded-xl text-xs font-semibold text-text-primary focus:outline-none focus:ring-1 focus:ring-text-primary/20 cursor-pointer transition-all shadow-2xs"
            >
              {monthOptions.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-text-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <button
            onClick={() => navigate('/calls')}
            className="px-3 py-1.5 rounded-xl bg-text-primary text-surface-card text-xs font-semibold hover:bg-neutral-800 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <span>View Calls</span>
            <ArrowUpRight size={13} strokeWidth={2.25} />
          </button>
        </div>
      </div>

      {/* ── KPI Metrics Grid ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {/* Card 1: Minutes Quota */}
        <div className="bg-surface-card border border-border hover:border-border-strong rounded-2xl p-4.5 flex flex-col justify-between transition-all shadow-2xs">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded-lg bg-surface-page border border-border flex items-center justify-center text-text-primary">
                  <Clock size={13} strokeWidth={2.25} />
                </div>
                <span className="text-xs font-semibold text-text-secondary">Minutes Quota</span>
              </div>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-accent-bg text-accent border border-accent/20">
                {usagePercent}% USED
              </span>
            </div>

            <div className="mt-1">
              <p className="text-2xl font-bold font-mono tabular-nums text-text-primary leading-tight">
                {minutesUsed.toLocaleString()}{' '}
                <span className="text-xs font-sans font-normal text-text-muted">
                  / {minutesAllocated.toLocaleString()}m
                </span>
              </p>
            </div>

            <div className="w-full bg-surface-page rounded-full h-1.5 overflow-hidden my-2.5 border border-border/70">
              <div
                className="bg-text-primary h-full rounded-full transition-all duration-500"
                style={{ width: `${usagePercent}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-text-muted pt-1">
            <span>Remaining</span>
            <span className="font-mono font-semibold text-text-primary">
              {minutesRemaining.toLocaleString()} mins
            </span>
          </div>
        </div>

        {/* Card 2: Total Calls */}
        <div
          onClick={() => navigate('/calls')}
          className="bg-surface-card border border-border hover:border-border-strong rounded-2xl p-4.5 flex flex-col justify-between transition-all shadow-2xs cursor-pointer group"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded-lg bg-surface-page border border-border flex items-center justify-center text-text-primary">
                  <AudioWaveform size={13} strokeWidth={2.25} />
                </div>
                <span className="text-xs font-semibold text-text-secondary">Total Calls</span>
              </div>
              <ChevronRight
                size={14}
                className="text-text-muted group-hover:translate-x-0.5 transition-transform"
              />
            </div>

            <p className="text-2xl font-bold font-mono tabular-nums text-text-primary leading-tight mt-1">
              {totalCallsCount.toLocaleString()}
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[10px] font-medium text-text-muted">{selectedMonthLabel}</span>
            <Sparkline data={[4, 8, 12, 14, 18, 22, totalCallsCount || 1]} />
          </div>
        </div>

        {/* Card 3: Reviewed Calls */}
        <div
          onClick={() => navigate('/calls')}
          className="bg-surface-card border border-border hover:border-emerald-500/40 rounded-2xl p-4.5 flex flex-col justify-between transition-all shadow-2xs cursor-pointer group"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
                  <CheckCheck size={13} strokeWidth={2.5} />
                </div>
                <span className="text-xs font-semibold text-emerald-700">Reviewed Calls</span>
              </div>
              <ChevronRight
                size={14}
                className="text-text-muted group-hover:translate-x-0.5 transition-transform"
              />
            </div>

            <p className="text-2xl font-bold font-mono tabular-nums text-text-primary leading-tight mt-1">
              {reviewedCount}{' '}
              <span className="text-xs font-sans font-normal text-text-muted">
                / {totalCallsCount}
              </span>
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[10px] font-medium text-text-muted">
              {totalCallsCount > 0
                ? `${Math.round((reviewedCount / totalCallsCount) * 100)}% reviewed`
                : '0%'}
            </span>
            <Sparkline
              data={[1, 2, 4, 6, 8, 10, reviewedCount || 1]}
              color="var(--color-status-resolved)"
            />
          </div>
        </div>

        {/* Card 4: Escalated Calls */}
        <div
          onClick={() => navigate('/calls?tab=escalated')}
          className={`rounded-2xl p-4.5 flex flex-col justify-between transition-all shadow-2xs cursor-pointer group ${
            escalatedCount > 0
              ? 'bg-red-500/5 border border-red-500/30 hover:border-red-500/60'
              : 'bg-surface-card border border-border hover:border-border-strong'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                    escalatedCount > 0
                      ? 'bg-red-500 text-white'
                      : 'bg-surface-page border border-border text-text-muted'
                  }`}
                >
                  <AlertOctagon size={13} strokeWidth={2.25} />
                </div>
                <span
                  className={`text-xs font-semibold ${
                    escalatedCount > 0 ? 'text-red-600' : 'text-text-secondary'
                  }`}
                >
                  Escalated Calls
                </span>
              </div>
            </div>

            <p
              className={`text-2xl font-bold font-mono tabular-nums leading-tight mt-1 ${
                escalatedCount > 0 ? 'text-red-600' : 'text-text-primary'
              }`}
            >
              {escalatedCount}
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span
              className={`text-[10px] font-medium ${
                escalatedCount > 0 ? 'text-red-500' : 'text-text-muted'
              }`}
            >
              Pending escalation
            </span>
            <Sparkline
              data={[0, 1, 0, 1, 2, 1, escalatedCount || 0]}
              color={escalatedCount > 0 ? 'var(--color-status-escalated)' : 'var(--color-text-muted)'}
            />
          </div>
        </div>

        {/* Card 5: Callback Required */}
        <div
          onClick={() => navigate('/calls?tab=callback_required')}
          className="bg-surface-card border border-border hover:border-indigo-500/40 rounded-2xl p-4.5 flex flex-col justify-between transition-all shadow-2xs cursor-pointer group"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600">
                  <PhoneCall size={13} strokeWidth={2.25} />
                </div>
                <span className="text-xs font-semibold text-indigo-700">Callback Required</span>
              </div>
              <ChevronRight
                size={14}
                className="text-text-muted group-hover:translate-x-0.5 transition-transform"
              />
            </div>
            <p className="text-2xl font-bold font-mono tabular-nums text-text-primary leading-tight mt-1">
              {callbackRequiredCount}
            </p>
          </div>
          <div className="flex items-center justify-between pt-2">
            <span className="text-[10px] font-medium text-text-muted">Customer follow-ups</span>
            <Sparkline data={[0, 1, 2, 1, 3, 2, callbackRequiredCount || 0]} color="#6366F1" />
          </div>
        </div>

        {/* Card 6: Resolved Calls */}
        <div className="bg-surface-card border border-border hover:border-border-strong rounded-2xl p-4.5 flex flex-col justify-between transition-all shadow-2xs">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded-lg bg-surface-page border border-border flex items-center justify-center text-text-primary">
                  <CheckCircle size={13} strokeWidth={2.25} />
                </div>
                <span className="text-xs font-semibold text-text-secondary">Resolved Calls</span>
              </div>
            </div>
            <p className="text-2xl font-bold font-mono tabular-nums text-text-primary leading-tight mt-1">
              {resolvedCount}
            </p>
          </div>
          <div className="flex items-center justify-between pt-2">
            <span className="text-[10px] font-medium text-text-muted">
              {resolutionRate}% resolved
            </span>
            <Sparkline data={[1, 3, 5, 8, 10, 12, resolvedCount || 1]} />
          </div>
        </div>

        {/* Card 7: Red Flags */}
        <div
          onClick={() => navigate('/calls?tab=flagged')}
          className="bg-surface-card border border-border hover:border-border-strong rounded-2xl p-4.5 flex flex-col justify-between transition-all shadow-2xs cursor-pointer group"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded-lg bg-surface-page border border-border flex items-center justify-center text-text-primary">
                  <AlertTriangle size={13} strokeWidth={2.25} />
                </div>
                <span className="text-xs font-semibold text-text-secondary">Red Flag Alerts</span>
              </div>
            </div>
            <p className="text-2xl font-bold font-mono tabular-nums text-text-primary leading-tight mt-1">
              {redFlagCount}
            </p>
          </div>
          <div className="flex items-center justify-between pt-2">
            <span className="text-[10px] font-medium text-text-muted">Guardrail alerts</span>
            <Sparkline data={[0, 0, 1, 0, 0, 0, redFlagCount || 0]} />
          </div>
        </div>

        {/* Card 8: Missed Calls or Platform Users */}
        {isSuperAdmin ? (
          <div className="bg-surface-card border border-border hover:border-border-strong rounded-2xl p-4.5 flex flex-col justify-between transition-all shadow-2xs">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-lg bg-surface-page border border-border flex items-center justify-center text-text-primary">
                    <Users size={13} strokeWidth={2.25} />
                  </div>
                  <span className="text-xs font-semibold text-text-secondary">Platform Users</span>
                </div>
              </div>
              <p className="text-2xl font-bold font-mono tabular-nums text-text-primary leading-tight mt-1">
                {platformStats.totalUsers.toLocaleString()}
              </p>
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-[10px] font-medium text-text-muted">Total accounts</span>
              <Sparkline data={[1, 2, 2, 3, 3, platformStats.totalUsers || 1]} />
            </div>
          </div>
        ) : (
          <div className="bg-surface-card border border-border hover:border-border-strong rounded-2xl p-4.5 flex flex-col justify-between transition-all shadow-2xs">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-lg bg-surface-page border border-border flex items-center justify-center text-text-primary">
                    <PhoneOff size={13} strokeWidth={2.25} />
                  </div>
                  <span className="text-xs font-semibold text-text-secondary">Missed Calls</span>
                </div>
              </div>
              <p className="text-2xl font-bold font-mono tabular-nums text-text-primary leading-tight mt-1">
                {missedCount}
              </p>
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-[10px] font-medium text-text-muted">Unanswered</span>
              <Sparkline data={[0, 1, 0, 1, 0, 0, missedCount || 0]} />
            </div>
          </div>
        )}
      </div>

      {/* ── Charts Section ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Daily Call Volume (Col-span-2) */}
        <div className="lg:col-span-2 bg-surface-card rounded-2xl border border-border p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-text-primary">Daily Call Volume</h3>
              <p className="text-[11px] text-text-muted mt-0.5">
                Distribution over {selectedMonthLabel}
              </p>
            </div>
            <span className="text-xs font-mono font-medium text-text-secondary bg-surface-page px-2.5 py-1 rounded-lg border border-border">
              {totalCallsCount} calls
            </span>
          </div>

          <div className="h-64 w-full overflow-x-auto scrollbar-narrow pt-2">
            <div className="h-full min-w-[500px]">
              <CallVolumeChart data={callVolumeData} />
            </div>
          </div>
        </div>

        {/* Sidebar Analytics Column (Col-span-1) */}
        <div className="space-y-5">
          {/* Performance Overview */}
          <div className="bg-surface-card rounded-2xl border border-border p-5 shadow-2xs space-y-3">
            <h3 className="text-sm font-bold text-text-primary">Performance Overview</h3>

            <div className="divide-y divide-border/60">
              <div className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2">
                  <Clock size={13} className="text-text-muted" />
                  <span className="text-xs font-medium text-text-secondary">Avg Call Duration</span>
                </div>
                <span className="text-xs font-mono font-bold text-text-primary tabular-nums">
                  {avgDurationMinutes} mins
                </span>
              </div>

              <div className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2">
                  <CheckCircle size={13} className="text-text-muted" />
                  <span className="text-xs font-medium text-text-secondary">Resolution Rate</span>
                </div>
                <span className="text-xs font-mono font-bold text-text-primary tabular-nums">
                  {resolutionRate}%
                </span>
              </div>
            </div>
          </div>

          {/* Status Breakdown Donut Chart */}
          <div className="bg-surface-card rounded-2xl border border-border p-5 shadow-2xs">
            <h3 className="text-sm font-bold text-text-primary mb-2">Call Status Breakdown</h3>
            <div className="h-52">
              <DonutChart data={statusBreakdownData} totalCalls={totalCallsCount} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Top Customer Intents Chart ───────────────────────────────── */}
      <div className="bg-surface-card rounded-2xl border border-border p-5 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-text-primary">Top Customer Intents</h3>
            <p className="text-[11px] text-text-muted mt-0.5">
              Primary detected categories from incoming calls
            </p>
          </div>
        </div>
        <div className="h-44 w-full">
          <BarChart data={intentBreakdownData} />
        </div>
      </div>

      {/* ── Recent Calls Table ───────────────────────────────────────── */}
      <div className="bg-surface-card rounded-2xl border border-border overflow-hidden shadow-2xs">
        <div className="p-4.5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-text-primary">Recent Calls</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                {reviewedCount} / {totalCallsCount} Reviewed
              </span>
            </div>
            <p className="text-xs text-text-secondary mt-0.5">
              Review transcripts, playback audio, and manage call resolutions
            </p>
          </div>

          <button
            onClick={() => navigate('/calls')}
            className="text-xs font-semibold text-text-primary hover:text-accent flex items-center gap-1 cursor-pointer transition-colors"
          >
            <span>View All in Calls</span>
            <ChevronRight size={14} />
          </button>
        </div>

        <CallTable
          isLoading={loading}
          filtered={recentCallsToDisplay}
          selectedCall={selectedCall}
          setSelectedCall={setSelectedCall}
          openModal={openModal}
          STATUS_LABELS={STATUS_LABELS}
          onResolveCall={handleResolveCall}
          resolvingId={resolvingId}
          onToggleReviewed={handleToggleReviewed}
          togglingReviewedId={togglingReviewedId}
        />
      </div>

      {/* ── Detail Panel Drawer via Portal ───────────────────────────── */}
      {selectedCall &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-40 bg-black/25 backdrop-blur-2xs transition-opacity"
              onClick={() => setSelectedCall(null)}
            />
            <div className="fixed top-0 right-0 h-full z-50 w-[720px] max-w-full shadow-2xl animate-in slide-in-from-right duration-200">
              <CallDetailPanel
                selectedCall={selectedCall}
                setSelectedCall={setSelectedCall}
                openModal={openModal}
                STATUS_LABELS={STATUS_LABELS}
                onResolveCall={handleResolveCall}
                resolvingId={resolvingId}
                onToggleReviewed={handleToggleReviewed}
                togglingReviewedId={togglingReviewedId}
              />
            </div>
          </>,
          document.body
        )}

      {/* Text Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalTitle}>
        <div className="bg-surface-page border border-border rounded-xl p-5">
          <pre className="text-xs leading-relaxed text-text-primary whitespace-pre-wrap font-sans">
            {modalContent}
          </pre>
        </div>
      </Modal>
    </div>
  )
}

// ── SVG Bar Chart for Call Volume ─────────────────────────────────────
const CallVolumeChart = ({
  data,
}: {
  data: { date: string; dayNumber?: string; count: number }[]
}) => {
  if (!data.length)
    return (
      <div className="h-full flex items-center justify-center text-text-muted text-xs">
        No call data available
      </div>
    )

  const maxCount = Math.max(...data.map(d => d.count), 1)

  return (
    <svg width="100%" height="100%" className="overflow-visible" viewBox={`0 0 ${data.length * 20} 200`}>
      {data.map((d, i) => {
        const h = (d.count / maxCount) * 150
        const x = i * 20 + 4
        const labelText = d.dayNumber || d.date.split(' ')[1] || d.date.split(' ')[0]
        return (
          <g key={d.date} className="group">
            <title>{`${d.date}: ${d.count} calls`}</title>
            <rect
              x={x}
              y={175 - h}
              width={12}
              height={Math.max(h, 3)}
              rx={3}
              fill="var(--color-text-primary)"
              opacity={d.count > 0 ? 0.85 : 0.15}
              className="hover:opacity-100 transition-opacity"
            />
            <text
              x={x + 6}
              y={193}
              textAnchor="middle"
              fontSize="8"
              fill="var(--color-text-muted)"
              fontFamily="var(--font-mono)"
            >
              {labelText}
            </text>
            {d.count > 0 && (
              <text
                x={x + 6}
                y={170 - h}
                textAnchor="middle"
                fontSize="9"
                fontWeight="600"
                fill="var(--color-text-primary)"
                fontFamily="var(--font-mono)"
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

// ── Recharts Donut Chart for Call Status Breakdown ───────────────────
const STATUS_COLORS: Record<string, string> = {
  resolved: '#5B8C5A',
  callback_required: '#6366F1',
  escalated: '#C1554A',
  missed: '#C98A3B',
  live: '#2451DA',
}

const DonutChart = ({
  data,
  totalCalls,
}: {
  data: { name: string; value: number }[]
  totalCalls: number
}) => {
  const activeData = data.filter(d => d.value > 0)

  if (totalCalls === 0 || activeData.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-text-muted text-xs">
        No call status records
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="w-full h-34">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={activeData}
              cx="50%"
              cy="50%"
              innerRadius={36}
              outerRadius={52}
              paddingAngle={activeData.length > 1 ? 4 : 0}
              dataKey="value"
              stroke="none"
            >
              {activeData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || '#71717A'} />
              ))}
            </Pie>
            <RechartsTooltip
              formatter={(val: any) => [val, 'calls']}
              contentStyle={{
                backgroundColor: 'var(--color-surface-card)',
                borderRadius: '12px',
                border: '1px solid var(--color-border)',
                fontSize: '11px',
                color: 'var(--color-text-primary)',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-1 text-center">
        {data.map(d => {
          const color = STATUS_COLORS[d.name] || '#71717A'
          const pct = totalCalls > 0 ? ((d.value / totalCalls) * 100).toFixed(1) : '0.0'
          return (
            <div key={d.name} className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className="text-[10px] text-text-secondary capitalize">
                {d.name.replace(/_/g, ' ')}
              </span>
              <span className="text-[10px] font-mono font-semibold text-text-primary tabular-nums">
                {d.value}
              </span>
              <span className="text-[9px] text-text-muted font-mono tabular-nums">({pct}%)</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Recharts Bar Chart for Top Customer Intents ──────────────────────
const BarChart = ({ data }: { data: { intent: string; count: number }[] }) => {
  if (!data.length)
    return (
      <div className="h-full flex items-center justify-center text-text-muted text-xs">
        No customer intent data
      </div>
    )

  const topData = data.slice(0, 6)

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart data={topData} margin={{ top: 8, right: 10, left: -25, bottom: 15 }}>
          <XAxis
            dataKey="intent"
            tick={{ fontSize: 10, fill: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}
            interval={0}
            tickFormatter={val => (val.length > 10 ? val.slice(0, 10) + '…' : val)}
          />
          <YAxis
            tick={{ fontSize: 9, fill: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}
            allowDecimals={false}
          />
          <RechartsTooltip
            formatter={(val: any) => [val, 'calls']}
            contentStyle={{
              backgroundColor: 'var(--color-surface-card)',
              borderRadius: '12px',
              border: '1px solid var(--color-border)',
              fontSize: '11px',
              color: 'var(--color-text-primary)',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            }}
          />
          <RechartsBar
            dataKey="count"
            fill="var(--color-text-primary)"
            radius={[4, 4, 0, 0]}
            maxBarSize={32}
          />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default HomePage
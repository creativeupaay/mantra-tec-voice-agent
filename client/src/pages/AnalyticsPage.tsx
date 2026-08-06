import { FC, useEffect, useState, useMemo } from 'react'
import { analyticsApi, ICallAnalytics } from '../api/client'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar
} from 'recharts'
import { Phone, CheckCircle, AlertTriangle, PhoneOff, Flag, Clock } from 'lucide-react'

// ── Status color palette — pulled from design system tokens ───────────────────
const STATUS_COLORS: Record<string, string> = {
  resolved: '#5B8C5A',   // --color-status-resolved
  escalated: '#C1554A',   // --color-status-escalated
  missed: '#C98A3B',   // --color-status-missed
  live: '#2451DA',   // --color-status-live / accent
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatDuration = (seconds: number): string => {
  if (!seconds) return '0s'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

const formatPercent = (part: number, total: number): string => {
  if (!total) return '0%'
  return `${Math.round((part / total) * 100)}%`
}

// ── Custom Tooltip for Line Chart ─────────────────────────────────────────────
const VolumeTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface-card border border-border rounded-lg px-3 py-2 shadow-sm text-[13px]">
      <p className="text-text-secondary mb-1">{label}</p>
      <p className="font-semibold text-text-primary">{payload[0].value} calls</p>
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string
  value: string | number
  sub?: string
  icon: React.ReactNode
  iconBg?: string
}
const KpiCard: FC<KpiCardProps> = ({ label, value, sub, icon, iconBg = 'bg-surface-page border border-border' }) => (
  <div className="bg-surface-card p-5 rounded-2xl border border-border shadow-sm flex flex-col gap-3">
    <div className="flex items-center justify-between">
      <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center`}>
        {icon}
      </div>
    </div>
    <div>
      <p className="text-[28px] font-semibold text-text-primary tabular-nums leading-none">{value}</p>
      {sub && <p className="text-[12px] text-text-muted mt-1">{sub}</p>}
    </div>
    <p className="text-[12px] font-medium text-text-secondary uppercase tracking-wider">{label}</p>
  </div>
)

// ── Section Header ────────────────────────────────────────────────────────────
const SectionTitle: FC<{ title: string; sub?: string }> = ({ title, sub }) => (
  <div className="px-6 py-5 border-b border-border">
    <h3 className="text-[15px] font-semibold text-text-primary">{title}</h3>
    {sub && <p className="text-[13px] text-text-secondary mt-0.5">{sub}</p>}
  </div>
)

// ── Page ──────────────────────────────────────────────────────────────────────
const AnalyticsPage: FC = () => {
  const [data, setData] = useState<ICallAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    analyticsApi.getCallAnalytics()
      .then(res => setData(res.data.data))
      .catch(() => setError(true))
      .finally(() => setIsLoading(false))
  }, [])

  const resolvedRate = useMemo(() => {
    if (!data) return '—'
    return formatPercent(data.kpis.resolvedCount, data.kpis.totalCalls)
  }, [data])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-text-secondary text-sm">Loading analytics…</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-text-secondary text-sm">Failed to load analytics. Please try again.</p>
      </div>
    )
  }

  const {
    kpis = { totalCalls: 0, resolvedCount: 0, escalatedCount: 0, missedCount: 0, liveCount: 0, redFlagCount: 0, avgDurationSeconds: 0 },
    callVolume = [],
    statusBreakdown = [],
    intentBreakdown = [],
    recentRedFlags = []
  } = data || {}

  return (
    <div className="space-y-6 pb-10">

      {/* ── HEADER ── */}
      <div>
        <h2 className="text-2xl font-semibold text-text-primary tracking-tight">Analytics</h2>
        <p className="text-[14px] text-text-secondary mt-1">
          Voice agent performance overview — last 30 days.
        </p>
      </div>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          label="Total Calls"
          value={kpis.totalCalls}
          icon={<Phone size={16} className="text-text-secondary" />}
        />
        <KpiCard
          label="Resolved Rate"
          value={resolvedRate}
          sub={`${kpis.resolvedCount} of ${kpis.totalCalls}`}
          icon={<CheckCircle size={16} style={{ color: '#5B8C5A' }} />}
          iconBg="bg-[#5B8C5A]/10 border-0"
        />
        <KpiCard
          label="Avg Call Duration"
          value={formatDuration(kpis.avgDurationSeconds)}
          icon={<Clock size={16} className="text-text-secondary" />}
        />
        <KpiCard
          label="Escalations"
          value={kpis.escalatedCount}
          sub={formatPercent(kpis.escalatedCount, kpis.totalCalls) + ' of total'}
          icon={<AlertTriangle size={16} style={{ color: '#C1554A' }} />}
          iconBg="bg-[#C1554A]/10 border-0"
        />
        <KpiCard
          label="Missed Calls"
          value={kpis.missedCount}
          icon={<PhoneOff size={16} style={{ color: '#C98A3B' }} />}
          iconBg="bg-[#C98A3B]/10 border-0"
        />
        <KpiCard
          label="Red Flags"
          value={kpis.redFlagCount}
          sub={kpis.redFlagCount > 0 ? 'Require review' : 'All clear'}
          icon={<Flag size={16} style={{ color: '#C1554A' }} />}
          iconBg={kpis.redFlagCount > 0 ? 'bg-[#C1554A]/10 border-0' : 'bg-surface-page border border-border'}
        />
      </div>

      {/* ── CHARTS ROW ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Call Volume Line Chart */}
        <div className="lg:col-span-2 bg-surface-card rounded-2xl border border-border shadow-sm">
          <SectionTitle title="Call Volume" sub="Inbound calls per day — last 30 days" />
          <div className="p-6 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={callVolume} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                  interval={4}
                  dy={8}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                  allowDecimals={false}
                />
                <Tooltip content={<VolumeTooltip />} />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="var(--color-accent)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: 'var(--color-accent)', strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Breakdown Donut */}
        <div className="bg-surface-card rounded-2xl border border-border shadow-sm">
          <SectionTitle title="Status Breakdown" />
          <div className="p-6 flex flex-col items-center">
            <div className="w-full h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {statusBreakdown.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={STATUS_COLORS[entry.name] || '#D4D4D8'}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => [value, '']}
                    contentStyle={{ backgroundColor: 'var(--color-surface-card)', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '13px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.08)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="w-full mt-2 space-y-2">
              {statusBreakdown.map(s => (
                <div key={s.name} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: STATUS_COLORS[s.name] || '#D4D4D8' }} />
                    <span className="text-[12px] text-text-secondary capitalize">{s.name}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[12px] font-medium text-text-primary tabular-nums">{s.value}</span>
                    <span className="text-[11px] text-text-muted tabular-nums">
                      {formatPercent(s.value, kpis.totalCalls)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM ROW ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Intent Breakdown */}
        <div className="bg-surface-card rounded-2xl border border-border shadow-sm">
          <SectionTitle title="Top Caller Intents" sub="What callers are asking about most" />
          <div className="p-6 h-64">
            {intentBreakdown.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[13px] text-text-muted">
                No intent data yet — intents are detected automatically during calls.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={intentBreakdown}
                  layout="vertical"
                  margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="intent"
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value: string) => (value.length > 16 ? `${value.slice(0, 14)}...` : value)}
                    tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }}
                    width={110}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--color-surface-page)' }}
                    contentStyle={{ backgroundColor: 'var(--color-surface-card)', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '13px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.08)' }}
                    formatter={(value: any) => [value, 'calls']}
                  />
                  <Bar dataKey="count" fill="var(--color-accent)" radius={[0, 4, 4, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Red Flag Alerts */}
        <div className="bg-surface-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <SectionTitle
            title="Red Flag Alerts"
            sub={(recentRedFlags || []).length > 0 ? `${kpis.redFlagCount} total flagged calls` : 'No flagged calls'}
          />
          {(recentRedFlags || []).length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center text-center">
              <div className="w-10 h-10 rounded-full bg-[#5B8C5A]/10 flex items-center justify-center mb-3">
                <CheckCircle size={18} style={{ color: '#5B8C5A' }} />
              </div>
              <p className="text-[13px] font-medium text-text-primary">All clear</p>
              <p className="text-[12px] text-text-muted mt-1">No calls have been flagged recently.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {(recentRedFlags || []).map((call) => (
                <div key={call._id} className="px-6 py-4 hover:bg-surface-page transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-[13px] font-medium text-text-primary truncate">
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
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}

export default AnalyticsPage
import { FC } from 'react'
import {
  Search,
  Flag,
  ChevronDown,
  Calendar,
  AlertTriangle,
  CheckCircle,
  PhoneForwarded,
  X,
  Radio,
  PhoneOff,
  Filter,
} from 'lucide-react'
import { CallStatus } from '../../types/call'

export type DateFilterPreset =
  | 'all'
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'last_30_days'
  | 'custom'

interface CallFiltersProps {
  search: string
  setSearch: (val: string) => void
  activeFilter: 'all' | CallStatus | 'flagged'
  setActiveFilter: (val: 'all' | CallStatus | 'flagged') => void
  intentFilter: string
  setIntentFilter: (val: string) => void
  intentOptions: string[]
  reviewFilter: 'all' | 'unreviewed' | 'reviewed'
  setReviewFilter: (val: 'all' | 'unreviewed' | 'reviewed') => void
  datePreset: DateFilterPreset
  setDatePreset: (val: DateFilterPreset) => void
  dateFrom: string
  setDateFrom: (val: string) => void
  dateTo: string
  setDateTo: (val: string) => void
  escalatedCount?: number
  resolvedCount?: number
  callbackRequiredCount?: number
  reviewedCount?: number
  unreviewedCount?: number
}

const DATE_PRESETS: { label: string; value: DateFilterPreset }[] = [
  { label: 'All time', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 days', value: 'last_7_days' },
  { label: 'Last 30 days', value: 'last_30_days' },
  { label: 'Custom range', value: 'custom' },
]

const selectClass =
  'w-full appearance-none pl-3.5 pr-8 py-2 bg-surface-card border border-border hover:border-border-strong rounded-xl text-xs font-semibold text-text-primary focus:outline-none focus:ring-1 focus:ring-text-primary/20 transition-all cursor-pointer shadow-2xs'

const CallFilters: FC<CallFiltersProps> = ({
  search,
  setSearch,
  activeFilter,
  setActiveFilter,
  intentFilter,
  setIntentFilter,
  intentOptions,
  reviewFilter,
  setReviewFilter,
  datePreset,
  setDatePreset,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  escalatedCount = 0,
  resolvedCount = 0,
  callbackRequiredCount = 0,
  reviewedCount = 0,
  unreviewedCount = 0,
}) => {
  const FILTER_OPTIONS: {
    label: string
    value: CallStatus | 'all' | 'flagged'
    badge?: number
    icon?: any
    badgeType?: 'danger' | 'warning' | 'success' | 'neutral'
  }[] = [
    { label: 'All Calls', value: 'all' },
    {
      label: 'Callback Required',
      value: 'callback_required',
      badge: callbackRequiredCount,
      icon: PhoneForwarded,
      badgeType: 'warning',
    },
    {
      label: 'Escalated',
      value: 'escalated',
      badge: escalatedCount,
      icon: AlertTriangle,
      badgeType: 'danger',
    },
    {
      label: 'Resolved',
      value: 'resolved',
      badge: resolvedCount,
      icon: CheckCircle,
      badgeType: 'success',
    },
    { label: 'Live', value: 'live', icon: Radio },
    { label: 'Missed', value: 'missed', icon: PhoneOff },
    { label: 'Red Flag', value: 'flagged', icon: Flag, badgeType: 'danger' },
  ]

  return (
    <div className="space-y-3.5">
      {/* ── Top Search & Dropdown Control Row ────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search
            size={15}
            strokeWidth={2}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search customer, phone number, intent, summary…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9.5 pr-8 py-2 bg-surface-card border border-border hover:border-border-strong rounded-xl text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-text-primary/20 transition-all shadow-2xs font-medium"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-text-muted hover:text-text-primary hover:bg-surface-page transition-colors cursor-pointer"
              title="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Intent Dropdown */}
        <div className="relative shrink-0 sm:w-44">
          <select
            value={intentFilter}
            onChange={e => setIntentFilter(e.target.value)}
            className={selectClass}
            aria-label="Filter by intent"
          >
            <option value="all">All Intents</option>
            {intentOptions.map(intent => (
              <option key={intent} value={intent}>
                {intent}
              </option>
            ))}
          </select>
          <ChevronDown
            size={13}
            strokeWidth={2}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
        </div>

        {/* Review Status Dropdown */}
        <div className="relative shrink-0 sm:w-44">
          <select
            value={reviewFilter}
            onChange={e => setReviewFilter(e.target.value as 'all' | 'unreviewed' | 'reviewed')}
            className={selectClass}
            aria-label="Filter by review status"
          >
            <option value="all">All Review Status</option>
            <option value="unreviewed">
              Unreviewed {unreviewedCount > 0 ? `(${unreviewedCount})` : ''}
            </option>
            <option value="reviewed">
              Reviewed {reviewedCount > 0 ? `(${reviewedCount})` : ''}
            </option>
          </select>
          <ChevronDown
            size={13}
            strokeWidth={2}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
        </div>

        {/* Date Preset Dropdown */}
        <div className="relative shrink-0 sm:w-42">
          <Calendar
            size={13}
            strokeWidth={2}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <select
            value={datePreset}
            onChange={e => setDatePreset(e.target.value as DateFilterPreset)}
            className={`${selectClass} pl-8.5`}
            aria-label="Filter by date"
          >
            {DATE_PRESETS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={13}
            strokeWidth={2}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
        </div>
      </div>

      {/* Custom Date Range Picker (shown only when custom preset selected) */}
      {datePreset === 'custom' && (
        <div className="p-3 bg-surface-card border border-border rounded-xl flex flex-col sm:flex-row gap-3 sm:items-center shadow-2xs">
          <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
            Custom Range:
          </span>
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            <span>From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="px-2.5 py-1 bg-surface-page border border-border rounded-lg text-xs font-mono text-text-primary focus:outline-none focus:border-border-strong"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            <span>To</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="px-2.5 py-1 bg-surface-page border border-border rounded-lg text-xs font-mono text-text-primary focus:outline-none focus:border-border-strong"
            />
          </label>
        </div>
      )}

      {/* ── Segmented Studio Filter Pills (ElevenLabs style) ─────── */}
      <div className="p-1 bg-surface-page/80 border border-border rounded-xl flex items-center gap-1 overflow-x-auto scrollbar-narrow">
        {FILTER_OPTIONS.map(opt => {
          const Icon = opt.icon
          const isActive = activeFilter === opt.value
          const isDanger = opt.badgeType === 'danger'
          const isWarning = opt.badgeType === 'warning'
          const isSuccess = opt.badgeType === 'success'

          return (
            <button
              key={opt.value}
              onClick={() => setActiveFilter(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-surface-card text-text-primary shadow-xs border border-border/80'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-card/50'
              }`}
            >
              {Icon && <Icon size={12} strokeWidth={2.25} />}
              <span>{opt.label}</span>
              {opt.badge !== undefined && (
                <span
                  className={`px-1.5 py-0.2 text-[10px] font-mono font-bold rounded-full ${
                    isDanger && opt.badge > 0
                      ? 'bg-red-500/15 text-red-600'
                      : isWarning && opt.badge > 0
                        ? 'bg-indigo-500/15 text-indigo-600'
                        : isSuccess && opt.badge > 0
                          ? 'bg-emerald-500/15 text-emerald-600'
                          : 'bg-border/60 text-text-muted'
                  }`}
                >
                  {opt.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default CallFilters

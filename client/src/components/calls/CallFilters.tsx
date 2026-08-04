import { FC } from 'react'
import { Search, Flag, ChevronDown, Calendar, AlertTriangle, CheckCircle } from 'lucide-react'
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
  datePreset: DateFilterPreset
  setDatePreset: (val: DateFilterPreset) => void
  dateFrom: string
  setDateFrom: (val: string) => void
  dateTo: string
  setDateTo: (val: string) => void
  escalatedCount?: number
  resolvedCount?: number
}

const DATE_PRESETS: { label: string; value: DateFilterPreset }[] = [
  { label: 'All time', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 days', value: 'last_7_days' },
  { label: 'Last 30 days', value: 'last_30_days' },
  { label: 'Custom', value: 'custom' },
]

const selectClass =
  'w-full appearance-none pl-3.5 pr-9 py-2.5 bg-surface-card border border-border rounded-xl text-[14px] text-text-primary focus:outline-none focus:border-border-strong transition-colors cursor-pointer'

const CallFilters: FC<CallFiltersProps> = ({
  search,
  setSearch,
  activeFilter,
  setActiveFilter,
  intentFilter,
  setIntentFilter,
  intentOptions,
  datePreset,
  setDatePreset,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  escalatedCount = 0,
  resolvedCount = 0,
}) => {
  const FILTER_OPTIONS: { label: string; value: CallStatus | 'all' | 'flagged'; badge?: number; icon?: any }[] = [
    { label: 'All Calls', value: 'all' },
    { label: 'Escalated', value: 'escalated', badge: escalatedCount, icon: AlertTriangle },
    { label: 'Resolved', value: 'resolved', badge: resolvedCount, icon: CheckCircle },
    { label: 'Live', value: 'live' },
    { label: 'Missed', value: 'missed' },
    { label: 'Red Flag', value: 'flagged', icon: Flag },
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            size={15}
            strokeWidth={1.75}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            type="text"
            placeholder="Search by customer name, phone number, intent, or escalation reason…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-surface-card border border-border rounded-xl text-[14px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-strong transition-colors"
          />
        </div>

        <div className="relative shrink-0 sm:w-44">
          <select
            value={intentFilter}
            onChange={e => setIntentFilter(e.target.value)}
            className={selectClass}
            aria-label="Filter by intent"
          >
            <option value="all">All intents</option>
            {intentOptions.map(intent => (
              <option key={intent} value={intent}>
                {intent}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            strokeWidth={2}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
        </div>

        <div className="relative shrink-0 sm:w-44">
          <Calendar
            size={14}
            strokeWidth={2}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <select
            value={datePreset}
            onChange={e => setDatePreset(e.target.value as DateFilterPreset)}
            className={`${selectClass} pl-9`}
            aria-label="Filter by date"
          >
            {DATE_PRESETS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            strokeWidth={2}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
        </div>
      </div>

      {datePreset === 'custom' && (
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <label className="flex items-center gap-2 text-[13px] text-text-secondary">
            <span className="shrink-0">From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-2 bg-surface-card border border-border rounded-xl text-[13px] text-text-primary focus:outline-none focus:border-border-strong"
            />
          </label>
          <label className="flex items-center gap-2 text-[13px] text-text-secondary">
            <span className="shrink-0">To</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="px-3 py-2 bg-surface-card border border-border rounded-xl text-[13px] text-text-primary focus:outline-none focus:border-border-strong"
            />
          </label>
        </div>
      )}

      {/* Main Filter Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTER_OPTIONS.map(opt => {
          const Icon = opt.icon
          const isActive = activeFilter === opt.value
          const isEscalated = opt.value === 'escalated'
          
          return (
            <button
              key={opt.value}
              onClick={() => setActiveFilter(opt.value)}
              className={`px-3 py-1.5 rounded-xl text-[13px] font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
                isActive
                  ? isEscalated
                    ? 'bg-red-500 text-white border-red-500 shadow-xs'
                    : 'bg-text-primary text-surface-card border-text-primary'
                  : isEscalated && (opt.badge ?? 0) > 0
                    ? 'bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500/20'
                    : 'bg-surface-card text-text-secondary border-border hover:border-border-strong hover:text-text-primary'
              }`}
            >
              {Icon && <Icon size={13} strokeWidth={2} />}
              <span>{opt.label}</span>
              {opt.badge !== undefined && (
                <span
                  className={`px-1.5 py-0.2 text-[10px] font-mono font-bold rounded-full ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : isEscalated && opt.badge > 0
                        ? 'bg-red-500 text-white'
                        : 'bg-surface-page text-text-secondary border border-border'
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

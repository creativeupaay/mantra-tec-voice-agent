import { FC } from 'react'
import { Search, Flag } from 'lucide-react'
import { CallStatus } from '../../types/call'

interface CallFiltersProps {
  search: string
  setSearch: (val: string) => void
  activeFilter: 'all' | CallStatus | 'flagged'
  setActiveFilter: (val: 'all' | CallStatus | 'flagged') => void
}

const FILTER_OPTIONS: { label: string; value: CallStatus | 'all' | 'flagged' }[] = [
  { label: 'All Calls', value: 'all' },
  { label: 'Live', value: 'live' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Escalated', value: 'escalated' },
  { label: 'Missed', value: 'missed' },
  { label: 'Red Flag', value: 'flagged' },
]

const CallFilters: FC<CallFiltersProps> = ({ search, setSearch, activeFilter, setActiveFilter }) => {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <Search
          size={15}
          strokeWidth={1.75}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
        />
        <input
          type="text"
          placeholder="Search by name, number, or intent…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-surface-card border border-border rounded-xl text-[14px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-strong transition-colors"
        />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {FILTER_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setActiveFilter(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-colors ${
              activeFilter === opt.value
                ? 'bg-text-primary text-surface-card border-text-primary'
                : 'bg-surface-card text-text-secondary border-border hover:border-border-strong hover:text-text-primary'
            }`}
          >
            {opt.label === 'Red Flag' ? (
              <span className="flex items-center gap-1.5">
                <Flag size={12} strokeWidth={2} />
                {opt.label}
              </span>
            ) : opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default CallFilters

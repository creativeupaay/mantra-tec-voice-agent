import { FC } from 'react'
import { AudioWaveform, PhoneCall, Flag, Phone } from 'lucide-react'
import StatusDot from '../StatusDot'
import { ICall, CallStatus } from '../../types/call'
import { formatDuration, formatTime } from '../../utils/format'

interface CallTableProps {
  isLoading: boolean
  filtered: ICall[]
  selectedCall: ICall | null
  setSelectedCall: (call: ICall | null) => void
  STATUS_LABELS: Record<CallStatus, string>
}

const CallTable: FC<CallTableProps> = ({ isLoading, filtered, selectedCall, setSelectedCall, STATUS_LABELS }) => {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-text-muted">
        <div className="w-8 h-8 rounded-full border-2 border-border border-t-text-primary animate-spin mb-4" />
        <p className="text-[14px]">Loading calls...</p>
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-text-muted">
        <Phone size={32} strokeWidth={1.5} className="mb-3 opacity-40" />
        <p className="text-[14px]">No calls match your filters</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-narrow">
      <table className="w-full">
        <thead className="sticky top-0 z-10 bg-surface-card">
          <tr className="border-b border-border">
            <th className="px-6 py-3.5 text-left text-[12px] font-semibold text-text-secondary uppercase tracking-wider">Caller</th>
            {!selectedCall && <th className="px-6 py-3.5 text-left text-[12px] font-semibold text-text-secondary uppercase tracking-wider">Intent</th>}
            <th className="px-6 py-3.5 text-left text-[12px] font-semibold text-text-secondary uppercase tracking-wider">Duration</th>
            <th className="px-6 py-3.5 text-left text-[12px] font-semibold text-text-secondary uppercase tracking-wider">Status</th>
            {!selectedCall && <th className="px-6 py-3.5 text-left text-[12px] font-semibold text-text-secondary uppercase tracking-wider">Date &amp; Time</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {filtered.map(call => {
            const { date, time } = formatTime(call.timestamp)
            const isSelected = selectedCall?._id === call._id
            return (
              <tr
                key={call._id}
                onClick={() => setSelectedCall(isSelected ? null : call)}
                className={`h-[56px] cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-surface-page'
                    : 'hover:bg-surface-page'
                }`}
              >
                {/* Caller col */}
                <td className="px-6 py-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-7 h-7 rounded-full bg-surface-page border border-border flex items-center justify-center text-text-secondary shrink-0">
                      {call.status === 'live'
                        ? <PhoneCall size={13} strokeWidth={2} />
                        : <AudioWaveform size={13} strokeWidth={2} />
                      }
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[14px] font-medium text-text-primary leading-tight truncate">
                          {call.caller_name ?? call.phone_number}
                        </p>
                        {call.is_red_flag && (
                          <span title="Red flag">
                            <Flag
                              size={12}
                              strokeWidth={2}
                              className="shrink-0"
                              style={{ color: 'var(--color-status-escalated)' }}
                            />
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-text-muted leading-tight tabular-nums">
                        {call.phone_number}
                      </p>
                    </div>
                  </div>
                </td>

                {/* Intent col */}
                {!selectedCall && (
                  <td className="px-6 py-3">
                    <span className="text-[13px] text-text-secondary">
                      {call.detected_intent ?? '—'}
                    </span>
                  </td>
                )}

                {/* Duration col */}
                <td className="px-6 py-3">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[13px] text-text-secondary tabular-nums">
                      {formatDuration(call.duration)}
                    </span>
                    {call.status === 'live' && (
                      <div
                        className="w-1.5 h-1.5 rounded-full animate-live-pulse"
                        style={{ backgroundColor: 'var(--color-accent)' }}
                      />
                    )}
                  </div>
                </td>

                {/* Status col */}
                <td className="px-6 py-3">
                  <StatusDot status={call.status} label={STATUS_LABELS[call.status]} />
                </td>

                {/* Date col */}
                {!selectedCall && (
                  <td className="px-6 py-3">
                    <p className="text-[13px] text-text-secondary tabular-nums">{date}</p>
                    <p className="text-[12px] text-text-muted tabular-nums">{time}</p>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default CallTable

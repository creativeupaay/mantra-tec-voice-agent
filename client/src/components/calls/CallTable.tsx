import { FC } from 'react'
import { AudioWaveform, PhoneCall, PhoneForwarded, Flag, CheckCircle, Bot, CheckCheck, Check, CheckSquare } from 'lucide-react'
import StatusDot from '../StatusDot'
import { ICall, CallStatus } from '../../types/call'
import { formatDuration, formatTime } from '../../utils/format'

interface CallTableProps {
  isLoading: boolean
  filtered: ICall[]
  selectedCall: ICall | null
  setSelectedCall: (call: ICall | null) => void
  openModal: (title: string, content: string) => void
  STATUS_LABELS: Record<CallStatus, string>
  onResolveCall?: (callId: string) => void
  resolvingId?: string | null
  onToggleReviewed?: (call: ICall) => void
  togglingReviewedId?: string | null
}

const CallTable: FC<CallTableProps> = ({
  isLoading,
  filtered,
  selectedCall,
  setSelectedCall,
  STATUS_LABELS,
  onResolveCall,
  resolvingId,
  onToggleReviewed,
  togglingReviewedId,
}) => {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-text-muted">
        <div className="w-7 h-7 rounded-full border-2 border-border border-t-text-primary animate-spin mb-3" />
        <p className="text-[13px]">Loading calls...</p>
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-text-muted">
        <PhoneCall size={28} strokeWidth={1.5} className="mb-2 opacity-40" />
        <p className="text-[13px]">No calls match your filters</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-x-auto overflow-y-auto scrollbar-thin">
      <table className="w-full min-w-[780px] text-left border-collapse">
        <thead className="sticky top-0 z-10 bg-surface-card border-b border-border shadow-2xs">
          <tr className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
            <th className="pl-4 pr-1 py-3.5 w-[46px] text-center" title="Review Status (Read / Reviewed)">
              <div className="flex items-center justify-center">
                <CheckSquare size={14} className="text-text-muted" />
              </div>
            </th>
            <th className="px-4 py-3.5 w-[22%] text-left">Caller</th>
            <th className="px-5 py-3.5 w-[26%] text-left">Intent &amp; Category</th>
            <th className="px-4 py-3.5 w-[11%] text-left">Duration</th>
            <th className="px-4 py-3.5 w-[14%] text-left">Status</th>
            <th className="px-5 py-3.5 w-[14%] text-left">Date &amp; Time (IST)</th>
            <th className="px-5 py-3.5 w-[10%] text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {filtered.map(call => {
            const { date, time } = formatTime(call.timestamp)
            const targetId = call._id || call.call_id
            const isSelected = selectedCall?._id === call._id || selectedCall?.call_id === call.call_id
            const isEscalated = call.status === 'escalated'
            const isCallback = call.status === 'callback_required'
            const isReviewed = Boolean(call.is_reviewed)
            const isTogglingThis = togglingReviewedId === targetId

            return (
              <tr
                key={targetId}
                onClick={() => setSelectedCall(isSelected ? null : call)}
                className={`group cursor-pointer transition-colors h-[64px] ${
                  isSelected ? 'bg-surface-page/90' : isReviewed ? 'hover:bg-surface-page/40' : 'hover:bg-surface-page/60'
                }`}
              >
                {/* 0. REVIEW CHECKBOX / READ SYMBOL */}
                <td
                  className="pl-4 pr-1 py-3.5 w-[46px] align-middle text-center"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (onToggleReviewed) onToggleReviewed(call)
                  }}
                >
                  <button
                    type="button"
                    disabled={isTogglingThis}
                    title={
                      isReviewed
                        ? `Reviewed${call.reviewed_at ? ' on ' + formatTime(call.reviewed_at).date : ''} — Click to mark unreviewed`
                        : 'Mark call as reviewed (read)'
                    }
                    className={`w-6 h-6 rounded-md border flex items-center justify-center mx-auto transition-all cursor-pointer group/chk ${
                      isReviewed
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xs hover:bg-emerald-700 hover:border-emerald-700'
                        : 'bg-surface-page border-border text-text-muted hover:border-emerald-500 hover:bg-emerald-500/10'
                    } ${isTogglingThis ? 'opacity-60 pointer-events-none' : ''}`}
                    aria-label={isReviewed ? 'Mark as unreviewed' : 'Mark as reviewed'}
                  >
                    {isTogglingThis ? (
                      <div className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    ) : isReviewed ? (
                      <CheckCheck size={14} strokeWidth={2.5} />
                    ) : (
                      <Check size={12} strokeWidth={2.5} className="opacity-0 group-hover/chk:opacity-100 text-emerald-600 transition-opacity" />
                    )}
                  </button>
                </td>

                {/* 1. CALLER */}
                <td className="px-4 py-3.5 w-[22%] align-middle min-w-0">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-text-secondary shrink-0 border ${
                      isEscalated
                        ? 'bg-red-500/10 border-red-500/30 text-red-500'
                        : isCallback
                          ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-600'
                          : 'bg-surface-page border-border'
                    }`}>
                      {call.status === 'live'
                        ? <PhoneCall size={14} strokeWidth={2} />
                        : isCallback
                          ? <PhoneForwarded size={14} strokeWidth={2} />
                          : <AudioWaveform size={14} strokeWidth={2} />
                      }
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                        <p className={`text-[13px] font-bold leading-tight truncate ${isReviewed ? 'text-text-primary' : 'text-text-primary'}`}>
                          {call.caller_name || call.phone_number}
                        </p>
                        {isReviewed && (
                          <span
                            title={call.reviewed_at ? `Reviewed on ${formatTime(call.reviewed_at).date}` : 'Reviewed'}
                            className="shrink-0 inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                          >
                            <CheckCheck size={10} strokeWidth={2.5} />
                            <span>Reviewed</span>
                          </span>
                        )}
                        {(call.is_red_flag || call.is_red_flagged) && (
                          <span title="Red flag" className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
                            <Flag size={9} strokeWidth={2} />
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-text-muted font-mono leading-tight mt-0.5 truncate">
                        {call.phone_number}
                      </p>
                    </div>
                  </div>
                </td>

                {/* 2. INTENT & CATEGORY */}
                <td className="px-5 py-3.5 w-[28%] align-middle min-w-0">
                  <div className="flex flex-col justify-center min-w-0">
                    <span className="text-[12px] font-bold text-text-primary flex items-center gap-1.5 truncate" title={call.detected_intent || 'General Inquiry'}>
                      <Bot size={13} className="text-accent shrink-0" />
                      <span className="truncate">{call.detected_intent || 'General Inquiry'}</span>
                    </span>
                    <span className="text-[11px] text-text-muted capitalize truncate mt-0.5">
                      {call.call_category || 'inquiry'}
                    </span>
                  </div>
                </td>

                {/* 3. DURATION */}
                <td className="px-4 py-3.5 w-[12%] align-middle">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[12px] font-semibold text-text-secondary tabular-nums font-mono">
                      {formatDuration(call.duration)}
                    </span>
                    {call.status === 'live' && (
                      <div className="w-1.5 h-1.5 rounded-full animate-live-pulse bg-accent shrink-0" />
                    )}
                  </div>
                </td>

                {/* 4. STATUS */}
                <td className="px-4 py-3.5 w-[14%] align-middle">
                  <StatusDot status={call.status} label={STATUS_LABELS[call.status]} />
                </td>

                {/* 5. DATE & TIME */}
                <td className="px-5 py-3.5 w-[14%] align-middle font-mono text-[11px] leading-tight">
                  <div className="flex flex-col justify-center">
                    <span className="font-semibold text-text-primary">{date}</span>
                    <span className="text-[10px] text-text-muted mt-0.5">{time}</span>
                  </div>
                </td>

                {/* 6. ACTIONS */}
                <td className="px-5 py-3.5 w-[10%] align-middle text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setSelectedCall(call)}
                      className="px-3 py-1.5 text-[11px] font-semibold text-text-primary bg-surface-card hover:bg-surface-page rounded-xl border border-border transition-colors cursor-pointer shadow-2xs"
                    >
                      View Details
                    </button>

                    {(isEscalated || isCallback) && onResolveCall && (
                      <button
                        onClick={() => onResolveCall(targetId)}
                        disabled={resolvingId === targetId}
                        className="px-3 py-1.5 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-2xs transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        title={isCallback ? "Mark callback as resolved" : "Resolve call"}
                      >
                        <CheckCircle size={11} />
                        <span>{resolvingId === targetId ? 'Resolving...' : 'Resolve'}</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default CallTable

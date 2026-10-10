import { FC } from 'react'
import {
  AudioWaveform,
  PhoneCall,
  CheckCircle,
  Bot,
  CheckCheck,
  CheckSquare,
  Square,
  ChevronRight,
  Clock,
  Calendar,
  AlertTriangle,
  PhoneForwarded,
} from 'lucide-react'
import StatusDot from '../StatusDot'
import { ICall, CallStatus } from '../../types/call'
import { formatDuration, formatTime } from '../../utils/format'

interface CallTableProps {
  isLoading: boolean
  filtered: ICall[]
  selectedCall: ICall | null
  setSelectedCall: (call: ICall | null) => void
  openModal?: (title: string, content: string) => void
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
      <div className="flex flex-col items-center justify-center py-20 text-text-muted">
        <div className="w-8 h-8 rounded-full border-2 border-border border-t-text-primary animate-spin mb-3.5" />
        <p className="text-xs font-medium">Loading voice sessions…</p>
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-text-muted">
        <div className="w-12 h-12 rounded-2xl bg-surface-page border border-border flex items-center justify-center mb-3 text-text-muted">
          <PhoneCall size={20} strokeWidth={1.5} />
        </div>
        <p className="text-xs font-semibold text-text-primary mb-1">No call sessions found</p>
        <p className="text-[11px] text-text-secondary">Try adjusting your filters, intent, or date range</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-x-auto overflow-y-auto scrollbar-thin">
      <table className="w-full min-w-[760px] text-left border-collapse">
        <thead className="sticky top-0 z-10 bg-surface-card/95 backdrop-blur-xs border-b border-border shadow-2xs">
          <tr className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
            <th className="pl-4 pr-1 py-3 w-[44px] text-center" title="Review Status">
              <span className="sr-only">Reviewed</span>
            </th>
            <th className="px-4 py-3 w-[24%] text-left">Caller Session</th>
            <th className="px-4 py-3 w-[25%] text-left">Intent &amp; Classification</th>
            <th className="px-3 py-3 w-[10%] text-left">Duration</th>
            <th className="px-4 py-3 w-[14%] text-left">Status</th>
            <th className="px-4 py-3 w-[15%] text-left">Timestamp (IST)</th>
            <th className="px-4 py-3 w-[12%] text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">
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
                className={`group cursor-pointer transition-all h-[62px] ${
                  isSelected
                    ? 'bg-surface-page border-l-2 border-l-text-primary'
                    : isReviewed
                      ? 'hover:bg-surface-page/50'
                      : 'hover:bg-surface-page/80 bg-surface-card'
                }`}
              >
                {/* 0. REVIEW CHECKBOX / READ TOGGLE */}
                <td
                  className="pl-4 pr-1 py-3 w-[44px] align-middle text-center"
                  onClick={e => {
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
                    className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                      isReviewed
                        ? 'text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30'
                        : 'text-text-muted hover:text-text-primary hover:bg-surface-page border border-border'
                    } ${isTogglingThis ? 'opacity-40 pointer-events-none' : ''}`}
                  >
                    {isTogglingThis ? (
                      <div className="w-2.5 h-2.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    ) : isReviewed ? (
                      <CheckCheck size={13} strokeWidth={2.5} />
                    ) : (
                      <Square size={12} strokeWidth={2} className="opacity-60" />
                    )}
                  </button>
                </td>

                {/* 1. CALLER INFO */}
                <td className="px-4 py-3 align-middle">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-xl bg-surface-page border border-border flex items-center justify-center text-text-primary shrink-0 group-hover:border-text-primary/30 transition-colors shadow-2xs">
                      <AudioWaveform size={14} strokeWidth={2} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-text-primary truncate leading-snug">
                        {call.caller_name || 'Anonymous Caller'}
                      </p>
                      <p className="text-[11px] text-text-muted font-mono leading-none mt-0.5">
                        {call.phone_number || 'No number'}
                      </p>
                    </div>
                  </div>
                </td>

                {/* 2. INTENT & CATEGORY */}
                <td className="px-4 py-3 align-middle">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-xs font-medium text-text-primary truncate flex items-center gap-1.5">
                      <Bot size={12} className="text-text-muted shrink-0" />
                      <span className="truncate">{call.detected_intent || 'General Query'}</span>
                    </span>
                    <span className="text-[10px] font-medium text-text-muted capitalize">
                      {call.call_category || 'Inquiry'}
                    </span>
                  </div>
                </td>

                {/* 3. DURATION */}
                <td className="px-3 py-3 align-middle">
                  <span className="text-xs font-mono font-medium text-text-primary tabular-nums">
                    {formatDuration(call.duration)}
                  </span>
                </td>

                {/* 4. STATUS */}
                <td className="px-4 py-3 align-middle">
                  <div className="flex items-center">
                    <StatusDot
                      status={call.status}
                      label={STATUS_LABELS[call.status] || call.status}
                    />
                  </div>
                </td>

                {/* 5. TIMESTAMP (IST) */}
                <td className="px-4 py-3 align-middle font-mono text-xs text-text-secondary tabular-nums">
                  <div className="leading-tight">
                    <span className="text-text-primary font-medium">{date}</span>
                    <span className="text-text-muted text-[10px] ml-1.5">{time}</span>
                  </div>
                </td>

                {/* 6. ACTIONS */}
                <td className="px-4 py-3 align-middle text-right" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-end space-x-1">
                    {/* Quick Resolve Button if Escalated or Callback Required */}
                    {(isEscalated || isCallback) && onResolveCall && (
                      <button
                        type="button"
                        onClick={() => onResolveCall(targetId)}
                        disabled={resolvingId === targetId}
                        className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors flex items-center gap-1 cursor-pointer"
                        title="Mark call as resolved"
                      >
                        <CheckCircle size={11} />
                        <span>Resolve</span>
                      </button>
                    )}

                    {/* Open Detail Panel Button */}
                    <button
                      type="button"
                      onClick={() => setSelectedCall(isSelected ? null : call)}
                      className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-page transition-colors cursor-pointer"
                      title="Open session details"
                    >
                      <ChevronRight size={15} strokeWidth={2} />
                    </button>
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

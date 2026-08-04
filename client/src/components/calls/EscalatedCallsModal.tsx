import { FC, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  Phone,
  Calendar,
  FileText,
  MessageSquare,
  X,
  Search,
  Bot,
  ExternalLink,
} from 'lucide-react'

interface EscalatedCall {
  _id: string
  call_id?: string
  caller_name?: string
  phone_number: string
  call_summary?: string
  detected_intent?: string
  status: string
  timestamp: string
  is_red_flag?: boolean
  is_red_flagged?: boolean
  duration?: number
  transcript?: string
  red_flag_reason?: string
  guardrail_triggered?: string
  call_category?: string
  assigned_agent?: string
}

interface EscalatedCallsModalProps {
  isOpen: boolean
  onClose: () => void
  calls: EscalatedCall[]
  onResolveCall: (callId: string) => Promise<void>
  resolvingId: string | null
}

export const EscalatedCallsModal: FC<EscalatedCallsModalProps> = ({
  isOpen,
  onClose,
  calls,
  onResolveCall,
  resolvingId,
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null)
  const [confirmCall, setConfirmCall] = useState<EscalatedCall | null>(null)

  if (!isOpen) return null

  const formatDuration = (seconds?: number) => {
    if (seconds === undefined || seconds === null) return 'In Progress'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  const formatTimestamp = (ts: string) => {
    if (!ts) return 'Unknown date'
    let str = ts.trim()
    if (str.includes('T') && !str.endsWith('Z') && !str.includes('+') && !str.includes('-')) {
      str += 'Z'
    }
    const date = new Date(str)
    if (isNaN(date.getTime())) return 'Unknown date'
    return date.toLocaleString('en-IN', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    })
  }

  const filteredCalls = calls.filter((c) => {
    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase()
    return (
      (c.caller_name || '').toLowerCase().includes(term) ||
      (c.phone_number || '').toLowerCase().includes(term) ||
      (c.detected_intent || '').toLowerCase().includes(term) ||
      (c.call_summary || '').toLowerCase().includes(term) ||
      (c.red_flag_reason || '').toLowerCase().includes(term)
    )
  })

  const handleConfirmResolve = async () => {
    if (!confirmCall) return
    await onResolveCall(confirmCall._id)
    setConfirmCall(null)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      {/* Backdrop click */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Drawer Container */}
      <div className="relative w-full max-w-3xl bg-surface-card border-l border-border h-full flex flex-col shadow-2xl z-10">
        {/* Header */}
        <div className="p-6 border-b border-border bg-surface-card sticky top-0 z-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-status-escalated/10 border border-status-escalated/20 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-status-escalated" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-text-primary">Escalated Calls</h2>
                <span className="px-2.5 py-0.5 text-xs font-mono font-semibold rounded-full bg-status-escalated/15 text-status-escalated">
                  {calls.length} pending
                </span>
              </div>
              <p className="text-xs text-text-secondary mt-0.5">
                All voice calls flagged for manual review, priority resolution, or agent escalation.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-text-secondary hover:text-text-primary hover:bg-surface-page rounded-lg transition-colors cursor-pointer"
            title="Close Drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-4 border-b border-border bg-surface-page/50 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search escalated calls by caller, phone, intent, or reason..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs bg-surface-card border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary text-xs"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Call List Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
          {filteredCalls.length === 0 ? (
            <div className="py-20 text-center bg-surface-page/40 rounded-2xl border border-dashed border-border p-8">
              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3 opacity-90" />
              <h3 className="text-base font-semibold text-text-primary">No escalated calls 🎉</h3>
              <p className="text-xs text-text-secondary mt-1 max-w-sm mx-auto">
                {searchTerm
                  ? 'No escalated calls match your current search query.'
                  : 'All customer voice calls have been handled smoothly or resolved.'}
              </p>
            </div>
          ) : (
            filteredCalls.map((call) => {
              const isExpanded = expandedCallId === call._id
              const escalationReason =
                call.red_flag_reason ||
                call.guardrail_triggered ||
                (call.detected_intent ? `Intent: ${call.detected_intent}` : 'AI Guardrail / Negative Sentiment Triggered')

              return (
                <div
                  key={call._id}
                  className="bg-surface-card border border-border hover:border-border-strong rounded-2xl p-5 shadow-xs transition-all space-y-4"
                >
                  {/* Top Bar: Caller & Status */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/70">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-base text-text-primary flex items-center gap-2">
                          <User className="w-4 h-4 text-text-muted shrink-0" />
                          {call.caller_name || 'Anonymous Caller'}
                        </span>
                        <span className="text-xs font-mono text-text-secondary flex items-center gap-1">
                          <Phone className="w-3 h-3 text-text-muted" />
                          {call.phone_number}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-text-muted font-mono pt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-text-muted" />
                          {formatTimestamp(call.timestamp)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-text-muted" />
                          {formatDuration(call.duration)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center">
                      <span className="px-3 py-1 text-xs font-semibold rounded-full bg-status-escalated/15 text-status-escalated flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-status-escalated animate-pulse" />
                        Escalated
                      </span>
                      <button
                        onClick={() => setConfirmCall(call)}
                        disabled={resolvingId === call._id}
                        className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        {resolvingId === call._id ? 'Resolving...' : 'Resolve'}
                      </button>
                    </div>
                  </div>

                  {/* Metadata Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="bg-surface-page/60 rounded-xl p-3 border border-border/80">
                      <p className="font-medium text-text-secondary mb-1 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-status-escalated" />
                        Escalation Reason
                      </p>
                      <p className="font-semibold text-text-primary leading-tight">{escalationReason}</p>
                    </div>

                    <div className="bg-surface-page/60 rounded-xl p-3 border border-border/80">
                      <p className="font-medium text-text-secondary mb-1 flex items-center gap-1.5">
                        <Bot className="w-3.5 h-3.5 text-accent" />
                        Assigned Agent & Intent
                      </p>
                      <p className="font-semibold text-text-primary capitalize">
                        {call.assigned_agent || 'Mantra AI Voice Agent'}{' '}
                        <span className="text-text-muted font-normal">
                          ({call.detected_intent || call.call_category || 'Inquiry'})
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* AI Call Summary */}
                  <div className="bg-surface-page/40 rounded-xl p-4 border border-border">
                    <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-text-muted" />
                      AI Call Summary
                    </p>
                    <p className="text-xs text-text-primary leading-relaxed whitespace-pre-wrap">
                      {call.call_summary || 'No call summary recorded for this session.'}
                    </p>
                  </div>

                  {/* Transcript Expand/Collapse */}
                  {call.transcript && (
                    <div className="pt-1">
                      <button
                        onClick={() => setExpandedCallId(isExpanded ? null : call._id)}
                        className="text-xs font-medium text-accent hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        {isExpanded ? 'Hide Call Transcript' : 'View Full Call Transcript'}
                      </button>

                      {isExpanded && (
                        <div className="mt-3 bg-surface-page rounded-xl p-4 border border-border max-h-60 overflow-y-auto scrollbar-thin font-mono text-[11px] leading-relaxed text-text-primary whitespace-pre-wrap">
                          {call.transcript}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      {confirmCall && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-status-escalated">
              <div className="w-10 h-10 rounded-xl bg-status-escalated/10 flex items-center justify-center shrink-0">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary">Confirm Resolution</h3>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              Are you sure you want to mark the call from{' '}
              <strong className="text-text-primary font-semibold">
                {confirmCall.caller_name || confirmCall.phone_number}
              </strong>{' '}
              as resolved? It will be moved immediately to Resolved Calls and removed from the active Escalated feed.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmCall(null)}
                className="px-4 py-2 text-xs font-medium text-text-secondary hover:text-text-primary bg-surface-page hover:bg-border/40 rounded-xl border border-border transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmResolve}
                disabled={resolvingId === confirmCall._id}
                className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {resolvingId === confirmCall._id ? 'Resolving...' : 'Confirm Resolution'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

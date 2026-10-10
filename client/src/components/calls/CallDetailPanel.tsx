import { FC, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Printer,
  X,
  Calendar,
  Clock,
  AlertTriangle,
  Maximize2,
  CheckCircle,
  UserCheck,
  Bot,
  Phone,
  Sparkles,
  Package,
  FileText,
  PhoneForwarded,
  CheckCheck,
  CheckSquare,
  Copy,
  Check,
  Flag,
  User,
  AudioWaveform,
} from 'lucide-react'
import StatusDot from '../StatusDot'
import { ICall, CallStatus } from '../../types/call'
import { formatDuration, formatTime } from '../../utils/format'
import AudioPlayer from './AudioPlayer'

interface CallDetailPanelProps {
  selectedCall: ICall
  setSelectedCall: (call: ICall | null) => void
  openModal?: (title: string, content: string) => void
  STATUS_LABELS: Record<CallStatus, string>
  onResolveCall?: (callId: string) => void
  resolvingId?: string | null
  onToggleReviewed?: (call: ICall) => void
  togglingReviewedId?: string | null
}

interface BulkDetailItem {
  label: string
  value: string
}

function getBulkOrderDetails(call: ICall): BulkDetailItem[] {
  const summary = call.call_summary || ''
  const transcript = call.transcript || ''

  const findValue = (regexes: RegExp[]): string => {
    for (const regex of regexes) {
      const match = summary.match(regex) || transcript.match(regex)
      if (match && match[1]) {
        const val = match[1].trim().replace(/^[-:•\s]+/, '').replace(/[-:•\s]+$/, '')
        const lower = val.toLowerCase()
        if (
          val &&
          !['n/a', 'not mentioned', 'none', 'not provided', 'null', 'undefined', 'not specified', 'unknown'].includes(lower)
        ) {
          return val
        }
      }
    }
    return ''
  }

  const rawFields: { label: string; value: string }[] = [
    {
      label: 'Customer Name',
      value:
        findValue([
          /Customer Name:\s*([^\n\r]+)/i,
          /Customer:\s*([^\n\r]+)/i,
          /Name:\s*([^\n\r]+)/i,
          /caller name[:\s]+([^\n\r,.]+)/i,
        ]) || call.caller_name || '',
    },
    {
      label: 'Organisation',
      value: findValue([
        /Organisation Name:\s*([^\n\r]+)/i,
        /Organisation:\s*([^\n\r]+)/i,
        /Company Name:\s*([^\n\r]+)/i,
        /Company:\s*([^\n\r]+)/i,
        /from\s+([A-Z0-9\s.&-]+(?:Pvt|Ltd|Inc|Tech|Corp|Technologies|Solutions|Enterprise)?)/i,
      ]),
    },
    {
      label: 'Email',
      value: findValue([
        /Email Address:\s*([^\n\r]+)/i,
        /Email:\s*([^\n\r]+)/i,
        /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
      ]),
    },
    {
      label: 'Phone Number',
      value: call.phone_number || '',
    },
    {
      label: 'Location',
      value: findValue([
        /Location:\s*([^\n\r]+)/i,
        /City:\s*([^\n\r]+)/i,
        /State:\s*([^\n\r]+)/i,
        /in\s+([A-Z][a-z]+(?:\s*,\s*[A-Z][a-z]+)?)/,
      ]),
    },
    {
      label: 'Product Requested',
      value: findValue([
        /Product Requested:\s*([^\n\r]+)/i,
        /Product Name:\s*([^\n\r]+)/i,
        /Product:\s*([^\n\r]+)/i,
        /for\s+([0-9]+\s+[A-Za-z0-9\s]+(?:devices|scanners|readers|tablets|units)?)/i,
      ]),
    },
    {
      label: 'Quantity',
      value: findValue([
        /Required Quantity:\s*([^\n\r]+)/i,
        /Quantity:\s*([^\n\r]+)/i,
        /([0-9]+\s*(?:Units|Units\.|devices|pieces|scanners|pcs))/i,
      ]),
    },
    {
      label: 'Organisation Type',
      value: findValue([
        /Organisation Type:\s*([^\n\r]+)/i,
        /Org Type:\s*([^\n\r]+)/i,
        /(Government\s*(?:Tender|Org|Sector|Department)?|Private\s*(?:Ltd|Company|Sector)?)/i,
      ]),
    },
    {
      label: 'Additional Requirements',
      value: findValue([
        /Additional Requirement[s]?:\s*([^\n\r]+)/i,
        /Requirement[s]?:\s*([^\n\r]+)/i,
      ]),
    },
  ]

  return rawFields.filter(f => f.value && f.value.trim().length > 0)
}

// Helper to format dialogue transcript turns
interface DialogueTurn {
  speaker: 'agent' | 'user' | 'system'
  speakerName: string
  text: string
}

const parseTranscript = (raw: string): DialogueTurn[] => {
  if (!raw) return []
  const lines = raw.split(/\r?\n/).filter(line => line.trim().length > 0)
  const turns: DialogueTurn[] = []

  const speakerRegex = /^(AI|Assistant|Agent|Bot|Customer|Caller|User|Human):\s*(.*)$/i

  lines.forEach(line => {
    const match = line.match(speakerRegex)
    if (match) {
      const rawRole = match[1].toLowerCase()
      const isAgent = ['ai', 'assistant', 'agent', 'bot'].includes(rawRole)
      turns.push({
        speaker: isAgent ? 'agent' : 'user',
        speakerName: isAgent ? 'Voice Agent' : 'Customer',
        text: match[2].trim(),
      })
    } else {
      // If continuing last turn or unlabelled
      if (turns.length > 0) {
        turns[turns.length - 1].text += ' ' + line.trim()
      } else {
        turns.push({
          speaker: 'system',
          speakerName: 'Transcript',
          text: line.trim(),
        })
      }
    }
  })

  return turns
}

export const CallDetailPanel: FC<CallDetailPanelProps> = ({
  selectedCall,
  setSelectedCall,
  openModal,
  STATUS_LABELS,
  onResolveCall,
  resolvingId,
  onToggleReviewed,
  togglingReviewedId,
}) => {
  const [copiedSummary, setCopiedSummary] = useState(false)
  const [showRawTranscript, setShowRawTranscript] = useState(false)

  const targetId = selectedCall._id || selectedCall.call_id
  const isEscalated = selectedCall.status === 'escalated'
  const isCallbackRequired = selectedCall.status === 'callback_required'
  const isReviewed = Boolean(selectedCall.is_reviewed)
  const isTogglingReviewed = togglingReviewedId === targetId

  const escalationReason =
    selectedCall.red_flag_reason ||
    selectedCall.guardrail_triggered ||
    (selectedCall.detected_intent
      ? `Intent: ${selectedCall.detected_intent}`
      : 'AI Guardrail / Negative Sentiment Triggered')

  const assignedAgent =
    (selectedCall as any).assigned_agent ||
    (selectedCall as any).agent_name ||
    'AI Voice Agent'

  const summaryText = selectedCall.call_summary || ''
  const transcriptText = selectedCall.transcript || ''
  const intentText = selectedCall.detected_intent || ''

  const isBulkCall =
    summaryText.trim().startsWith('BULK') ||
    summaryText.toLowerCase().includes('bulk') ||
    summaryText.toLowerCase().includes('quotation') ||
    summaryText.toLowerCase().includes('rfq') ||
    summaryText.toLowerCase().includes('wholesale') ||
    intentText.toLowerCase().includes('bulk') ||
    intentText.toLowerCase().includes('quotation') ||
    intentText.toLowerCase().includes('rfq') ||
    transcriptText.toLowerCase().includes('bulk') ||
    transcriptText.toLowerCase().includes('quotation') ||
    transcriptText.toLowerCase().includes('rfq')

  const bulkDetails = isBulkCall ? getBulkOrderDetails(selectedCall) : []
  const displaySummary = summaryText
    ? summaryText.replace(/^BULK\s*/i, '').trim()
    : 'No AI call summary was generated for this session.'

  const dialogueTurns = parseTranscript(transcriptText)

  const handleCopySummary = () => {
    if (!displaySummary) return
    navigator.clipboard.writeText(displaySummary)
    setCopiedSummary(true)
    setTimeout(() => setCopiedSummary(false), 2000)
  }

  return (
    <div className="w-full h-full bg-surface-card border-l border-border flex flex-col overflow-hidden shadow-2xl font-sans">
      {/* ── 1. ElevenLabs Studio Header ─────────────────────────────── */}
      <div className="px-5 py-4 border-b border-border bg-surface-card/95 backdrop-blur-xs flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="text-sm font-bold text-text-primary truncate">
              {selectedCall.caller_name || 'Caller Session'}
            </h3>

            {isReviewed && (
              <span
                title={
                  selectedCall.reviewed_at
                    ? `Reviewed on ${formatTime(selectedCall.reviewed_at).date}`
                    : 'Reviewed'
                }
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
              >
                <CheckCheck size={11} strokeWidth={2.5} />
                Reviewed
              </span>
            )}

            {(selectedCall.is_red_flag || selectedCall.is_red_flagged) && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-500 border border-red-500/20">
                <Flag size={10} strokeWidth={2} />
                Red Flag
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-text-muted font-mono">
            <Phone size={12} className="text-text-muted" />
            <span>{selectedCall.phone_number || 'Unknown number'}</span>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 shrink-0">
          {/* Quick Mark Reviewed Button */}
          {onToggleReviewed && (
            <button
              type="button"
              onClick={() => onToggleReviewed(selectedCall)}
              disabled={isTogglingReviewed}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                isReviewed
                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'bg-surface-card text-text-secondary border-border hover:border-emerald-500 hover:text-emerald-600'
              } ${isTogglingReviewed ? 'opacity-60 pointer-events-none' : ''}`}
              title={isReviewed ? 'Click to mark unreviewed' : 'Mark call as reviewed (read)'}
            >
              {isTogglingReviewed ? (
                <div className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
              ) : isReviewed ? (
                <CheckCheck size={13} strokeWidth={2.5} />
              ) : (
                <CheckSquare size={13} strokeWidth={2} />
              )}
              <span>{isReviewed ? 'Reviewed' : 'Mark Reviewed'}</span>
            </button>
          )}

          <Link
            to={`/calls/${selectedCall._id}/report`}
            target="_blank"
            className="p-1.5 rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface-page border border-transparent hover:border-border transition-colors"
            title="View Full Report / Print"
          >
            <Printer size={15} strokeWidth={2} />
          </Link>

          <button
            onClick={() => setSelectedCall(null)}
            className="p-1.5 rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface-page border border-transparent hover:border-border transition-colors cursor-pointer"
            title="Close Panel"
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* ── 2. Urgency Action Banners ────────────────────────────────── */}
      {isEscalated && onResolveCall && (
        <div className="px-5 py-3 bg-red-500/10 border-b border-red-500/20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <span className="text-xs font-bold text-red-600 truncate">
              Escalated Call — Customer Needs Follow-up
            </span>
          </div>
          <button
            onClick={() => onResolveCall(targetId)}
            disabled={resolvingId === targetId}
            className="px-3 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
          >
            <CheckCircle size={13} />
            <span>{resolvingId === targetId ? 'Resolving...' : 'Resolve Call'}</span>
          </button>
        </div>
      )}

      {isCallbackRequired && onResolveCall && (
        <div className="px-5 py-3 bg-indigo-500/10 border-b border-indigo-500/20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <PhoneForwarded className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="text-xs font-bold text-indigo-600 truncate">
              Callback Required — Pending Customer Follow-up
            </span>
          </div>
          <button
            onClick={() => onResolveCall(targetId)}
            disabled={resolvingId === targetId}
            className="px-3 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
          >
            <CheckCircle size={13} />
            <span>{resolvingId === targetId ? 'Resolving...' : 'Mark Resolved'}</span>
          </button>
        </div>
      )}

      {/* ── 3. Scrollable Studio Inspector Body ──────────────────────── */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4 space-y-4">
        {/* Audio Player Studio */}
        {Boolean(selectedCall.recording_url || selectedCall.recording_path) && (
          <div>
            <AudioPlayer
              callDbId={selectedCall._id}
              callId={selectedCall.call_id}
              title={`Call Audio - ${selectedCall.caller_name || selectedCall.phone_number}`}
              showFullscreen
            />
          </div>
        )}

        {/* AI Call Summary Card */}
        <div className="bg-surface-page/70 border border-border rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
              <Sparkles size={13} className="text-accent" />
              <span>AI Call Summary</span>
            </h4>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleCopySummary}
                className="text-[11px] font-medium text-text-muted hover:text-text-primary transition-colors flex items-center gap-1 cursor-pointer"
                title="Copy Summary"
              >
                {copiedSummary ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                <span>{copiedSummary ? 'Copied' : 'Copy'}</span>
              </button>
              {openModal && (
                <button
                  onClick={() => openModal('AI Call Summary', displaySummary)}
                  className="text-[11px] font-medium text-text-muted hover:text-text-primary transition-colors flex items-center gap-1 cursor-pointer"
                  title="Expand"
                >
                  <Maximize2 size={11} />
                </button>
              )}
            </div>
          </div>
          <div className="bg-surface-card border border-border/80 rounded-xl p-3.5 text-xs text-text-primary leading-relaxed whitespace-pre-wrap font-sans">
            {displaySummary}
          </div>
        </div>

        {/* Bulk Order Details (if bulk quotation detected) */}
        {isBulkCall && bulkDetails.length > 0 && (
          <div className="bg-surface-page/70 border border-accent/20 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-text-primary">
              <Package size={14} className="text-accent" />
              <span>Bulk Order Quotation Specs</span>
            </div>

            <div className="bg-surface-card border border-border/80 rounded-xl divide-y divide-border/60 text-xs overflow-hidden">
              {bulkDetails.map((item, idx) => (
                <div key={idx} className="flex items-start justify-between p-2.5 gap-3">
                  <span className="text-text-muted font-medium shrink-0 min-w-[130px]">
                    {item.label}:
                  </span>
                  <span className="text-text-primary font-semibold text-right break-words max-w-[240px]">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Escalation Reason (if applicable) */}
        {isEscalated && (
          <div className="bg-red-500/10 border border-red-500/25 rounded-2xl p-4 space-y-1.5">
            <p className="text-[11px] font-bold text-red-600 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle size={13} />
              Escalation Trigger
            </p>
            <p className="text-xs text-text-primary leading-relaxed font-medium">
              {escalationReason}
            </p>
          </div>
        )}

        {/* ElevenLabs Script Dialogue / Transcript Viewer */}
        {selectedCall.transcript && (
          <div className="bg-surface-page/70 border border-border rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
                <FileText size={13} className="text-text-muted" />
                <span>Call Script &amp; Dialogue</span>
              </h4>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowRawTranscript(!showRawTranscript)}
                  className="text-[10px] font-semibold text-text-muted hover:text-text-primary cursor-pointer px-2 py-0.5 rounded bg-surface-card border border-border"
                >
                  {showRawTranscript ? 'Formatted' : 'Raw'}
                </button>
                {openModal && (
                  <button
                    onClick={() => openModal('Full Call Transcript', selectedCall.transcript!)}
                    className="text-[11px] font-medium text-text-muted hover:text-text-primary transition-colors flex items-center gap-1 cursor-pointer"
                    title="Full View"
                  >
                    <Maximize2 size={11} />
                  </button>
                )}
              </div>
            </div>

            {showRawTranscript ? (
              <div className="bg-surface-card border border-border/80 rounded-xl p-3 max-h-56 overflow-y-auto scrollbar-thin text-xs text-text-primary leading-relaxed whitespace-pre-wrap font-sans">
                {selectedCall.transcript}
              </div>
            ) : (
              <div className="bg-surface-card border border-border/80 rounded-xl p-3.5 max-h-64 overflow-y-auto scrollbar-thin space-y-3">
                {dialogueTurns.map((turn, idx) => {
                  const isAgent = turn.speaker === 'agent'
                  return (
                    <div key={idx} className="flex items-start gap-2.5 text-xs">
                      <div
                        className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                          isAgent
                            ? 'bg-text-primary text-surface-card'
                            : 'bg-surface-page border border-border text-text-secondary'
                        }`}
                        title={turn.speakerName}
                      >
                        {isAgent ? (
                          <AudioWaveform size={12} strokeWidth={2.5} />
                        ) : (
                          <User size={12} strokeWidth={2} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="font-semibold text-[11px] text-text-secondary">
                            {turn.speakerName}
                          </span>
                        </div>
                        <p className="text-text-primary leading-relaxed font-sans">{turn.text}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Technical Overview & Classification Grid */}
        <div className="bg-surface-page/70 border border-border rounded-2xl p-4 space-y-3">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
            Session Details &amp; Metadata
          </h4>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-text-muted text-[11px] mb-0.5">Status</p>
              <StatusDot status={selectedCall.status} label={STATUS_LABELS[selectedCall.status]} />
            </div>

            <div>
              <p className="text-text-muted text-[11px] mb-0.5">Assigned Agent</p>
              <p className="font-semibold text-text-primary flex items-center gap-1">
                <UserCheck size={12} className="text-accent" />
                <span className="truncate">{assignedAgent}</span>
              </p>
            </div>

            <div>
              <p className="text-text-muted text-[11px] mb-0.5">Detected Intent</p>
              <p className="font-semibold text-text-primary flex items-center gap-1">
                <Bot size={12} className="text-text-muted" />
                <span className="truncate">{selectedCall.detected_intent || 'General Query'}</span>
              </p>
            </div>

            <div>
              <p className="text-text-muted text-[11px] mb-0.5">Call Category</p>
              <span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-surface-card border border-border rounded-md capitalize text-text-primary">
                {selectedCall.call_category || 'Inquiry'}
              </span>
            </div>

            <div>
              <p className="text-text-muted text-[11px] mb-0.5">Date (IST)</p>
              <p className="font-medium text-text-primary flex items-center gap-1 font-mono text-[11px]">
                <Calendar size={11} className="text-text-muted" />
                {formatTime(selectedCall.timestamp).date}
              </p>
            </div>

            <div>
              <p className="text-text-muted text-[11px] mb-0.5">Time (IST)</p>
              <p className="font-medium text-text-primary flex items-center gap-1 font-mono text-[11px]">
                <Clock size={11} className="text-text-muted" />
                {formatTime(selectedCall.timestamp).time}
              </p>
            </div>

            <div>
              <p className="text-text-muted text-[11px] mb-0.5">Duration</p>
              <p className="font-semibold text-text-primary font-mono tabular-nums">
                {formatDuration(selectedCall.duration)}
              </p>
            </div>

            <div>
              <p className="text-text-muted text-[11px] mb-0.5">Call ID</p>
              <p className="font-mono text-[10px] text-text-muted truncate" title={selectedCall.call_id}>
                {selectedCall.call_id}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CallDetailPanel

import { FC } from 'react'
import { Link } from 'react-router-dom'
import { Flag, Printer, X, Calendar, Clock, AlertTriangle, Maximize2, CheckCircle, UserCheck, Bot, Phone, Sparkles, Package, FileText } from 'lucide-react'
import StatusDot from '../StatusDot'
import { ICall, CallStatus } from '../../types/call'
import { formatDuration, formatTime } from '../../utils/format'
import AudioPlayer from './AudioPlayer'

interface CallDetailPanelProps {
  selectedCall: ICall
  setSelectedCall: (call: ICall | null) => void
  openModal: (title: string, content: string) => void
  STATUS_LABELS: Record<CallStatus, string>
  onResolveCall?: (callId: string) => void
  resolvingId?: string | null
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

export const CallDetailPanel: FC<CallDetailPanelProps> = ({
  selectedCall,
  setSelectedCall,
  openModal,
  STATUS_LABELS,
  onResolveCall,
  resolvingId,
}) => {
  const targetId = selectedCall._id || selectedCall.call_id
  const isEscalated = selectedCall.status === 'escalated'
  const escalationReason =
    selectedCall.red_flag_reason ||
    selectedCall.guardrail_triggered ||
    (selectedCall.detected_intent ? `Intent: ${selectedCall.detected_intent}` : 'AI Guardrail / Negative Sentiment Triggered')

  const assignedAgent = (selectedCall as any).assigned_agent || (selectedCall as any).agent_name || 'AI Voice Agent'

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

  return (
    <div className="w-full h-full bg-surface-card border-l border-border flex flex-col overflow-hidden shadow-2xl">
      {/* 1. Panel Header */}
      <div className="flex items-start justify-between px-6 py-5 border-b border-border bg-surface-card">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-bold text-text-primary truncate">
              {selectedCall.caller_name || selectedCall.phone_number}
            </h3>
            {(selectedCall.is_red_flag || selectedCall.is_red_flagged) && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-500 border border-red-500/20">
                <Flag size={10} strokeWidth={2} />
                Red Flag
              </span>
            )}
          </div>
          <p className="text-xs text-text-muted font-mono flex items-center gap-1.5">
            <Phone size={12} className="text-text-muted" />
            {selectedCall.phone_number}
          </p>
        </div>
        <div className="flex items-center space-x-1 shrink-0">
          <Link
            to={`/calls/${selectedCall._id}/report`}
            target="_blank"
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-page transition-colors"
            title="View Full Report / Print"
          >
            <Printer size={16} strokeWidth={2} />
          </Link>
          <button
            onClick={() => setSelectedCall(null)}
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-page transition-colors cursor-pointer"
            title="Close Panel"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* 2. Escalated Resolution Banner */}
      {isEscalated && onResolveCall && (
        <div className="px-6 py-3.5 bg-red-500/10 border-b border-red-500/20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <span className="text-xs font-bold text-red-500 truncate">Escalated Call Pending Action</span>
          </div>
          <button
            onClick={() => onResolveCall(targetId)}
            disabled={resolvingId === targetId}
            className="px-3.5 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-2xs transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
          >
            <CheckCircle size={14} />
            <span>{resolvingId === targetId ? 'Resolving...' : 'Resolve Call'}</span>
          </button>
        </div>
      )}

      {/* 3. Body Content (Structured Card Sections) */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5 space-y-5">
        
        {/* CARD SECTION A: Overview Metrics */}
        <div className="bg-surface-page/60 border border-border rounded-xl p-4 space-y-3">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Call Overview</h4>
          
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-text-muted mb-0.5">Status</p>
              <StatusDot status={selectedCall.status} label={STATUS_LABELS[selectedCall.status]} />
            </div>
            <div>
              <p className="text-text-muted mb-0.5">Assigned Agent</p>
              <p className="font-semibold text-text-primary flex items-center gap-1">
                <UserCheck size={13} className="text-accent" />
                {assignedAgent}
              </p>
            </div>
            <div>
              <p className="text-text-muted mb-0.5">Call Date (IST)</p>
              <p className="font-medium text-text-primary flex items-center gap-1 font-mono">
                <Calendar size={12} className="text-text-muted" />
                {formatTime(selectedCall.timestamp).date}
              </p>
            </div>
            <div>
              <p className="text-text-muted mb-0.5">Call Time (IST)</p>
              <p className="font-medium text-text-primary flex items-center gap-1 font-mono">
                <Clock size={12} className="text-text-muted" />
                {formatTime(selectedCall.timestamp).time}
              </p>
            </div>
            <div>
              <p className="text-text-muted mb-0.5">Duration</p>
              <p className="font-semibold text-text-primary font-mono tabular-nums">
                {formatDuration(selectedCall.duration)}
              </p>
            </div>
            <div>
              <p className="text-text-muted mb-0.5">Call Category</p>
              <span className="inline-block px-2 py-0.5 text-[11px] font-semibold bg-surface-card border border-border rounded-md capitalize text-text-primary">
                {selectedCall.call_category || 'inquiry'}
              </span>
            </div>
          </div>
        </div>

        {/* CARD SECTION B: Intent & Outcome */}
        <div className="bg-surface-page/60 border border-border rounded-xl p-4 space-y-2">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Intent &amp; Classification</h4>
          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-text-muted">Detected Intent:</span>
            <span className="font-semibold text-text-primary flex items-center gap-1">
              <Bot size={13} className="text-accent" />
              {selectedCall.detected_intent || 'General Inquiry'}
            </span>
          </div>
          {selectedCall.call_outcome && (
            <div className="flex items-center justify-between text-xs border-t border-border/60 pt-2">
              <span className="text-text-muted">Call Outcome:</span>
              <span className="font-medium text-text-primary capitalize">
                {selectedCall.call_outcome.replace(/_/g, ' ')}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between text-[11px] text-text-muted border-t border-border/60 pt-2 font-mono">
            <span>Call ID:</span>
            <span className="truncate max-w-[200px]">{selectedCall.call_id}</span>
          </div>
        </div>

        {/* CARD SECTION C: Escalation Reason (if applicable) */}
        {isEscalated && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 space-y-1">
            <p className="text-[11px] font-bold text-red-500 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle size={13} />
              Escalation Reason
            </p>
            <p className="text-xs text-text-primary leading-relaxed font-medium">
              {escalationReason}
            </p>
          </div>
        )}

        {/* CARD SECTION D: AI Call Summary */}
        <div className="bg-surface-page/60 border border-border rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
              <Sparkles size={13} className="text-accent" />
              AI Call Summary
            </h4>
            {selectedCall.call_summary && (
              <button
                onClick={() => openModal('AI Call Summary', displaySummary)}
                className="text-[11px] text-accent hover:underline flex items-center gap-1 cursor-pointer font-medium"
              >
                <span>Expand</span>
                <Maximize2 size={10} />
              </button>
            )}
          </div>
          <div className="bg-surface-card border border-border/80 rounded-xl p-3.5 text-xs text-text-primary leading-relaxed whitespace-pre-wrap">
            {displaySummary}
          </div>
        </div>

        {/* CARD SECTION D2: Bulk Order Details (Bulk Order Conversations Only) */}
        {isBulkCall && bulkDetails.length > 0 && (
          <div className="bg-surface-page/60 border border-accent/20 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-accent">
              <Package size={14} />
              <span>Bulk Order Details</span>
            </div>
            
            <div className="bg-surface-card border border-border/80 rounded-xl p-3.5 space-y-2 text-xs">
              {bulkDetails.map((item, idx) => (
                <div key={idx} className="flex items-start justify-between py-1.5 border-b border-border/40 last:border-0 gap-2">
                  <span className="text-text-muted font-medium shrink-0 min-w-[140px]">{item.label}:</span>
                  <span className="text-text-primary font-semibold text-right break-words max-w-[220px]">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CARD SECTION E: Full Call Transcript */}
        {selectedCall.transcript && (
          <div className="bg-surface-page/60 border border-border rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                <FileText size={13} />
                Full Call Transcript
              </h4>
              <button
                onClick={() => openModal('Full Call Transcript', selectedCall.transcript!)}
                className="text-[11px] text-accent hover:underline flex items-center gap-1 cursor-pointer font-medium"
              >
                <span>Full View</span>
                <Maximize2 size={10} />
              </button>
            </div>
            <div className="bg-surface-card border border-border/80 rounded-xl p-3.5 max-h-48 overflow-y-auto scrollbar-thin text-xs text-text-primary leading-relaxed whitespace-pre-wrap font-sans">
              {selectedCall.transcript}
            </div>
          </div>
        )}

        {/* CARD SECTION F: Audio Recording */}
        {(selectedCall.recording_url || selectedCall.recording_path) && (
          <div className="bg-surface-page/60 border border-border rounded-xl p-4 space-y-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
              Call Recording
            </h4>
            <AudioPlayer
              callDbId={selectedCall._id}
              callId={selectedCall.call_id}
              title={`Recording - ${selectedCall.caller_name || selectedCall.phone_number}`}
              showFullscreen
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default CallDetailPanel

import { FC } from 'react'
import { Link } from 'react-router-dom'
import { Flag, Printer, X, Calendar, Clock, AlertTriangle, Maximize2, FileText } from 'lucide-react'
import StatusDot from '../StatusDot'
import { ICall, CallStatus } from '../../types/call'
import { formatDuration, formatTime } from '../../utils/format'
import AudioPlayer from './AudioPlayer'

interface CallDetailPanelProps {
  selectedCall: ICall
  setSelectedCall: (call: ICall | null) => void
  openModal: (title: string, content: string) => void
  STATUS_LABELS: Record<CallStatus, string>
}

const DetailField: FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <p className="text-[12px] font-medium text-text-muted uppercase tracking-wider mb-1">{label}</p>
    <div className="text-[14px] text-text-primary">{value}</div>
  </div>
)

const CallDetailPanel: FC<CallDetailPanelProps> = ({ selectedCall, setSelectedCall, openModal, STATUS_LABELS }) => {
  return (
    <div className="w-[400px] shrink-0 bg-surface-card rounded-2xl border border-border flex flex-col overflow-hidden">
      {/* Panel header */}
      <div className="flex items-start justify-between px-6 py-5 border-b border-border">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-[16px] font-semibold text-text-primary">
              {selectedCall.caller_name ?? selectedCall.phone_number}
            </h3>
            {selectedCall.is_red_flag && (
              <span
                className="flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium"
                style={{
                  borderColor: 'var(--color-status-escalated)',
                  color: 'var(--color-status-escalated)',
                }}
              >
                <Flag size={10} strokeWidth={2} />
                Red Flag
              </span>
            )}
          </div>
          <p className="text-[13px] text-text-muted tabular-nums">{selectedCall.phone_number}</p>
        </div>
        <div className="flex items-center">
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
            className="ml-1 p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-page transition-colors"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto scrollbar-narrow px-6 py-5 space-y-6">
        {/* Meta grid */}
        <div className="grid grid-cols-2 gap-4">
          <DetailField
            label="Duration"
            value={
              <span className="font-mono tabular-nums flex items-center gap-1.5">
                {formatDuration(selectedCall.duration)}
                {selectedCall.status === 'live' && (
                  <div
                    className="w-1.5 h-1.5 rounded-full animate-live-pulse"
                    style={{ backgroundColor: 'var(--color-accent)' }}
                  />
                )}
              </span>
            }
          />
          <DetailField label="Intent" value={selectedCall.detected_intent ?? '—'} />
          <DetailField
            label="Date"
            value={
              <span className="flex items-center gap-1.5">
                <Calendar size={13} strokeWidth={1.75} className="text-text-muted" />
                {formatTime(selectedCall.timestamp).date}
              </span>
            }
          />
          <DetailField
            label="Time"
            value={
              <span className="flex items-center gap-1.5 tabular-nums">
                <Clock size={13} strokeWidth={1.75} className="text-text-muted" />
                {formatTime(selectedCall.timestamp).time}
              </span>
            }
          />
        </div>

        {/* Status */}
        <DetailField
          label="Status"
          value={<StatusDot status={selectedCall.status} label={STATUS_LABELS[selectedCall.status]} />}
        />

        {/* Outcome */}
        {selectedCall.call_outcome && (
          <DetailField label="Outcome" value={selectedCall.call_outcome.replace(/_/g, ' ')} />
        )}

        {/* Category */}
        {selectedCall.call_category && (
          <DetailField
            label="Category"
            value={
              <span className="px-2 py-0.5 rounded-full text-[12px] font-medium bg-surface-page border border-border">
                {selectedCall.call_category}
              </span>
            }
          />
        )}

        {/* Guardrail triggered */}
        {selectedCall.guardrail_triggered && (
          <DetailField
            label="Guardrail"
            value={
              <span className="px-2 py-0.5 rounded-full text-[12px] font-medium bg-amber-100 text-amber-800 border border-amber-200">
                {selectedCall.guardrail_triggered}
              </span>
            }
          />
        )}

        {/* Red flag warning */}
        {selectedCall.is_red_flag && (
          <div
            className="flex items-start gap-3 p-3 rounded-xl border"
            style={{
              borderColor: 'var(--color-status-escalated)',
              backgroundColor: 'rgba(193, 85, 74, 0.05)',
            }}
          >
            <AlertTriangle
              size={15}
              strokeWidth={2}
              className="shrink-0 mt-0.5"
              style={{ color: 'var(--color-status-escalated)' }}
            />
            <div>
              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-status-escalated)' }}>
                This call has been flagged for review. Follow-up action may be required.
              </p>
              {selectedCall.red_flag_reason && (
                <p className="text-[12px] mt-1" style={{ color: 'var(--color-status-escalated)' }}>
                  Reason: {selectedCall.red_flag_reason}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Call Summary */}
        {selectedCall.call_summary && (
          <div
            className="group cursor-pointer p-3 -mx-3 rounded-xl hover:bg-surface-page transition-colors border border-transparent hover:border-border"
            onClick={() => openModal('Call Summary', selectedCall.call_summary!)}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] font-medium text-text-muted uppercase tracking-wider">
                Call Summary
              </p>
              <Maximize2 size={12} className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-[14px] leading-relaxed text-text-primary line-clamp-3">
              {selectedCall.call_summary}
            </p>
          </div>
        )}

        {/* Transcript */}
        {selectedCall.transcript && (
          <div
            className="group cursor-pointer p-3 -mx-3 rounded-xl hover:bg-surface-page transition-colors border border-transparent hover:border-border"
            onClick={() => openModal('Full Transcript', selectedCall.transcript!)}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileText size={13} strokeWidth={1.75} className="text-text-muted" />
                <p className="text-[12px] font-medium text-text-muted uppercase tracking-wider">
                  Transcript
                </p>
              </div>
              <Maximize2 size={12} className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="bg-surface-page border border-border rounded-xl p-4 max-h-40 overflow-hidden relative">
              <pre className="text-[13px] leading-relaxed text-text-primary whitespace-pre-wrap font-sans">
                {selectedCall.transcript}
              </pre>
              <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-surface-page to-transparent" />
            </div>
          </div>
        )}

        {/* Recording */}
        {selectedCall.recording_url && (
          <div>
            <p className="text-[12px] font-medium text-text-muted uppercase tracking-wider mb-2">
              Recording
            </p>
            <AudioPlayer 
              src={selectedCall.recording_url} 
              callId={selectedCall.call_id}
              title={`Call ${selectedCall.call_id}`}
              showFullscreen
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default CallDetailPanel

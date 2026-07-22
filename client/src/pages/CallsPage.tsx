import { FC, useState, useMemo } from 'react'
import { AudioWaveform, PhoneCall, Search, Flag, X, Clock, Calendar, Phone, FileText, AlertTriangle } from 'lucide-react'
import StatusDot, { StatusType } from '../components/StatusDot'

// ─── Interface — mirrors server/src/models/Call.ts (keep in sync) ─────────────
interface ICall {
  _id: string             // MongoDB ObjectId as string
  call_id: string         // Plivo call UUID
  caller_name?: string    // Resolved from CRM / phone lookup
  phone_number: string
  duration?: number       // seconds; undefined = in progress / live
  status: StatusType
  is_red_flag: boolean
  timestamp: string
  detected_intent?: string
  call_category?: 'support' | 'sales' | 'booking' | 'inquiry' | 'feedback' | 'complaint' | 'technical' | 'billing'
  is_red_flagged?: boolean
  red_flag_reason?: string
  call_summary?: string
  call_outcome?: string   // e.g. "ticket_created", "booking_made"
  transcript?: string
  recording_url?: string
}

// ─── Mock Data (field names match Call model exactly) ─────────────────────────
const MOCK_CALLS: ICall[] = [
  {
    _id: '687a2b1c0000000000000001',
    call_id: 'call_7f3a2b1c',
    caller_name: 'Arjun Mehta',
    phone_number: '+91 98765 43210',
    duration: undefined,
    status: 'live',
    is_red_flag: false,
    timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    detected_intent: 'Billing Inquiry',
    call_summary: 'Customer is currently on call inquiring about their latest invoice.',
    transcript: 'Agent: Hello, thank you for calling. How can I help you today?\nCustomer: Hi, I wanted to ask about my recent invoice...',
  },
  {
    _id: '687a2b1c0000000000000002',
    call_id: 'call_9d4e5f6a',
    caller_name: 'Priya Sharma',
    phone_number: '+91 87654 32109',
    duration: 342,
    status: 'escalated',
    is_red_flag: true,
    timestamp: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
    detected_intent: 'Product Complaint',
    call_summary: 'Customer reported a critical issue with their account being charged twice. Expressed frustration and requested immediate resolution. Escalated to billing team after agent was unable to process refund.',
    call_outcome: 'escalated_to_human',
    transcript: "Agent: Good afternoon! How may I assist you?\nCustomer: I have been charged twice this month and nobody is helping me!\nAgent: I understand your frustration. Let me pull up your account...\nCustomer: This is unacceptable. I want to speak to a manager.\nAgent: Of course, I'm escalating this right now.",
  },
  {
    _id: '687a2b1c0000000000000003',
    call_id: 'call_2c8b9e0d',
    caller_name: 'Rohan Verma',
    phone_number: '+91 76543 21098',
    duration: 127,
    status: 'resolved',
    is_red_flag: false,
    timestamp: new Date(Date.now() - 65 * 60 * 1000).toISOString(),
    detected_intent: 'Technical Support',
    call_summary: 'Customer had trouble logging into the portal. Agent guided them through a password reset successfully. Issue resolved in under 3 minutes.',
    call_outcome: 'issue_resolved',
    transcript: "Agent: Hi there! What can I help you with?\nCustomer: I can't seem to log in to my account.\nAgent: No worries! Let me walk you through the reset process...\nCustomer: Got it, that worked! Thank you.",
  },
  {
    _id: '687a2b1c0000000000000004',
    call_id: 'call_1a5c7d3e',
    caller_name: 'Sneha Patel',
    phone_number: '+91 65432 10987',
    duration: 89,
    status: 'missed',
    is_red_flag: true,
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    detected_intent: 'Cancellation Request',
    call_summary: 'Customer called regarding subscription cancellation. Call dropped before agent could resolve the issue. Follow-up required.',
    call_outcome: 'callback_required',
    transcript: 'Agent: Hello, thank you for calling support.\nCustomer: I want to cancel my subscription—\n[Call dropped]',
  },
  {
    _id: '687a2b1c0000000000000005',
    call_id: 'call_6e2f8g4h',
    caller_name: 'Vikram Singh',
    phone_number: '+91 54321 09876',
    duration: 521,
    status: 'resolved',
    is_red_flag: false,
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    detected_intent: 'Account Upgrade',
    call_summary: 'Customer inquired about upgrading their plan from Basic to Pro. Agent explained all features and pricing. Customer agreed to upgrade. Account updated successfully.',
    call_outcome: 'upsell_completed',
    transcript: "Agent: Thank you for calling! How can I assist?\nCustomer: I'd like to know more about your Pro plan.\nAgent: Absolutely! The Pro plan includes...\nCustomer: That sounds great. Can we switch now?\nAgent: Of course, I'll process that for you right away.",
  },
  {
    _id: '687a2b1c0000000000000006',
    call_id: 'call_3h7i9j5k',
    caller_name: 'Ananya Gupta',
    phone_number: '+91 43210 98765',
    duration: 203,
    status: 'escalated',
    is_red_flag: false,
    timestamp: new Date(Date.now() - 5.5 * 60 * 60 * 1000).toISOString(),
    detected_intent: 'Refund Request',
    call_summary: 'Customer requested a refund for a service that was not delivered as promised. Agent escalated to finance team for approval. Customer was informed of 3-5 business day timeline.',
    call_outcome: 'escalated_to_human',
    transcript: "Customer: I never received the service I paid for.\nAgent: I sincerely apologize for this. Let me look into your order.\nAgent: I can see the issue here. I'll need to escalate this to our finance team...",
  },
  {
    _id: '687a2b1c0000000000000007',
    call_id: 'call_0k4l6m2n',
    caller_name: 'Kiran Nair',
    phone_number: '+91 32109 87654',
    duration: 68,
    status: 'missed',
    is_red_flag: false,
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    detected_intent: 'General Inquiry',
    call_summary: 'Short call for general business hours inquiry. Customer requested callback during morning hours.',
    call_outcome: 'callback_required',
    transcript: "Customer: What are your business hours?\nAgent: We're available from 9 AM to 6 PM, Monday through Saturday.\nCustomer: Okay, I'll call back in the morning.",
  },
  {
    _id: '687a2b1c0000000000000008',
    call_id: 'call_5n8o1p7q',
    caller_name: 'Deepak Joshi',
    phone_number: '+91 21098 76543',
    duration: 418,
    status: 'resolved',
    is_red_flag: true,
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    detected_intent: 'Data Privacy Concern',
    call_summary: 'Customer raised serious concerns about data privacy and how their information is being used. Agent explained the privacy policy in detail. Customer was not fully satisfied and requested written confirmation — flagged for follow-up.',
    call_outcome: 'pending_followup',
    transcript: "Customer: I want to know exactly what data you're storing about me.\nAgent: I understand your concern. According to our privacy policy...\nCustomer: That's not good enough. I want this in writing.\nAgent: Of course, I'll have our privacy team send you a detailed breakdown.",
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatDuration = (secs: number | undefined): string => {
  if (secs === undefined) return 'In progress'
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

const formatTime = (iso: string): { date: string; time: string } => {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
  }
}

const STATUS_LABELS: Record<StatusType, string> = {
  live: 'Live',
  resolved: 'Resolved',
  escalated: 'Escalated',
  missed: 'Missed',
}

// ─── Sub-components ───────────────────────────────────────────────────────────
const DetailField: FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <p className="text-[12px] font-medium text-text-muted uppercase tracking-wider mb-1">{label}</p>
    <div className="text-[14px] text-text-primary">{value}</div>
  </div>
)

// ─── Filter options ───────────────────────────────────────────────────────────
const FILTER_OPTIONS: { label: string; value: StatusType | 'all' | 'flagged' }[] = [
  { label: 'All Calls', value: 'all' },
  { label: 'Live', value: 'live' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Escalated', value: 'escalated' },
  { label: 'Missed', value: 'missed' },
  { label: 'Red Flag', value: 'flagged' },
]

// ─── Main Component ───────────────────────────────────────────────────────────
const CallsPage: FC = () => {
  const [selectedCall, setSelectedCall] = useState<ICall | null>(null)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | StatusType | 'flagged'>('all')

  const filtered = useMemo(() => {
    return MOCK_CALLS.filter(call => {
      const matchesSearch =
        search === '' ||
        (call.caller_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        call.phone_number.includes(search) ||
        (call.detected_intent ?? '').toLowerCase().includes(search.toLowerCase())

      const matchesFilter =
        activeFilter === 'all' ||
        (activeFilter === 'flagged' ? call.is_red_flag : call.status === activeFilter)

      return matchesSearch && matchesFilter
    })
  }, [search, activeFilter])

  return (
    <div className="flex h-full gap-6">
      {/* ── Left: Table ──────────────────────────────────────────────────────── */}
      <div className={`flex flex-col gap-4 min-w-0 overflow-hidden transition-all duration-300 ${selectedCall ? 'flex-1' : 'w-full'}`}>
        {/* Page header */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-text-primary">Call Logs</h2>
          <span className="text-[13px] text-text-muted tabular-nums">
            {filtered.length} of {MOCK_CALLS.length} calls
          </span>
        </div>

        {/* Search + Filters */}
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
                onClick={() => setActiveFilter(opt.value as typeof activeFilter)}
                className={`px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-colors ${activeFilter === opt.value
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

        {/* Table card */}
        <div className="bg-surface-card rounded-2xl border border-border overflow-hidden flex-1 flex flex-col">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-text-muted">
              <Phone size={32} strokeWidth={1.5} className="mb-3 opacity-40" />
              <p className="text-[14px]">No calls match your filters</p>
            </div>
          ) : (
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
                        className={`h-14 cursor-pointer transition-colors ${isSelected
                          ? 'bg-surface-page'
                          : 'hover:bg-surface-page'
                          }`}
                      >
                        {/* Caller col: waveform avatar + stacked name/phone */}
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

                        {/* Intent col — hidden when panel open */}
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

                        {/* Date col — hidden when panel open */}
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
          )}
        </div>
      </div>

      {/* ── Right: Detail Panel ───────────────────────────────────────────────── */}
      {selectedCall && (
        <div className="w-100 shrink-0 bg-surface-card rounded-2xl border border-border flex flex-col overflow-hidden">
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
            <button
              onClick={() => setSelectedCall(null)}
              className="ml-3 p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-page transition-colors"
            >
              <X size={16} strokeWidth={2} />
            </button>
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
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-status-escalated)' }}>
                  This call has been flagged for review. Follow-up action may be required.
                </p>
              </div>
            )}

            {/* Call Summary */}
            {selectedCall.call_summary && (
              <div>
                <p className="text-[12px] font-medium text-text-muted uppercase tracking-wider mb-2">
                  Call Summary
                </p>
                <p className="text-[14px] leading-relaxed text-text-primary">
                  {selectedCall.call_summary}
                </p>
              </div>
            )}

            {/* Transcript */}
            {selectedCall.transcript && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileText size={13} strokeWidth={1.75} className="text-text-muted" />
                  <p className="text-[12px] font-medium text-text-muted uppercase tracking-wider">
                    Transcript
                  </p>
                </div>
                <div className="bg-surface-page border border-border rounded-xl p-4 max-h-56 overflow-y-auto scrollbar-narrow">
                  <pre className="text-[13px] leading-relaxed text-text-primary whitespace-pre-wrap font-sans">
                    {selectedCall.transcript}
                  </pre>
                </div>
              </div>
            )}

            {/* Recording */}
            {selectedCall.recording_url && (
              <div>
                <p className="text-[12px] font-medium text-text-muted uppercase tracking-wider mb-2">
                  Recording
                </p>
                <audio controls className="w-full h-9 outline-none">
                  <source src={selectedCall.recording_url} type="audio/mpeg" />
                </audio>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default CallsPage
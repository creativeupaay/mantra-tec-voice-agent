import { FC, useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import Modal from '../components/Modal'
import { callApi } from '../api/client'
import { ICall, CallStatus } from '../types/call'
import CallFilters, { DateFilterPreset } from '../components/calls/CallFilters'
import CallTable from '../components/calls/CallTable'
import CallDetailPanel from '../components/calls/CallDetailPanel'
import { CheckCircle, AlertCircle, X } from 'lucide-react'

const STATUS_LABELS: Record<CallStatus, string> = {
  live: 'Live',
  resolved: 'Resolved',
  escalated: 'Escalated',
  missed: 'Missed',
}

/** Prefer call timestamp; fall back to Mongo ObjectId time so sorting never collapses. */
const getCallTime = (call: ICall): number => {
  if (call.timestamp) {
    let str = call.timestamp.trim()
    if (str.includes('T') && !str.endsWith('Z') && !str.includes('+') && !str.includes('-')) {
      str += 'Z'
    }
    const t = new Date(str).getTime()
    if (!Number.isNaN(t)) return t
  }
  if (call._id && /^[a-f\d]{24}$/i.test(call._id)) {
    return parseInt(call._id.slice(0, 8), 16) * 1000
  }
  return 0
}

const startOfLocalDay = (d: Date): Date => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

const endOfLocalDay = (d: Date): Date => {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

const getDateRange = (
  preset: DateFilterPreset,
  dateFrom: string,
  dateTo: string,
): { start: number | null; end: number | null } => {
  const now = new Date()

  switch (preset) {
    case 'today': {
      return {
        start: startOfLocalDay(now).getTime(),
        end: endOfLocalDay(now).getTime(),
      }
    }
    case 'yesterday': {
      const y = new Date(now)
      y.setDate(y.getDate() - 1)
      return {
        start: startOfLocalDay(y).getTime(),
        end: endOfLocalDay(y).getTime(),
      }
    }
    case 'last_7_days': {
      const start = startOfLocalDay(now)
      start.setDate(start.getDate() - 6)
      return { start: start.getTime(), end: endOfLocalDay(now).getTime() }
    }
    case 'last_30_days': {
      const start = startOfLocalDay(now)
      start.setDate(start.getDate() - 29)
      return { start: start.getTime(), end: endOfLocalDay(now).getTime() }
    }
    case 'custom': {
      const start = dateFrom ? startOfLocalDay(new Date(`${dateFrom}T00:00:00`)).getTime() : null
      const end = dateTo ? endOfLocalDay(new Date(`${dateTo}T00:00:00`)).getTime() : null
      return {
        start: Number.isNaN(start as number) ? null : start,
        end: Number.isNaN(end as number) ? null : end,
      }
    }
    default:
      return { start: null, end: null }
  }
}

const CallsPage: FC = () => {
  const [searchParams] = useSearchParams()
  const urlCallId = searchParams.get('callId')
  const urlTab = searchParams.get('tab')

  const [calls, setCalls] = useState<ICall[]>([])
  const [selectedCall, setSelectedCall] = useState<ICall | null>(null)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | CallStatus | 'flagged'>(
    (urlTab as any) || 'all'
  )
  const [intentFilter, setIntentFilter] = useState('all')
  const [datePreset, setDatePreset] = useState<DateFilterPreset>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalTitle, setModalTitle] = useState('')
  const [modalContent, setModalContent] = useState('')

  const [isLoading, setIsLoading] = useState(true)
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => {
      setToast(null)
    }, 4500)
  }

  // Fetch calls list from API
  const fetchCalls = async () => {
    try {
      setIsLoading(true)
      const response = await callApi.getAll()
      const data = (response.data.data as ICall[]) ?? []
      data.sort((a, b) => getCallTime(b) - getCallTime(a))
      setCalls(data)

      // If URL specified callId, auto select it
      if (urlCallId) {
        const found = data.find(c => c._id === urlCallId || c.call_id === urlCallId)
        if (found) {
          setSelectedCall(found)
        }
      }
    } catch (err) {
      console.error('Failed to fetch calls', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchCalls()
  }, [urlCallId])

  // Sync urlTab if set
  useEffect(() => {
    if (urlTab && ['all', 'escalated', 'resolved', 'live', 'missed', 'flagged'].includes(urlTab)) {
      setActiveFilter(urlTab as any)
    }
  }, [urlTab])

  // Count metrics for tabs
  const escalatedCount = useMemo(() => calls.filter(c => c.status === 'escalated').length, [calls])
  const resolvedCount = useMemo(() => calls.filter(c => c.status === 'resolved').length, [calls])

  // RESOLVE CALL WORKFLOW (Updates MongoDB, updates state, emits event, shifts tabs)
  const handleResolveCall = async (callId: string) => {
    if (!callId) {
      showToast('Invalid call ID for resolution', 'error')
      return
    }

    const targetCall = calls.find(c => c._id === callId || c.call_id === callId)
    const previousCalls = [...calls]

    // 1. Optimistic UI update: change status from escalated to resolved
    setCalls(prev =>
      prev.map(c => {
        if (c._id === callId || c.call_id === callId) {
          return { ...c, status: 'resolved' as const }
        }
        return c
      })
    )

    if (selectedCall && (selectedCall._id === callId || selectedCall.call_id === callId)) {
      setSelectedCall(prev => (prev ? { ...prev, status: 'resolved' as const } : null))
    }

    try {
      setResolvingId(callId)

      // 2. Update MongoDB via backend API
      const res = await callApi.updateStatus(callId, 'resolved')

      if (res.data && res.data.success) {
        const updatedData = res.data.data || {}
        setCalls(prev =>
          prev.map(c => {
            if (c._id === callId || c.call_id === callId) {
              return {
                ...c,
                ...updatedData,
                status: 'resolved' as const,
              }
            }
            return c
          })
        )

        // 3. Dispatch global status update event for Navbar & Dashboard live sync
        window.dispatchEvent(new CustomEvent('call-status-updated', {
          detail: { callId, status: 'resolved', callerName: targetCall?.caller_name }
        }))

        showToast(`Call from ${targetCall?.caller_name || targetCall?.phone_number || 'customer'} marked as resolved.`, 'success')
      } else {
        throw new Error(res.data?.message || 'Failed to update MongoDB')
      }
    } catch (err: any) {
      console.error('Failed to resolve call:', err)
      // Rollback optimistic update on error
      setCalls(previousCalls)
      if (selectedCall && (selectedCall._id === callId || selectedCall.call_id === callId)) {
        setSelectedCall(targetCall || null)
      }
      showToast(err.message || 'Database resolution error', 'error')
    } finally {
      setResolvingId(null)
    }
  }

  const openModal = (title: string, content: string) => {
    setModalTitle(title)
    setModalContent(content)
    setIsModalOpen(true)
  }

  const intentOptions = useMemo(() => {
    const intents = new Set<string>()
    calls.forEach(call => {
      const intent = (call.detected_intent ?? '').trim()
      if (intent) intents.add(intent)
    })
    return Array.from(intents).sort((a, b) => a.localeCompare(b))
  }, [calls])

  const filtered = useMemo(() => {
    const { start, end } = getDateRange(datePreset, dateFrom, dateTo)

    const result = calls.filter(call => {
      const escalationReason = (call.red_flag_reason || call.guardrail_triggered || '').toLowerCase()
      const matchesSearch =
        search === '' ||
        (call.caller_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        call.phone_number.includes(search) ||
        (call.detected_intent ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (call.call_summary ?? '').toLowerCase().includes(search.toLowerCase()) ||
        escalationReason.includes(search.toLowerCase())

      const matchesFilter =
        activeFilter === 'all' ||
        (activeFilter === 'flagged'
          ? Boolean(call.is_red_flag || call.is_red_flagged)
          : call.status === activeFilter)

      const matchesIntent =
        intentFilter === 'all' ||
        (call.detected_intent ?? '').trim() === intentFilter

      const callTime = getCallTime(call)
      const matchesDate =
        (start === null || callTime >= start) &&
        (end === null || callTime <= end)

      return matchesSearch && matchesFilter && matchesIntent && matchesDate
    })

    // Strict date-wise: newest first
    return [...result].sort((a, b) => getCallTime(b) - getCallTime(a))
  }, [calls, search, activeFilter, intentFilter, datePreset, dateFrom, dateTo])

  return (
    <div className="flex h-full gap-6 relative">
      {/* Toast Banner */}
      {toast && (
        <div
          className={`fixed top-20 right-8 z-50 px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-3 border animate-in slide-in-from-top duration-200 ${
            toast.type === 'success'
              ? 'bg-text-primary text-surface-card border-border'
              : 'bg-red-500 text-white border-red-500'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-white shrink-0" />
          )}
          <p className="text-xs font-semibold">{toast.message}</p>
          <button
            onClick={() => setToast(null)}
            className="text-text-muted hover:text-surface-card ml-2 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className={`flex flex-col gap-4 min-w-0 overflow-hidden transition-all duration-300 ${selectedCall ? 'flex-1' : 'w-full'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Call Management</h2>
            <p className="text-xs text-text-secondary mt-0.5">Filter, inspect transcripts, and handle call escalations</p>
          </div>
          <span className="text-[13px] text-text-muted tabular-nums font-mono">
            {filtered.length} of {calls.length} calls
          </span>
        </div>

        <CallFilters
          search={search}
          setSearch={setSearch}
          activeFilter={activeFilter}
          setActiveFilter={setActiveFilter}
          intentFilter={intentFilter}
          setIntentFilter={setIntentFilter}
          intentOptions={intentOptions}
          datePreset={datePreset}
          setDatePreset={setDatePreset}
          dateFrom={dateFrom}
          setDateFrom={setDateFrom}
          dateTo={dateTo}
          setDateTo={setDateTo}
          escalatedCount={escalatedCount}
          resolvedCount={resolvedCount}
        />

        <div className="bg-surface-card rounded-2xl border border-border overflow-hidden flex-1 flex flex-col shadow-2xs">
          <CallTable
            isLoading={isLoading}
            filtered={filtered}
            selectedCall={selectedCall}
            setSelectedCall={setSelectedCall}
            openModal={openModal}
            STATUS_LABELS={STATUS_LABELS}
            onResolveCall={handleResolveCall}
            resolvingId={resolvingId}
          />
        </div>
      </div>

      {selectedCall && (
        <CallDetailPanel
          selectedCall={selectedCall}
          setSelectedCall={setSelectedCall}
          openModal={openModal}
          STATUS_LABELS={STATUS_LABELS}
          onResolveCall={handleResolveCall}
          resolvingId={resolvingId}
        />
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalTitle}
      >
        <div className="bg-surface-page border border-border rounded-xl p-6">
          <pre className="text-[14px] leading-relaxed text-text-primary whitespace-pre-wrap font-sans">
            {modalContent}
          </pre>
        </div>
      </Modal>
    </div>
  )
}

export default CallsPage

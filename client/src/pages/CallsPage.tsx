import { FC, useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import Modal from '../components/Modal'
import { callApi } from '../api/client'
import { ICall, CallStatus } from '../types/call'
import CallFilters, { DateFilterPreset } from '../components/calls/CallFilters'
import CallTable from '../components/calls/CallTable'
import CallDetailPanel from '../components/calls/CallDetailPanel'
import { CheckCircle, AlertCircle, X, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'

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
  const [debouncedSearch, setDebouncedSearch] = useState('')
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

  // Backend Pagination state
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [totalCalls, setTotalCalls] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [escalatedCount, setEscalatedCount] = useState(0)
  const [resolvedCount, setResolvedCount] = useState(0)

  const [isLoading, setIsLoading] = useState(true)
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => {
      setToast(null)
    }, 4500)
  }

  // Debounce search input for 300ms before sending backend search request
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1)
  }, [activeFilter, intentFilter, datePreset, dateFrom, dateTo])

  // Fetch paginated calls list from backend API
  const fetchCalls = async () => {
    try {
      setIsLoading(true)
      const response = await callApi.getAll({
        page,
        limit: rowsPerPage,
        search: debouncedSearch,
        status: activeFilter,
        intent: intentFilter,
        datePreset,
        dateFrom,
        dateTo,
      })

      const data = response.data ?? []
      setCalls(data)
      if (response.pagination) {
        setTotalCalls(response.pagination.total)
        setTotalPages(response.pagination.pages)
      } else {
        setTotalCalls(data.length)
        setTotalPages(1)
      }
      if (response.counts) {
        setEscalatedCount(response.counts.escalated)
        setResolvedCount(response.counts.resolved)
      }
    } catch (err) {
      console.error('Failed to fetch paginated calls', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchCalls()
  }, [page, rowsPerPage, debouncedSearch, activeFilter, intentFilter, datePreset, dateFrom, dateTo])

  // Email Deep-Link Handling: fetch only the targeted single call by callId and open drawer
  useEffect(() => {
    if (urlCallId) {
      callApi.getById(urlCallId)
        .then((res) => {
          if (res && res.success && res.data) {
            setSelectedCall(res.data)
          }
        })
        .catch((err) => console.error('Failed to fetch deep-linked call:', err))
    }
  }, [urlCallId])

  // Sync urlTab if set
  useEffect(() => {
    if (urlTab && ['all', 'escalated', 'resolved', 'live', 'missed', 'flagged'].includes(urlTab)) {
      setActiveFilter(urlTab as any)
    }
  }, [urlTab])

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

      if (res && res.success) {
        const updatedData = res.data || {}
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
        throw new Error(res?.message || 'Failed to update MongoDB')
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

  const startIndex = (page - 1) * rowsPerPage
  const endIndex = Math.min(totalCalls, startIndex + calls.length)

  return (
    <div className="flex flex-col h-full gap-4">
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

      {/* Always full-width header + table */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-text-primary">Call Management</h2>
          <p className="text-xs text-text-secondary mt-0.5">Filter, inspect transcripts, and handle call escalations</p>
        </div>
        <span className="text-[13px] text-text-muted tabular-nums font-mono">
          {totalCalls} total calls
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

      <div className="bg-surface-card rounded-2xl border border-border overflow-hidden flex-1 flex flex-col min-h-[600px] lg:min-h-[700px] shadow-2xs">
        <CallTable
          isLoading={isLoading}
          filtered={calls}
          selectedCall={selectedCall}
          setSelectedCall={setSelectedCall}
          openModal={openModal}
          STATUS_LABELS={STATUS_LABELS}
          onResolveCall={handleResolveCall}
          resolvingId={resolvingId}
        />

        {/* Material UI Style Pagination Footer */}
        {!isLoading && totalCalls > 0 && (
          <div className="px-4 sm:px-6 py-3 border-t border-border bg-surface-card flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-secondary select-none">
            {/* Left: Rows per page selector */}
            <div className="flex items-center space-x-2 shrink-0">
              <span className="text-[12px] text-text-muted font-medium whitespace-nowrap">Rows per page:</span>
              <div className="relative">
                <select
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value))
                    setPage(1)
                  }}
                  className="appearance-none bg-surface-page hover:bg-surface-card text-text-primary font-medium text-[12px] px-2.5 py-1 pr-6 rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer transition-colors"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <ChevronDown className="w-3 h-3 text-text-muted absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Right: Page Range Indicator & Navigation Buttons */}
            <div className="flex items-center space-x-3 sm:space-x-4 shrink-0">
              <span className="text-[12px] font-mono text-text-muted tabular-nums whitespace-nowrap">
                {totalCalls === 0 ? '0–0 of 0' : `${startIndex + 1}–${endIndex} of ${totalCalls}`}
              </span>

              <div className="flex items-center space-x-1 shrink-0">
                <button
                  onClick={() => setPage(prev => Math.max(1, prev - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded-lg border border-border text-text-primary hover:bg-surface-page disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                <span className="text-[12px] font-semibold text-text-primary px-2 font-mono tabular-nums whitespace-nowrap shrink-0">
                  {page} / {totalPages}
                </span>

                <button
                  onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded-lg border border-border text-text-primary hover:bg-surface-page disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                  title="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Overlay drawer rendered at body level via portal — always flush to the right viewport edge */}
      {selectedCall && createPortal(
        <>
          {/* Semi-transparent backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setSelectedCall(null)}
          />
          {/* Drawer panel — flush right, broader */}
          <div className="fixed top-0 right-0 h-full z-50 w-[720px] max-w-full shadow-2xl animate-in slide-in-from-right duration-200">
            <CallDetailPanel
              selectedCall={selectedCall}
              setSelectedCall={setSelectedCall}
              openModal={openModal}
              STATUS_LABELS={STATUS_LABELS}
              onResolveCall={handleResolveCall}
              resolvingId={resolvingId}
            />
          </div>
        </>,
        document.body
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

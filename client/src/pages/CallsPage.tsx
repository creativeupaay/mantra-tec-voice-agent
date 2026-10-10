import { FC, useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import Modal from '../components/Modal'
import { callApi } from '../api/client'
import { ICall, CallStatus } from '../types/call'
import CallFilters, { DateFilterPreset } from '../components/calls/CallFilters'
import CallTable from '../components/calls/CallTable'
import CallDetailPanel from '../components/calls/CallDetailPanel'
import { CheckCircle, AlertCircle, X, ChevronLeft, ChevronRight, ChevronDown, CheckCheck, AudioWaveform } from 'lucide-react'

const STATUS_LABELS: Record<CallStatus, string> = {
  live: 'Live',
  resolved: 'Resolved',
  escalated: 'Escalated',
  missed: 'Missed',
  callback_required: 'Callback Required',
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
  const [reviewFilter, setReviewFilter] = useState<'all' | 'unreviewed' | 'reviewed'>('all')
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
  const [callbackRequiredCount, setCallbackRequiredCount] = useState(0)
  const [reviewedCount, setReviewedCount] = useState(0)
  const [unreviewedCount, setUnreviewedCount] = useState(0)

  const [isLoading, setIsLoading] = useState(true)
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [togglingReviewedId, setTogglingReviewedId] = useState<string | null>(null)
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
  }, [activeFilter, intentFilter, reviewFilter, datePreset, dateFrom, dateTo])

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
        reviewed: reviewFilter,
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
        if (response.counts.callback_required !== undefined) {
          setCallbackRequiredCount(response.counts.callback_required)
        }
        if (response.counts.reviewed !== undefined) {
          setReviewedCount(response.counts.reviewed)
        }
        if (response.counts.unreviewed !== undefined) {
          setUnreviewedCount(response.counts.unreviewed)
        }
      }
    } catch (err) {
      console.error('Failed to fetch paginated calls', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchCalls()
  }, [page, rowsPerPage, debouncedSearch, activeFilter, intentFilter, reviewFilter, datePreset, dateFrom, dateTo])

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
    if (urlTab && ['all', 'escalated', 'resolved', 'live', 'missed', 'flagged', 'callback_required'].includes(urlTab)) {
      setActiveFilter(urlTab as any)
    }
  }, [urlTab])

  // RESOLVE CALL WORKFLOW
  const handleResolveCall = async (callId: string) => {
    if (!callId) {
      showToast('Invalid call ID for resolution', 'error')
      return
    }

    const previousCalls = [...calls]

    // 1. Optimistic UI update: change status to resolved
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

        window.dispatchEvent(
          new CustomEvent('call-status-updated', {
            detail: { callId, status: 'resolved' },
          })
        )

        showToast('Call session successfully marked as resolved.', 'success')
      } else {
        throw new Error((res as any)?.message || 'Failed to update status')
      }
    } catch (err: any) {
      console.error('Failed to resolve call:', err)
      setCalls(previousCalls)
      showToast(err.message || 'Error updating status', 'error')
    } finally {
      setResolvingId(null)
    }
  }

  // REVIEW TOGGLE WORKFLOW
  const handleToggleReviewed = async (call: ICall) => {
    const targetId = call._id || call.call_id
    if (!targetId) return

    const newReviewedState = !Boolean(call.is_reviewed)
    const previousCalls = [...calls]
    const previousSelectedCall = selectedCall

    setCalls(prev =>
      prev.map(c => {
        if (c._id === targetId || c.call_id === targetId) {
          return {
            ...c,
            is_reviewed: newReviewedState,
            reviewed_at: newReviewedState ? new Date().toISOString() : undefined,
          }
        }
        return c
      })
    )

    if (selectedCall && (selectedCall._id === targetId || selectedCall.call_id === targetId)) {
      setSelectedCall(prev =>
        prev
          ? {
              ...prev,
              is_reviewed: newReviewedState,
              reviewed_at: newReviewedState ? new Date().toISOString() : undefined,
            }
          : null
      )
    }

    try {
      setTogglingReviewedId(targetId)
      const res = await callApi.updateReviewed(targetId, newReviewedState)

      if (res && res.success) {
        window.dispatchEvent(
          new CustomEvent('call-status-updated', {
            detail: { callId: targetId, is_reviewed: newReviewedState },
          })
        )

        showToast(
          `Call from ${call.caller_name || call.phone_number} marked as ${newReviewedState ? 'reviewed' : 'unreviewed'}.`,
          'success'
        )
      } else {
        throw new Error((res as any)?.message || 'Failed to update review status in database')
      }
    } catch (err: any) {
      console.error('Failed to toggle review status:', err)
      setCalls(previousCalls)
      if (previousSelectedCall) {
        setSelectedCall(previousSelectedCall)
      }
      fetchCalls()
      showToast(err.message || 'Database error updating review status', 'error')
    } finally {
      setTogglingReviewedId(null)
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
    <div className="flex flex-col h-full gap-4 font-sans text-text-primary">
      {/* Toast Banner */}
      {toast && (
        <div
          className={`fixed top-18 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 border animate-in slide-in-from-top duration-200 ${
            toast.type === 'success'
              ? 'bg-text-primary text-surface-card border-border'
              : 'bg-red-500 text-white border-red-500'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-white shrink-0" />
          )}
          <p className="text-xs font-semibold">{toast.message}</p>
          <button
            onClick={() => setToast(null)}
            className="text-text-muted hover:text-surface-card ml-2 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-text-primary">
            Calls
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Filter, inspect transcripts, and handle call resolutions
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-xl flex items-center gap-1">
            <CheckCheck size={12} strokeWidth={2.5} />
            <span>{reviewedCount} Reviewed</span>
          </span>
          <span className="text-xs font-mono font-medium text-text-muted bg-surface-card px-2.5 py-1 rounded-xl border border-border">
            {totalCalls} Total
          </span>
        </div>
      </div>

      {/* ── Filter Toolbar ──────────────────────────────────────────── */}
      <CallFilters
        search={search}
        setSearch={setSearch}
        activeFilter={activeFilter}
        setActiveFilter={setActiveFilter}
        intentFilter={intentFilter}
        setIntentFilter={setIntentFilter}
        intentOptions={intentOptions}
        reviewFilter={reviewFilter}
        setReviewFilter={setReviewFilter}
        datePreset={datePreset}
        setDatePreset={setDatePreset}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
        escalatedCount={escalatedCount}
        resolvedCount={resolvedCount}
        callbackRequiredCount={callbackRequiredCount}
        reviewedCount={reviewedCount}
        unreviewedCount={unreviewedCount}
      />

      {/* ── Table Container ─────────────────────────────────────────── */}
      <div className="bg-surface-card rounded-2xl border border-border overflow-hidden flex-1 flex flex-col min-h-[550px] shadow-2xs">
        <CallTable
          isLoading={isLoading}
          filtered={calls}
          selectedCall={selectedCall}
          setSelectedCall={setSelectedCall}
          openModal={openModal}
          STATUS_LABELS={STATUS_LABELS}
          onResolveCall={handleResolveCall}
          resolvingId={resolvingId}
          onToggleReviewed={handleToggleReviewed}
          togglingReviewedId={togglingReviewedId}
        />

        {/* ── ElevenLabs Studio Pagination Footer ─────────────────────── */}
        {!isLoading && totalCalls > 0 && (
          <div className="px-5 py-3 border-t border-border bg-surface-card flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-secondary select-none">
            {/* Left: Rows per page selector */}
            <div className="flex items-center space-x-2 shrink-0">
              <span className="text-xs text-text-muted font-medium whitespace-nowrap">
                Rows per page:
              </span>
              <div className="relative">
                <select
                  value={rowsPerPage}
                  onChange={e => {
                    setRowsPerPage(Number(e.target.value))
                    setPage(1)
                  }}
                  className="appearance-none bg-surface-page hover:bg-surface-card text-text-primary font-semibold text-xs px-2.5 py-1 pr-6 rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-text-primary cursor-pointer transition-colors"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <ChevronDown className="w-3 h-3 text-text-muted absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Right: Page Range Indicator & Buttons */}
            <div className="flex items-center space-x-3 sm:space-x-4 shrink-0">
              <span className="text-xs font-mono text-text-muted tabular-nums whitespace-nowrap">
                {totalCalls === 0 ? '0–0 of 0' : `${startIndex + 1}–${endIndex} of ${totalCalls}`}
              </span>

              <div className="flex items-center space-x-1 shrink-0">
                <button
                  onClick={() => setPage(prev => Math.max(1, prev - 1))}
                  disabled={page <= 1}
                  className="p-1 rounded-lg border border-border text-text-primary hover:bg-surface-page disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                  title="Previous Page"
                  aria-label="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="text-xs font-semibold text-text-primary px-2 font-mono tabular-nums whitespace-nowrap shrink-0">
                  {page} / {totalPages}
                </span>

                <button
                  onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={page >= totalPages}
                  className="p-1 rounded-lg border border-border text-text-primary hover:bg-surface-page disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                  title="Next Page"
                  aria-label="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Overlay Drawer via Portal ────────────────────────────────── */}
      {selectedCall &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-40 bg-black/25 backdrop-blur-2xs transition-opacity"
              onClick={() => setSelectedCall(null)}
            />
            <div className="fixed top-0 right-0 h-full z-50 w-[720px] max-w-full shadow-2xl animate-in slide-in-from-right duration-200">
              <CallDetailPanel
                selectedCall={selectedCall}
                setSelectedCall={setSelectedCall}
                openModal={openModal}
                STATUS_LABELS={STATUS_LABELS}
                onResolveCall={handleResolveCall}
                resolvingId={resolvingId}
                onToggleReviewed={handleToggleReviewed}
                togglingReviewedId={togglingReviewedId}
              />
            </div>
          </>,
          document.body
        )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalTitle}>
        <div className="bg-surface-page border border-border rounded-xl p-5">
          <pre className="text-xs leading-relaxed text-text-primary whitespace-pre-wrap font-sans">
            {modalContent}
          </pre>
        </div>
      </Modal>
    </div>
  )
}

export default CallsPage

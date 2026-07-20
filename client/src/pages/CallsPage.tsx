import { FC, useState, useMemo, useEffect } from 'react'
import Modal from '../components/Modal'
import { callApi } from '../api/client'
import { ICall, CallStatus } from '../types/call'
import { formatDuration, formatTime } from '../utils/format'
import CallFilters from '../components/calls/CallFilters'
import CallTable from '../components/calls/CallTable'
import CallDetailPanel from '../components/calls/CallDetailPanel'


const STATUS_COLORS: Record<CallStatus, string> = {
  live: 'var(--color-status-live)',
  resolved: 'var(--color-status-resolved)',
  escalated: 'var(--color-status-escalated)',
  missed: 'var(--color-status-missed)',
}

const STATUS_LABELS: Record<CallStatus, string> = {
  live: 'Live',
  resolved: 'Resolved',
  escalated: 'Escalated',
  missed: 'Missed',
}


// ─── Main Component ───────────────────────────────────────────────────────────
const CallsPage: FC = () => {
  const [selectedCall, setSelectedCall] = useState<ICall | null>(null)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | CallStatus | 'flagged'>('all')

  const [calls, setCalls] = useState<ICall[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchCalls = async () => {
      try {
        const response = await callApi.getAll()
        setCalls(response.data.data as ICall[])
      } catch (err) {
        console.error('Failed to fetch calls', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchCalls()
  }, [])

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalTitle, setModalTitle] = useState('')
  const [modalContent, setModalContent] = useState('')

  const openModal = (title: string, content: string) => {
    setModalTitle(title)
    setModalContent(content)
    setIsModalOpen(true)
  }

  const filtered = useMemo(() => {
    return calls.filter(call => {
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
  }, [calls, search, activeFilter])

  return (
    <div className="flex h-full gap-6">
      {/* ── Left: Table ──────────────────────────────────────────────────────── */}
      <div className={`flex flex-col gap-4 min-w-0 overflow-hidden transition-all duration-300 ${selectedCall ? 'flex-1' : 'w-full'}`}>
        {/* Page header */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-text-primary">Call Logs</h2>
          <span className="text-[13px] text-text-muted tabular-nums">
            {filtered.length} of {calls.length} calls
          </span>
        </div>

        {/* Search + Filters */}
        <CallFilters
          search={search}
          setSearch={setSearch}
          activeFilter={activeFilter}
          setActiveFilter={setActiveFilter}
        />

        {/* Table card */}
        <div className="bg-surface-card rounded-2xl border border-border overflow-hidden flex-1 flex flex-col">
          <CallTable
            isLoading={isLoading}
            filtered={filtered}
            selectedCall={selectedCall}
            setSelectedCall={setSelectedCall}
            STATUS_LABELS={STATUS_LABELS}
          />
        </div>
      </div>

      {/* ── Right: Detail Panel ───────────────────────────────────────────────── */}
      {selectedCall && (
        <CallDetailPanel
          selectedCall={selectedCall}
          setSelectedCall={setSelectedCall}
          openModal={openModal}
          STATUS_LABELS={STATUS_LABELS}
        />
      )}
      {/* ── Modal ───────────────────────────────────────────────────────────── */}
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
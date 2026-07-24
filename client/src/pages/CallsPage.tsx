import { FC, useState, useMemo, useEffect } from 'react'
import Modal from '../components/Modal'
import { callApi } from '../api/client'
import { ICall, CallStatus } from '../types/call'
import CallFilters, { DateFilterPreset } from '../components/calls/CallFilters'
import CallTable from '../components/calls/CallTable'
import CallDetailPanel from '../components/calls/CallDetailPanel'

const STATUS_LABELS: Record<CallStatus, string> = {
  live: 'Live',
  resolved: 'Resolved',
  escalated: 'Escalated',
  missed: 'Missed',
}

/** Prefer call timestamp; fall back to Mongo ObjectId time so sorting never collapses. */
const getCallTime = (call: ICall): number => {
  if (call.timestamp) {
    const t = new Date(call.timestamp).getTime()
    if (!Number.isNaN(t)) return t
  }
  // ObjectId first 8 hex chars = unix seconds
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
  const [selectedCall, setSelectedCall] = useState<ICall | null>(null)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | CallStatus | 'flagged'>('all')
  const [intentFilter, setIntentFilter] = useState('all')
  const [datePreset, setDatePreset] = useState<DateFilterPreset>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalTitle, setModalTitle] = useState('')
  const [modalContent, setModalContent] = useState('')

  const [calls, setCalls] = useState<ICall[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchCalls = async () => {
      try {
        const response = await callApi.getAll()
        const data = (response.data.data as ICall[]) ?? []
        // Sort once on fetch so the table always starts newest → oldest
        data.sort((a, b) => getCallTime(b) - getCallTime(a))
        setCalls(data)
      } catch (err) {
        console.error('Failed to fetch calls', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchCalls()
  }, [])

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
      const matchesSearch =
        search === '' ||
        (call.caller_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        call.phone_number.includes(search) ||
        (call.detected_intent ?? '').toLowerCase().includes(search.toLowerCase())

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
    <div className="flex h-full gap-6">
      <div className={`flex flex-col gap-4 min-w-0 overflow-hidden transition-all duration-300 ${selectedCall ? 'flex-1' : 'w-full'}`}>
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-text-primary">Call Logs</h2>
          <span className="text-[13px] text-text-muted tabular-nums">
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
        />

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

      {selectedCall && (
        <CallDetailPanel
          selectedCall={selectedCall}
          setSelectedCall={setSelectedCall}
          openModal={openModal}
          STATUS_LABELS={STATUS_LABELS}
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

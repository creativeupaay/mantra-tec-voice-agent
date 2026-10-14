import { FC, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  MessageSquareText,
  Search,
  Plus,
  Send,
  Phone,
  Clock,
  User,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Sparkles,
  Tag,
  ArrowRight,
} from 'lucide-react'
import { feedbackApi } from '../api/client'
import { IFeedback, FeedbackStatus } from '../types/feedback'
import { formatTime } from '../utils/format'

const CATEGORY_OPTIONS = [
  'General',
  'Agent Behavior',
  'Speech & Audio Quality',
  'Lead Capture & RFQ',
  'Guardrail & Escalation',
  'Latency / Delay',
  'Other',
]

const STATUS_CONFIG: Record<
  FeedbackStatus,
  { label: string; dotClass: string; badgeClass: string; textClass: string }
> = {
  pending: {
    label: 'Pending',
    dotClass: 'bg-[#C98A3B]',
    badgeClass: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
    textClass: 'text-amber-700',
  },
  inprogress: {
    label: 'In Progress',
    dotClass: 'bg-[#2451DA]',
    badgeClass: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
    textClass: 'text-blue-700',
  },
  resolved: {
    label: 'Resolved',
    dotClass: 'bg-[#5B8C5A]',
    badgeClass: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
    textClass: 'text-emerald-700',
  },
}

const FeedbacksPage: FC = () => {
  // Feedbacks state
  const [feedbacks, setFeedbacks] = useState<IFeedback[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Filters & Pagination
  const [statusFilter, setStatusFilter] = useState<'all' | FeedbackStatus>('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [totalFeedbacks, setTotalFeedbacks] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  // Header status counters
  const [counts, setCounts] = useState({
    all: 0,
    pending: 0,
    inprogress: 0,
    resolved: 0,
  })

  // New Feedback Form State
  const [content, setContent] = useState('')
  const [callIdInput, setCallIdInput] = useState('')
  const [statusInput, setStatusInput] = useState<FeedbackStatus>('pending')
  const [categoryInput, setCategoryInput] = useState('General')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null)

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // Reset page when filter changes
  useEffect(() => {
    setPage(1)
  }, [statusFilter])

  // Fetch feedbacks
  const fetchFeedbacks = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true)
      setIsRefreshing(true)
      const res = await feedbackApi.getAll({
        page,
        limit: rowsPerPage,
        status: statusFilter,
        search: debouncedSearch,
      })

      if (res.success) {
        setFeedbacks(res.data || [])
        if (res.pagination) {
          setTotalFeedbacks(res.pagination.total)
          setTotalPages(res.pagination.pages)
        }
        if (res.counts) {
          setCounts(res.counts)
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch feedbacks', err)
      showToast(err.response?.data?.message || 'Failed to load feedbacks', 'error')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    fetchFeedbacks()
  }, [page, rowsPerPage, statusFilter, debouncedSearch])

  // Handle Create Feedback
  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) {
      showToast('Please enter feedback content', 'error')
      return
    }

    try {
      setIsSubmitting(true)
      const res = await feedbackApi.create({
        content: content.trim(),
        call_id: callIdInput.trim() || undefined,
        status: statusInput,
        category: categoryInput,
      })

      if (res.success) {
        showToast('Feedback logged successfully', 'success')
        setContent('')
        setCallIdInput('')
        setStatusInput('pending')
        setCategoryInput('General')
        // Optimistically insert and refresh counts
        fetchFeedbacks(true)
      }
    } catch (err: any) {
      console.error('Failed to create feedback', err)
      showToast(err.response?.data?.message || 'Failed to submit feedback', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Quick Status Change
  const handleStatusChange = async (feedbackId: string, newStatus: FeedbackStatus) => {
    const originalFeedbacks = [...feedbacks]
    // Optimistic UI update
    setFeedbacks((prev) =>
      prev.map((item) => (item._id === feedbackId ? { ...item, status: newStatus } : item))
    )
    setUpdatingStatusId(feedbackId)

    try {
      const res = await feedbackApi.updateStatus(feedbackId, newStatus)
      if (res.success) {
        showToast(`Status updated to ${STATUS_CONFIG[newStatus].label}`, 'success')
        fetchFeedbacks(true)
      }
    } catch (err: any) {
      console.error('Failed to update status', err)
      setFeedbacks(originalFeedbacks)
      showToast(err.response?.data?.message || 'Failed to update status', 'error')
    } finally {
      setUpdatingStatusId(null)
    }
  }

  // Handle Delete Feedback
  const handleDeleteFeedback = async (feedbackId: string) => {
    if (!window.confirm('Are you sure you want to delete this feedback entry?')) return

    try {
      const res = await feedbackApi.delete(feedbackId)
      if (res.success) {
        showToast('Feedback deleted successfully', 'success')
        setFeedbacks((prev) => prev.filter((item) => item._id !== feedbackId))
        fetchFeedbacks(true)
      }
    } catch (err: any) {
      console.error('Failed to delete feedback', err)
      showToast(err.response?.data?.message || 'Failed to delete feedback', 'error')
    }
  }

  const handleCopyCallId = (callId: string) => {
    navigator.clipboard.writeText(callId)
    setCopiedId(callId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans">
      {/* ── Toast Notification ───────────────────────────────────────── */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl border shadow-lg flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200 ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-text-primary text-surface-card flex items-center justify-center shadow-xs">
              <MessageSquareText size={18} strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-text-primary">Feedbacks</h1>
              <p className="text-xs text-text-secondary">
                Track agent performance, log operational observations, and manage resolution states.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => fetchFeedbacks()}
          disabled={isRefreshing}
          className="self-start sm:self-auto px-3 py-1.5 rounded-xl border border-border bg-surface-card hover:bg-surface-page text-text-secondary hover:text-text-primary text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
          title="Refresh Feedbacks"
        >
          <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* ── KPI Metric Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Feedbacks */}
        <div className="bg-surface-card border border-border rounded-2xl p-4 flex flex-col justify-between shadow-2xs">
          <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
            Total Feedbacks
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-mono font-semibold text-text-primary tabular-nums">
              {counts.all}
            </span>
            <div className="w-2 h-2 rounded-full bg-text-secondary" />
          </div>
        </div>

        {/* Pending */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
          className={`bg-surface-card border rounded-2xl p-4 flex flex-col justify-between shadow-2xs cursor-pointer transition-all ${
            statusFilter === 'pending'
              ? 'border-amber-500 ring-2 ring-amber-500/10'
              : 'border-border hover:border-amber-500/50'
          }`}
        >
          <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
            Pending Review
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-mono font-semibold text-amber-600 tabular-nums">
              {counts.pending}
            </span>
            <div className="w-2.5 h-2.5 rounded-full bg-[#C98A3B]" />
          </div>
        </div>

        {/* In Progress */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'inprogress' ? 'all' : 'inprogress')}
          className={`bg-surface-card border rounded-2xl p-4 flex flex-col justify-between shadow-2xs cursor-pointer transition-all ${
            statusFilter === 'inprogress'
              ? 'border-blue-500 ring-2 ring-blue-500/10'
              : 'border-border hover:border-blue-500/50'
          }`}
        >
          <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
            In Progress
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-mono font-semibold text-blue-600 tabular-nums">
              {counts.inprogress}
            </span>
            <div className="w-2.5 h-2.5 rounded-full bg-[#2451DA]" />
          </div>
        </div>

        {/* Resolved */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'resolved' ? 'all' : 'resolved')}
          className={`bg-surface-card border rounded-2xl p-4 flex flex-col justify-between shadow-2xs cursor-pointer transition-all ${
            statusFilter === 'resolved'
              ? 'border-emerald-500 ring-2 ring-emerald-500/10'
              : 'border-border hover:border-emerald-500/50'
          }`}
        >
          <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
            Resolved
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-mono font-semibold text-emerald-600 tabular-nums">
              {counts.resolved}
            </span>
            <div className="w-2.5 h-2.5 rounded-full bg-[#5B8C5A]" />
          </div>
        </div>
      </div>

      {/* ── 1. The Box: Add Feedback Card ───────────────────────────── */}
      <div className="bg-surface-card border border-border rounded-2xl p-5 shadow-xs transition-shadow">
        <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-border/80">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-surface-page border border-border flex items-center justify-center text-text-primary">
              <Plus size={13} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-primary">Add Feedback</h2>
              <p className="text-[11px] text-text-secondary">
                Submit general observations or attach to a specific call UUID for post-call review.
              </p>
            </div>
          </div>
          <span className="text-[10px] text-text-muted font-medium hidden sm:inline-block">
            Press Ctrl + Enter to submit
          </span>
        </div>

        <form onSubmit={handleSubmitFeedback} className="space-y-4">
          {/* Content Textarea */}
          <div>
            <textarea
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  handleSubmitFeedback(e)
                }
              }}
              placeholder="Write your feedback, prompt issue, call observation, or agent improvement suggestion..."
              className="w-full text-xs text-text-primary placeholder:text-text-muted bg-surface-page border border-border rounded-xl p-3 focus:outline-none focus:border-text-primary focus:bg-surface-card transition-colors resize-y min-h-[80px]"
              required
            />
          </div>

          {/* Form Options Row: Call ID, Category, Initial Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Optional Call ID Link */}
            <div>
              <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                Link to Call ID <span className="text-text-muted font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <Phone
                  size={13}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                />
                <input
                  type="text"
                  value={callIdInput}
                  onChange={(e) => setCallIdInput(e.target.value)}
                  placeholder="Paste Call UUID or Mongo ID..."
                  className="w-full text-xs font-mono pl-8 pr-3 py-2 bg-surface-page border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-primary focus:bg-surface-card transition-colors"
                />
              </div>
            </div>

            {/* Category Selector */}
            <div>
              <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                Category
              </label>
              <div className="relative">
                <Tag
                  size={13}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                />
                <select
                  value={categoryInput}
                  onChange={(e) => setCategoryInput(e.target.value)}
                  className="w-full text-xs pl-8 pr-3 py-2 bg-surface-page border border-border rounded-xl text-text-primary focus:outline-none focus:border-text-primary focus:bg-surface-card transition-colors cursor-pointer appearance-none"
                >
                  {CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Initial Status */}
            <div>
              <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                Status
              </label>
              <div className="flex items-center gap-1.5 p-1 bg-surface-page border border-border rounded-xl">
                {(['pending', 'inprogress', 'resolved'] as FeedbackStatus[]).map((st) => {
                  const cfg = STATUS_CONFIG[st]
                  const isSelected = statusInput === st
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusInput(st)}
                      className={`flex-1 py-1 text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-surface-card text-text-primary shadow-2xs border border-border font-bold'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotClass}`} />
                      <span>{cfg.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Submit Row */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-text-muted">
              {content.length > 0 && `${content.length} characters`}
            </span>

            <button
              type="submit"
              disabled={isSubmitting || !content.trim()}
              className="px-4 py-2 bg-text-primary hover:bg-black text-surface-card text-xs font-semibold rounded-xl flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
            >
              {isSubmitting ? (
                <div className="w-3.5 h-3.5 rounded-full border-2 border-surface-card border-t-transparent animate-spin" />
              ) : (
                <Send size={13} strokeWidth={2.2} />
              )}
              <span>Submit Feedback</span>
            </button>
          </div>
        </form>
      </div>

      {/* ── 2. The Paginated List & Filters ─────────────────────────── */}
      <div className="bg-surface-card border border-border rounded-2xl shadow-xs overflow-hidden">
        {/* Filter Bar: Tabs & Search */}
        <div className="p-4 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
            {[
              { id: 'all', label: 'All', count: counts.all },
              { id: 'pending', label: 'Pending', count: counts.pending },
              { id: 'inprogress', label: 'In Progress', count: counts.inprogress },
              { id: 'resolved', label: 'Resolved', count: counts.resolved },
            ].map((tab) => {
              const isActive = statusFilter === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id as any)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                    isActive
                      ? 'bg-text-primary text-surface-card shadow-xs'
                      : 'text-text-secondary hover:bg-surface-page hover:text-text-primary'
                  }`}
                >
                  {tab.id !== 'all' && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        STATUS_CONFIG[tab.id as FeedbackStatus].dotClass
                      }`}
                    />
                  )}
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                      isActive ? 'bg-white/20 text-white' : 'bg-surface-page border border-border text-text-muted'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search feedback, user, call ID..."
              className="w-full text-xs pl-8 pr-3 py-1.5 bg-surface-page border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-primary focus:bg-surface-card transition-colors"
            />
          </div>
        </div>

        {/* List Content */}
        {isLoading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse bg-surface-page border border-border/60 rounded-xl p-4 space-y-3"
              >
                <div className="h-4 bg-border/80 rounded w-1/4" />
                <div className="h-3 bg-border/60 rounded w-3/4" />
                <div className="h-3 bg-border/40 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : feedbacks.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-surface-page border border-border text-text-muted flex items-center justify-center mx-auto mb-3">
              <MessageSquareText size={22} />
            </div>
            <h3 className="text-sm font-bold text-text-primary mb-1">No feedbacks found</h3>
            <p className="text-xs text-text-secondary max-w-sm mx-auto">
              {search || statusFilter !== 'all'
                ? 'No feedbacks match your search or status filter. Try clearing the filters.'
                : 'No feedback items have been recorded yet. Use the box above to add the first one.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {feedbacks.map((item) => {
              const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending
              const linkedCall = typeof item.call === 'object' ? item.call : null
              const callIdentifier = item.call_id || linkedCall?.call_id || linkedCall?._id
              const isUpdatingStatus = updatingStatusId === item._id

              return (
                <div
                  key={item._id}
                  className="p-4 sm:p-5 hover:bg-surface-page/50 transition-colors flex flex-col gap-3 group"
                >
                  {/* Item Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    {/* User & Timestamp */}
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-surface-page border border-border flex items-center justify-center text-xs font-semibold text-text-primary uppercase shadow-2xs">
                        {item.user_name ? (
                          item.user_name.charAt(0)
                        ) : (
                          <User size={13} className="text-text-muted" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-text-primary">
                            {item.user_name || 'System / Admin'}
                          </span>
                          {item.user_email && (
                            <span className="text-[11px] text-text-muted font-mono">
                              ({item.user_email})
                            </span>
                          )}
                          {item.category && (
                            <span className="inline-block px-2 py-0.5 text-[10px] font-semibold bg-surface-page border border-border rounded-md text-text-secondary">
                              {item.category}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status Dropdown & Actions */}
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <span className="text-[11px] text-text-muted font-mono flex items-center gap-1">
                        <Clock size={11} />
                        {formatTime(item.createdAt).date} {formatTime(item.createdAt).time}
                      </span>

                      {/* Interactive Status Changer */}
                      <div className="relative inline-flex items-center">
                        <select
                          value={item.status}
                          disabled={isUpdatingStatus}
                          onChange={(e) =>
                            handleStatusChange(item._id, e.target.value as FeedbackStatus)
                          }
                          className={`text-[11px] font-bold rounded-lg px-2.5 py-1 border transition-all cursor-pointer appearance-none pr-6 focus:outline-none ${
                            statusCfg.badgeClass
                          } ${isUpdatingStatus ? 'opacity-50 pointer-events-none' : ''}`}
                        >
                          <option value="pending">Pending</option>
                          <option value="inprogress">In Progress</option>
                          <option value="resolved">Resolved</option>
                        </select>
                        <span
                          className={`absolute right-2 w-1.5 h-1.5 rounded-full pointer-events-none ${statusCfg.dotClass}`}
                        />
                      </div>

                      {/* Delete Button */}
                      <button
                        onClick={() => handleDeleteFeedback(item._id)}
                        className="p-1.5 rounded-lg text-text-muted hover:text-status-escalated hover:bg-rose-500/10 transition-colors opacity-60 group-hover:opacity-100 cursor-pointer"
                        title="Delete feedback"
                        aria-label="Delete feedback"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Feedback Text Content */}
                  <div className="text-xs text-text-primary leading-relaxed whitespace-pre-wrap pl-0 sm:pl-9.5">
                    {item.content}
                  </div>

                  {/* Linked Call Badge / Context Box */}
                  {callIdentifier && (
                    <div className="sm:ml-9.5 bg-surface-page border border-border/80 rounded-xl p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <div className="flex items-center gap-1.5 text-text-secondary">
                          <Phone size={12} className="text-text-muted" />
                          <span className="font-semibold text-[11px]">Linked Call:</span>
                        </div>

                        <span className="font-mono text-[11px] text-text-primary font-medium">
                          {callIdentifier}
                        </span>

                        <button
                          onClick={() => handleCopyCallId(callIdentifier)}
                          className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-card transition-colors cursor-pointer"
                          title="Copy Call ID"
                        >
                          {copiedId === callIdentifier ? (
                            <Check size={11} className="text-status-resolved" />
                          ) : (
                            <Copy size={11} />
                          )}
                        </button>

                        {linkedCall && (
                          <div className="flex items-center gap-2 text-[11px] text-text-secondary font-medium">
                            {linkedCall.caller_name && (
                              <span>• Caller: {linkedCall.caller_name}</span>
                            )}
                            {linkedCall.phone_number && (
                              <span>• {linkedCall.phone_number}</span>
                            )}
                          </div>
                        )}
                      </div>

                      <Link
                        to={`/calls?callId=${callIdentifier}`}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-text-primary hover:text-accent transition-colors self-start sm:self-auto cursor-pointer"
                      >
                        <span>View Call in Console</span>
                        <ArrowRight size={11} />
                      </Link>
                    </div>
                  )}

                  {/* Resolved footer stamp if available */}
                  {item.status === 'resolved' && (item.resolved_by || item.resolved_at) && (
                    <div className="sm:ml-9.5 text-[10px] text-text-muted flex items-center gap-1">
                      <CheckCircle2 size={11} className="text-status-resolved" />
                      <span>
                        Resolved{' '}
                        {item.resolved_by ? `by ${item.resolved_by}` : ''}{' '}
                        {item.resolved_at ? `on ${formatTime(item.resolved_at).date}` : ''}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Pagination Footer ──────────────────────────────────────── */}
        {!isLoading && feedbacks.length > 0 && (
          <div className="px-4 py-3 border-t border-border bg-surface-card flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-secondary">
            {/* Range info */}
            <div>
              Showing{' '}
              <span className="font-semibold text-text-primary">
                {(page - 1) * rowsPerPage + 1}
              </span>{' '}
              to{' '}
              <span className="font-semibold text-text-primary">
                {Math.min(page * rowsPerPage, totalFeedbacks)}
              </span>{' '}
              of <span className="font-semibold text-text-primary">{totalFeedbacks}</span> feedbacks
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-3">
              {/* Rows per page */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px]">Rows:</span>
                <select
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value))
                    setPage(1)
                  }}
                  className="bg-surface-page border border-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>

              {/* Prev / Next buttons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded-lg border border-border hover:bg-surface-page disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer text-text-primary"
                  title="Previous Page"
                >
                  <ChevronLeft size={14} />
                </button>

                <span className="px-2 py-1 font-mono text-[11px] font-semibold text-text-primary">
                  {page} / {totalPages}
                </span>

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded-lg border border-border hover:bg-surface-page disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer text-text-primary"
                  title="Next Page"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default FeedbacksPage

import { FC, useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { notificationApi, callApi, INotification } from '../api/client'
import { ICall } from '../types/call'
import {
  Bell,
  CheckCheck,
  Trash2,
  AlertTriangle,
  Info,
  CheckCircle2,
  PhoneCall,
  CreditCard,
  ShieldAlert,
  Ticket,
  User,
  ArrowRight,
} from 'lucide-react'

// ── Time Ago Formatter ────────────────────────────────────────────────────────
const timeAgo = (dateString?: string): string => {
  if (!dateString) return 'Recent'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return 'Recent'
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const getSeverityConfig = (severity: string, category: string) => {
  switch (severity) {
    case 'error':
      return {
        icon: ShieldAlert,
        iconColor: 'text-[#C1554A]',
        bg: 'bg-[#C1554A]/10',
        border: 'border-[#C1554A]/20',
      }
    case 'warning':
      return {
        icon: AlertTriangle,
        iconColor: 'text-[#C98A3B]',
        bg: 'bg-[#C98A3B]/10',
        border: 'border-[#C98A3B]/20',
      }
    case 'success':
      return {
        icon: CheckCircle2,
        iconColor: 'text-[#5B8C5A]',
        bg: 'bg-[#5B8C5A]/10',
        border: 'border-[#5B8C5A]/20',
      }
    default:
      if (category === 'call') {
        return {
          icon: PhoneCall,
          iconColor: 'text-accent',
          bg: 'bg-accent/10',
          border: 'border-accent/20',
        }
      }
      if (category === 'credit') {
        return {
          icon: CreditCard,
          iconColor: 'text-[#C98A3B]',
          bg: 'bg-[#C98A3B]/10',
          border: 'border-[#C98A3B]/20',
        }
      }
      if (category === 'ticket') {
        return {
          icon: Ticket,
          iconColor: 'text-[#5B8C5A]',
          bg: 'bg-[#5B8C5A]/10',
          border: 'border-[#5B8C5A]/20',
        }
      }
      return {
        icon: Info,
        iconColor: 'text-text-secondary',
        bg: 'bg-surface-page',
        border: 'border-border',
      }
  }
}

interface NotificationDropdownProps {
  escalatedCalls?: ICall[]
  onOpenEscalatedCall?: (callId: string) => void
}

export const NotificationDropdown: FC<NotificationDropdownProps> = ({
  escalatedCalls = [],
  onOpenEscalatedCall,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<INotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [activeTab, setActiveTab] = useState<'all' | 'escalated'>('all')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const [internalEscalated, setInternalEscalated] = useState<ICall[]>([])
  
  const activeEscalatedCalls = escalatedCalls.length > 0 ? escalatedCalls : internalEscalated
  const pendingEscalatedList = activeEscalatedCalls.filter((c) => c.status === 'escalated')
  const pendingEscalatedCount = pendingEscalatedList.length

  const fetchNotifications = async () => {
    try {
      const [notifRes, callsRes] = await Promise.all([
        notificationApi.getNotifications(),
        callApi.getAll(),
      ])
      if (notifRes.data.success) {
        setNotifications(notifRes.data.data.notifications)
        setUnreadCount(notifRes.data.data.unreadCount)
      }
      if (callsRes.data?.success && Array.isArray(callsRes.data.data)) {
        setInternalEscalated(callsRes.data.data.filter((c: ICall) => c.status === 'escalated'))
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err)
    }
  }

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 15000)

    // Listen for live call status resolution events across the app
    const handleStatusUpdate = () => {
      fetchNotifications()
    }
    window.addEventListener('call-status-updated', handleStatusUpdate)

    return () => {
      clearInterval(interval)
      window.removeEventListener('call-status-updated', handleStatusUpdate)
    }
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleMarkAsRead = async (id: string, link?: string) => {
    try {
      await notificationApi.markAsRead(id)
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
      if (link) {
        setIsOpen(false)
        navigate(link)
      }
    } catch (err) {
      console.error('Failed to mark read:', err)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await notificationApi.markAllAsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch (err) {
      console.error('Failed to mark all read:', err)
    }
  }

  const handleClearAll = async () => {
    try {
      await notificationApi.deleteAllNotifications()
      setNotifications([])
      setUnreadCount(0)
    } catch (err) {
      console.error('Failed to clear all notifications:', err)
    }
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    try {
      await notificationApi.deleteNotification(id)
      setNotifications((prev) => {
        const item = prev.find((n) => n._id === id)
        if (item && !item.read) setUnreadCount((count) => Math.max(0, count - 1))
        return prev.filter((n) => n._id !== id)
      })
    } catch (err) {
      console.error('Failed to delete notification:', err)
    }
  }

  const handleOpenEscalatedItem = (call: ICall) => {
    setIsOpen(false)
    const targetId = call._id || call.call_id
    if (onOpenEscalatedCall) {
      onOpenEscalatedCall(targetId)
    } else {
      navigate(`/calls?callId=${targetId}&tab=escalated`)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative text-text-secondary hover:text-text-primary transition-colors p-2 rounded-xl hover:bg-surface-page focus:outline-none cursor-pointer"
        title="Notifications & Escalations"
      >
        <Bell size={20} strokeWidth={1.75} />
        {pendingEscalatedCount > 0 ? (
          <span className="absolute top-0.5 right-0.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse">
            {pendingEscalatedCount}
          </span>
        ) : (
          unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-white leading-none shadow-xs">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-surface-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[540px] animate-in fade-in slide-in-from-top-2 duration-150">
          
          {/* Header */}
          <div className="p-4 border-b border-border flex items-center justify-between bg-surface-card">
            <div className="flex items-center space-x-2">
              <h3 className="text-[15px] font-semibold text-text-primary">Notifications</h3>
              {pendingEscalatedCount > 0 ? (
                <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-red-500/15 text-red-500 border border-red-500/30">
                  {pendingEscalatedCount} critical
                </span>
              ) : unreadCount > 0 ? (
                <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-accent-bg text-accent">
                  {unreadCount} unread
                </span>
              ) : null}
            </div>

            {notifications.length > 0 && (
              <div className="flex items-center space-x-3">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="flex items-center space-x-1 text-[12px] font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                    title="Mark all as read"
                  >
                    <CheckCheck size={14} />
                    <span>Mark read</span>
                  </button>
                )}
                <button
                  onClick={handleClearAll}
                  className="flex items-center space-x-1 text-[12px] font-medium text-text-secondary hover:text-[#C1554A] transition-colors cursor-pointer"
                  title="Clear all notifications"
                >
                  <Trash2 size={13} />
                  <span>Clear</span>
                </button>
              </div>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="px-4 py-2 border-b border-border bg-surface-page/50 flex space-x-2">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 text-[12px] font-medium rounded-lg transition-colors cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-surface-card text-text-primary shadow-2xs border border-border font-semibold'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              All ({notifications.length + pendingEscalatedCount})
            </button>
            <button
              onClick={() => setActiveTab('escalated')}
              className={`px-3 py-1 text-[12px] font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'escalated'
                  ? 'bg-surface-card text-red-500 shadow-2xs border border-red-500/30 font-semibold'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <span>Escalated</span>
              {pendingEscalatedCount > 0 && (
                <span className="px-1.5 py-0.2 text-[10px] font-mono rounded-full bg-red-500/20 text-red-500 font-bold">
                  {pendingEscalatedCount}
                </span>
              )}
            </button>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto divide-y divide-border scrollbar-thin">
            {/* 1. Pending Escalated Calls Section */}
            {pendingEscalatedList.map((call) => {
              const targetId = call._id || call.call_id
              const reason =
                call.red_flag_reason ||
                call.guardrail_triggered ||
                call.detected_intent ||
                'Agent Escalation Required'

              return (
                <div
                  key={targetId}
                  onClick={() => handleOpenEscalatedItem(call)}
                  className="p-4 bg-red-500/5 hover:bg-red-500/10 cursor-pointer transition-colors space-y-2 border-l-4 border-l-red-500"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-red-500 flex items-center gap-1.5 uppercase tracking-wider">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Critical Call Escalation
                    </span>
                    <span className="text-[11px] text-text-muted font-mono">
                      {timeAgo(call.timestamp)}
                    </span>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-text-muted" />
                      {call.caller_name || call.phone_number}
                    </p>
                    <p className="text-[11px] font-medium text-red-500/90 mt-0.5">
                      Escalation Reason: {reason}
                    </p>
                  </div>

                  {call.call_summary && (
                    <p className="text-xs text-text-secondary line-clamp-2 bg-surface-card p-2 rounded-lg border border-border">
                      {call.call_summary}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/15 text-red-500 font-bold">
                      Escalated
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenEscalatedItem(call)
                      }}
                      className="text-xs font-medium text-accent hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>Open Call</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )
            })}

            {/* 2. Standard Notifications Section */}
            {activeTab === 'all' && notifications.length === 0 && pendingEscalatedCount === 0 && (
              <div className="p-8 text-center flex flex-col items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-surface-page flex items-center justify-center mb-2 border border-border">
                  <Bell size={18} className="text-text-muted" />
                </div>
                <p className="text-[13px] font-medium text-text-primary">No notifications</p>
                <p className="text-[12px] text-text-muted mt-0.5">
                  All customer calls are operating normally!
                </p>
              </div>
            )}

            {activeTab === 'all' &&
              notifications.map((notification) => {
                const config = getSeverityConfig(notification.severity, notification.category)
                const IconComponent = config.icon

                return (
                  <div
                    key={notification._id}
                    onClick={() => handleMarkAsRead(notification._id, notification.link)}
                    className={`group p-4 flex items-start space-x-3 cursor-pointer transition-colors ${
                      !notification.read ? 'bg-surface-page/70 hover:bg-surface-page' : 'hover:bg-surface-page/50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg ${config.bg} ${config.border} border flex items-center justify-center shrink-0 mt-0.5`}>
                      <IconComponent size={16} className={config.iconColor} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-[13px] font-semibold text-text-primary truncate">
                          {notification.title}
                        </span>
                        <span className="text-[11px] text-text-muted shrink-0 tabular-nums">
                          {timeAgo(notification.createdAt)}
                        </span>
                      </div>
                      <p className="text-[12px] text-text-secondary line-clamp-2 leading-relaxed">
                        {notification.message}
                      </p>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0 self-center">
                      {!notification.read && (
                        <div className="w-2 h-2 rounded-full bg-accent shrink-0 group-hover:hidden" />
                      )}
                      <button
                        onClick={(e) => handleDelete(e, notification._id)}
                        className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-[#C1554A] transition-all p-1 cursor-pointer"
                        title="Delete notification"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-border bg-surface-page/50 text-center">
            <span className="text-[11px] text-text-muted">
              Live notifications active • Click any item to inspect call details
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

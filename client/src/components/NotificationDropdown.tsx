import { FC, useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { notificationApi, INotification } from '../api/client'
import { Bell, CheckCheck, Trash2, AlertCircle, AlertTriangle, Info, CheckCircle2, PhoneCall, CreditCard, ShieldAlert, Ticket } from 'lucide-react'

// ── Time Ago Formatter ────────────────────────────────────────────────────────
const timeAgo = (dateString: string): string => {
  const date = new Date(dateString)
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// ── Icon & Color Resolver ─────────────────────────────────────────────────────
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

export const NotificationDropdown: FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<INotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const fetchNotifications = async () => {
    try {
      const res = await notificationApi.getNotifications()
      if (res.data.success) {
        setNotifications(res.data.data.notifications)
        setUnreadCount(res.data.data.unreadCount)
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err)
    }
  }

  useEffect(() => {
    fetchNotifications()
    // Poll every 30 seconds for background updates
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
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
      setNotifications(prev =>
        prev.map(n => (n._id === id ? { ...n, read: true } : n))
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
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
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
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
      setNotifications(prev => {
        const item = prev.find(n => n._id === id)
        if (item && !item.read) setUnreadCount(count => Math.max(0, count - 1))
        return prev.filter(n => n._id !== id)
      })
    } catch (err) {
      console.error('Failed to delete notification:', err)
    }
  }

  const filteredNotifications = notifications.filter(n =>
    activeTab === 'unread' ? !n.read : true
  )

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative text-text-secondary hover:text-text-primary transition-colors p-2 rounded-lg hover:bg-surface-page focus:outline-none"
        title="Notifications"
      >
        <Bell size={20} strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-white leading-none shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-surface-card border border-border rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col max-h-[520px] animate-in fade-in slide-in-from-top-2 duration-150">
          
          {/* Header */}
          <div className="p-4 border-b border-border flex items-center justify-between bg-surface-card">
            <div className="flex items-center space-x-2">
              <h3 className="text-[15px] font-semibold text-text-primary">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-accent-bg text-accent">
                  {unreadCount} new
                </span>
              )}
            </div>

            {notifications.length > 0 && (
              <div className="flex items-center space-x-3">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="flex items-center space-x-1 text-[12px] font-medium text-text-secondary hover:text-text-primary transition-colors"
                    title="Mark all as read"
                  >
                    <CheckCheck size={14} />
                    <span>Mark all read</span>
                  </button>
                )}
                <button
                  onClick={handleClearAll}
                  className="flex items-center space-x-1 text-[12px] font-medium text-text-secondary hover:text-[#C1554A] transition-colors"
                  title="Clear all notifications"
                >
                  <Trash2 size={13} />
                  <span>Clear all</span>
                </button>
              </div>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="px-4 py-2 border-b border-border bg-surface-page/50 flex space-x-2">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-2.5 py-1 text-[12px] font-medium rounded-md transition-colors ${
                activeTab === 'all'
                  ? 'bg-surface-card text-text-primary shadow-sm border border-border'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setActiveTab('unread')}
              className={`px-2.5 py-1 text-[12px] font-medium rounded-md transition-colors ${
                activeTab === 'unread'
                  ? 'bg-surface-card text-text-primary shadow-sm border border-border'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* Notification Items List */}
          <div className="flex-1 overflow-y-auto divide-y divide-border scrollbar-thin">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-surface-page flex items-center justify-center mb-2 border border-border">
                  <Bell size={18} className="text-text-muted" />
                </div>
                <p className="text-[13px] font-medium text-text-primary">No notifications</p>
                <p className="text-[12px] text-text-muted mt-0.5">
                  {activeTab === 'unread' ? "You're all caught up!" : "No notifications yet."}
                </p>
              </div>
            ) : (
              filteredNotifications.map(notification => {
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
                    {/* Severity Icon */}
                    <div className={`w-8 h-8 rounded-lg ${config.bg} ${config.border} border flex items-center justify-center shrink-0 mt-0.5`}>
                      <IconComponent size={16} className={config.iconColor} />
                    </div>

                    {/* Content */}
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

                    {/* Unread indicator & Delete */}
                    <div className="flex items-center space-x-1 shrink-0 self-center">
                      {!notification.read && (
                        <div className="w-2 h-2 rounded-full bg-accent shrink-0 group-hover:hidden" />
                      )}
                      <button
                        onClick={e => handleDelete(e, notification._id)}
                        className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-[#C1554A] transition-all p-1"
                        title="Delete notification"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-border bg-surface-page/50 text-center">
            <span className="text-[11px] text-text-muted">
              System notifications auto-expire after 30 days
            </span>
          </div>

        </div>
      )}
    </div>
  )
}

import { FC, useState, useEffect } from 'react'
import {
  Bell,
  Mail,
  Plus,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  PhoneForwarded,
  Phone,
  PhoneCall,
  Send,
} from 'lucide-react'
import { settingsApi } from '../api/client'

interface SystemSettings {
  organization_name: string
  notify_on_escalation: boolean
  escalation_emails: string[]
  notify_on_callback: boolean
  callback_emails: string[]
  forward_to_human?: boolean
  forward_phone_number?: string
}

const SettingsPage: FC = () => {
  const [settings, setSettings] = useState<SystemSettings>({
    organization_name: 'Mantra Tech',
    notify_on_escalation: true,
    escalation_emails: ['admin@mantratec.com', 'escalations@mantratec.com'],
    notify_on_callback: true,
    callback_emails: ['callback@mantratec.com', 'support@mantratec.com'],
    forward_to_human: false,
    forward_phone_number: '',
  })

  const [isLoading, setIsLoading] = useState(true)

  // Routing Card states
  const [isSavingRouting, setIsSavingRouting] = useState(false)
  const [routingSaveSuccess, setRoutingSaveSuccess] = useState<string | null>(null)
  const [routingError, setRoutingError] = useState<string | null>(null)

  // Escalation Email states
  const [newEscalationInput, setNewEscalationInput] = useState('')
  const [escalationError, setEscalationError] = useState<string | null>(null)
  const [isTestingEscalation, setIsTestingEscalation] = useState(false)
  const [escalationTestMsg, setEscalationTestMsg] = useState<{ success: boolean; text: string } | null>(null)

  // Callback Email states
  const [newCallbackInput, setNewCallbackInput] = useState('')
  const [callbackError, setCallbackError] = useState<string | null>(null)
  const [isTestingCallback, setIsTestingCallback] = useState(false)
  const [callbackTestMsg, setCallbackTestMsg] = useState<{ success: boolean; text: string } | null>(null)

  // Global Notification Save states
  const [isSavingNotifications, setIsSavingNotifications] = useState(false)
  const [notificationsSaveSuccess, setNotificationsSaveSuccess] = useState<string | null>(null)
  const [notificationsError, setNotificationsError] = useState<string | null>(null)

  // Load settings on mount
  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    setIsLoading(true)
    try {
      const response = await settingsApi.get()
      if (response.data?.data) {
        const data = response.data.data
        setSettings(prev => ({
          ...prev,
          ...data,
          escalation_emails: Array.isArray(data.escalation_emails) ? data.escalation_emails : prev.escalation_emails,
          callback_emails: Array.isArray(data.callback_emails) ? data.callback_emails : prev.callback_emails,
          notify_on_escalation: data.notify_on_escalation !== undefined ? Boolean(data.notify_on_escalation) : prev.notify_on_escalation,
          notify_on_callback: data.notify_on_callback !== undefined ? Boolean(data.notify_on_callback) : prev.notify_on_callback,
        }))
      }
    } catch (err) {
      console.warn('Failed to fetch settings from API, using default state:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // ── Call Routing Handlers ──────────────────────────────────────────────────

  const handleToggleForwarding = (checked: boolean) => {
    setRoutingError(null)
    setRoutingSaveSuccess(null)

    if (checked) {
      const phone = (settings.forward_phone_number || '').trim()
      if (!phone || phone.length < 8) {
        setRoutingError('Please enter a destination phone number below before enabling call forwarding.')
        return
      }
    }

    setSettings(prev => ({ ...prev, forward_to_human: checked }))
  }

  const handleSaveRouting = async () => {
    setRoutingError(null)
    setRoutingSaveSuccess(null)

    const phone = (settings.forward_phone_number || '').trim()
    if (settings.forward_to_human && (!phone || phone.length < 8)) {
      setRoutingError('Please enter a valid phone number with country code (e.g. +919876543210) to enable forwarding.')
      return
    }

    setIsSavingRouting(true)
    try {
      const response = await settingsApi.update(settings)
      if (response.data?.data) {
        setSettings(prev => ({ ...prev, ...response.data.data }))
        setRoutingSaveSuccess('Routing settings saved successfully!')
        setTimeout(() => setRoutingSaveSuccess(null), 4000)
      }
    } catch (err: any) {
      console.error('Failed to save routing settings:', err)
      setRoutingError(err.response?.data?.message || 'Failed to save routing settings')
    } finally {
      setIsSavingRouting(false)
    }
  }

  // ── Escalation Email Handlers ──────────────────────────────────────────────

  const handleAddEscalationEmail = () => {
    setEscalationError(null)
    const email = newEscalationInput.trim().toLowerCase()
    if (!email) return

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setEscalationError('Please enter a valid email address')
      return
    }

    if (settings.escalation_emails.includes(email)) {
      setEscalationError('This email is already in the escalation list')
      return
    }

    setSettings(prev => ({
      ...prev,
      escalation_emails: [...prev.escalation_emails, email]
    }))
    setNewEscalationInput('')
  }

  const handleRemoveEscalationEmail = (emailToRemove: string) => {
    setSettings(prev => ({
      ...prev,
      escalation_emails: prev.escalation_emails.filter(e => e !== emailToRemove)
    }))
  }

  const handleTestEscalation = async () => {
    if (settings.escalation_emails.length === 0) {
      setEscalationTestMsg({ success: false, text: 'Add at least one recipient email before sending a test.' })
      return
    }

    setIsTestingEscalation(true)
    setEscalationTestMsg(null)
    try {
      const res = await settingsApi.sendTestEmail({
        emails: settings.escalation_emails,
        type: 'escalation',
      })
      if (res.data?.success) {
        setEscalationTestMsg({ success: true, text: 'Test escalation alert sent successfully!' })
      } else {
        setEscalationTestMsg({ success: false, text: res.data?.message || 'Failed to send test email' })
      }
    } catch (err: any) {
      setEscalationTestMsg({
        success: false,
        text: err.response?.data?.message || err.message || 'Error sending test email',
      })
    } finally {
      setIsTestingEscalation(false)
      setTimeout(() => setEscalationTestMsg(null), 6000)
    }
  }

  // ── Callback Email Handlers ────────────────────────────────────────────────

  const handleAddCallbackEmail = () => {
    setCallbackError(null)
    const email = newCallbackInput.trim().toLowerCase()
    if (!email) return

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setCallbackError('Please enter a valid email address')
      return
    }

    if (settings.callback_emails.includes(email)) {
      setCallbackError('This email is already in the callback list')
      return
    }

    setSettings(prev => ({
      ...prev,
      callback_emails: [...prev.callback_emails, email]
    }))
    setNewCallbackInput('')
  }

  const handleRemoveCallbackEmail = (emailToRemove: string) => {
    setSettings(prev => ({
      ...prev,
      callback_emails: prev.callback_emails.filter(e => e !== emailToRemove)
    }))
  }

  const handleTestCallback = async () => {
    if (settings.callback_emails.length === 0) {
      setCallbackTestMsg({ success: false, text: 'Add at least one recipient email before sending a test.' })
      return
    }

    setIsTestingCallback(true)
    setCallbackTestMsg(null)
    try {
      const res = await settingsApi.sendTestEmail({
        emails: settings.callback_emails,
        type: 'callback',
      })
      if (res.data?.success) {
        setCallbackTestMsg({ success: true, text: 'Test callback alert sent successfully!' })
      } else {
        setCallbackTestMsg({ success: false, text: res.data?.message || 'Failed to send test email' })
      }
    } catch (err: any) {
      setCallbackTestMsg({
        success: false,
        text: err.response?.data?.message || err.message || 'Error sending test email',
      })
    } finally {
      setIsTestingCallback(false)
      setTimeout(() => setCallbackTestMsg(null), 6000)
    }
  }

  // ── Save All Notifications ─────────────────────────────────────────────────

  const handleSaveNotifications = async () => {
    setIsSavingNotifications(true)
    setNotificationsSaveSuccess(null)
    setNotificationsError(null)

    try {
      const response = await settingsApi.update(settings)
      if (response.data?.data) {
        setSettings(prev => ({ ...prev, ...response.data.data }))
        setNotificationsSaveSuccess('Notification preferences & recipient channels saved successfully!')
        setTimeout(() => setNotificationsSaveSuccess(null), 4000)
      }
    } catch (err: any) {
      console.error('Failed to save notification settings:', err)
      setNotificationsError(err.response?.data?.message || 'Failed to save notification settings')
    } finally {
      setIsSavingNotifications(false)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-text-primary tracking-tight">System Settings</h2>
        <p className="text-sm text-text-secondary mt-1">
          Manage system preferences, inbound call routing, and separate email notification channels for escalations and callbacks.
        </p>
      </div>

      {isLoading ? (
        <div className="bg-surface-card rounded-2xl border border-border shadow-sm p-16 flex flex-col items-center justify-center space-y-3 text-text-secondary">
          <Loader2 className="animate-spin text-text-primary" size={28} />
          <span className="text-sm font-medium">Loading system settings...</span>
        </div>
      ) : (
        <>
          {/* Card 1: Call Routing & Forwarding */}
          <div className="bg-surface-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="border-b border-border bg-surface-page/50 px-6">
              <div className="flex items-center space-x-2 py-4">
                <PhoneForwarded size={18} className="text-blue-500" />
                <span className="text-sm font-semibold text-text-primary">Inbound Call Routing & Human Forwarding</span>
              </div>
            </div>

            <div className="p-6 md:p-8 space-y-6">
              {/* Toggle with badge */}
              <div className="flex items-center justify-between p-4 bg-surface-page rounded-xl border border-border">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2.5">
                    <PhoneForwarded size={18} className={settings.forward_to_human ? "text-amber-500" : "text-text-secondary"} />
                    <h3 className="text-base font-semibold text-text-primary">
                      Forward All Inbound Calls to Human Agent
                    </h3>
                    {settings.forward_to_human ? (
                      <span className="px-2.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-semibold rounded-full uppercase tracking-wider">
                        Human Forwarding Active
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 bg-green-50 border border-green-200 text-green-700 text-[11px] font-semibold rounded-full uppercase tracking-wider">
                        AI Voicebot Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary pl-7">
                    When enabled, incoming calls on Exotel bypass the AI Voicebot and forward directly to the destination phone number below.
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer ml-4">
                  <input
                    type="checkbox"
                    checked={Boolean(settings.forward_to_human)}
                    onChange={(e) => handleToggleForwarding(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
                </label>
              </div>

              {/* Forwarding Phone Number Input */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-primary flex items-center space-x-2">
                  <Phone size={16} className="text-text-secondary" />
                  <span>Forward Destination Phone Number</span>
                </label>
                <p className="text-xs text-text-secondary">
                  Enter the phone number with country code (e.g. <span className="font-mono font-medium">+919876543210</span>) that Exotel will dial.
                </p>
                <div className="flex space-x-2">
                  <input
                    type="tel"
                    value={settings.forward_phone_number || ''}
                    onChange={(e) => {
                      setRoutingError(null)
                      setSettings(prev => ({ ...prev, forward_phone_number: e.target.value }))
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleSaveRouting()
                      }
                    }}
                    placeholder="+919876543210"
                    className="w-full max-w-md px-3.5 py-2.5 bg-transparent border border-border rounded-xl focus:outline-none focus:border-text-primary text-sm font-mono text-text-primary transition-colors"
                  />
                </div>
              </div>

              {/* Routing Card Footer */}
              <div className="pt-4 border-t border-border flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {routingSaveSuccess && (
                    <span className="text-xs font-semibold text-green-600 flex items-center space-x-1 animate-fade-in">
                      <CheckCircle2 size={16} />
                      <span>{routingSaveSuccess}</span>
                    </span>
                  )}
                  {routingError && (
                    <span className="text-xs font-semibold text-red-500 flex items-center space-x-1 animate-fade-in">
                      <AlertCircle size={16} />
                      <span>{routingError}</span>
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleSaveRouting}
                  disabled={isSavingRouting}
                  className="px-5 py-2.5 bg-text-primary text-surface-card rounded-xl hover:bg-black text-xs font-semibold transition-all flex items-center space-x-2 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isSavingRouting && <Loader2 className="animate-spin" size={14} />}
                  <span>{isSavingRouting ? 'Saving...' : 'Save Routing Settings'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: Notification Channels & Alert Recipients */}
          <div className="bg-surface-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="border-b border-border bg-surface-page/50 px-6">
              <div className="flex items-center justify-between py-4">
                <div className="flex items-center space-x-2">
                  <Bell size={18} className="text-indigo-500" />
                  <div>
                    <span className="text-sm font-semibold text-text-primary">Notification Channels & Email Recipients</span>
                    <span className="ml-2 text-xs text-text-secondary hidden sm:inline">
                      Configure separate destination emails per call event
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 md:p-8 space-y-8">
              {/* ── USE CASE 1: Escalated Call Notifications ── */}
              <div className="rounded-xl border border-border bg-surface-page/40 p-5 space-y-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="p-1.5 rounded-lg bg-red-100 dark:bg-red-950/50 text-red-600">
                        <AlertCircle size={16} />
                      </span>
                      <h3 className="text-base font-semibold text-text-primary">
                        Escalated Call Notifications
                      </h3>
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400">
                        Priority Queue
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary pl-8">
                      Immediate email alerts dispatched when a call is escalated, encounters red flags, or requires manager intervention.
                    </p>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer ml-4">
                    <input
                      type="checkbox"
                      checked={Boolean(settings.notify_on_escalation)}
                      onChange={(e) =>
                        setSettings(prev => ({ ...prev, notify_on_escalation: e.target.checked }))
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                  </label>
                </div>

                {/* Email Input & Tags for Escalation */}
                <div className="space-y-3 pt-2">
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center justify-between">
                    <span>Escalation Email Recipients ({settings.escalation_emails.length})</span>
                    <button
                      type="button"
                      onClick={handleTestEscalation}
                      disabled={isTestingEscalation || settings.escalation_emails.length === 0}
                      className="text-xs font-medium text-red-600 hover:text-red-700 flex items-center space-x-1 disabled:opacity-40 cursor-pointer transition-colors normal-case"
                      title="Send a sample escalation email to verify recipient emails"
                    >
                      {isTestingEscalation ? (
                        <Loader2 className="animate-spin" size={12} />
                      ) : (
                        <Send size={12} />
                      )}
                      <span>{isTestingEscalation ? 'Sending Test...' : 'Send Test Escalation Alert'}</span>
                    </button>
                  </label>

                  {/* Test Feedback */}
                  {escalationTestMsg && (
                    <div
                      className={`text-xs px-3 py-2 rounded-lg flex items-center space-x-1.5 ${
                        escalationTestMsg.success
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                    >
                      {escalationTestMsg.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                      <span>{escalationTestMsg.text}</span>
                    </div>
                  )}

                  {/* Input Row */}
                  <div className="flex space-x-2">
                    <div className="relative flex-1">
                      <input
                        type="email"
                        value={newEscalationInput}
                        onChange={(e) => {
                          setNewEscalationInput(e.target.value)
                          setEscalationError(null)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAddEscalationEmail()
                          }
                        }}
                        placeholder="e.g. manager@mantratec.com, escalations@mantratec.com"
                        className="w-full pl-3.5 pr-4 py-2 bg-transparent border border-border rounded-xl focus:outline-none focus:border-red-500 text-sm text-text-primary transition-colors"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleAddEscalationEmail}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-sm cursor-pointer"
                    >
                      <Plus size={15} />
                      <span>Add</span>
                    </button>
                  </div>

                  {escalationError && (
                    <p className="text-xs text-red-500 font-medium flex items-center space-x-1">
                      <AlertCircle size={14} />
                      <span>{escalationError}</span>
                    </p>
                  )}

                  {/* Tag List */}
                  {settings.escalation_emails.length === 0 ? (
                    <div className="p-3.5 border border-dashed border-border rounded-xl text-center text-xs text-text-secondary bg-surface-card/50">
                      No escalation recipients added yet. Enter an email above to receive escalation alerts.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {settings.escalation_emails.map((email) => (
                        <div
                          key={email}
                          className="flex items-center space-x-2 px-3 py-1.5 bg-surface-card border border-border rounded-xl text-xs font-medium text-text-primary hover:border-red-300 transition-all shadow-2xs group"
                        >
                          <Mail size={13} className="text-red-500" />
                          <span className="font-mono text-xs">{email}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveEscalationEmail(email)}
                            title={`Remove ${email}`}
                            className="text-text-secondary hover:text-red-600 transition-colors p-1 rounded-md hover:bg-red-50 flex items-center justify-center ml-0.5 cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── USE CASE 2: Callback Required Notifications ── */}
              <div className="rounded-xl border border-border bg-surface-page/40 p-5 space-y-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600">
                        <PhoneCall size={16} />
                      </span>
                      <h3 className="text-base font-semibold text-text-primary">
                        Callback Required Notifications
                      </h3>
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400">
                        Follow-Up Queue
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary pl-8">
                      Immediate email alerts dispatched to sales or support follow-up teams whenever a caller requests a callback or agent follow-up.
                    </p>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer ml-4">
                    <input
                      type="checkbox"
                      checked={Boolean(settings.notify_on_callback)}
                      onChange={(e) =>
                        setSettings(prev => ({ ...prev, notify_on_callback: e.target.checked }))
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {/* Email Input & Tags for Callback */}
                <div className="space-y-3 pt-2">
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center justify-between">
                    <span>Callback Email Recipients ({settings.callback_emails.length})</span>
                    <button
                      type="button"
                      onClick={handleTestCallback}
                      disabled={isTestingCallback || settings.callback_emails.length === 0}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center space-x-1 disabled:opacity-40 cursor-pointer transition-colors normal-case"
                      title="Send a sample callback email to verify recipient emails"
                    >
                      {isTestingCallback ? (
                        <Loader2 className="animate-spin" size={12} />
                      ) : (
                        <Send size={12} />
                      )}
                      <span>{isTestingCallback ? 'Sending Test...' : 'Send Test Callback Alert'}</span>
                    </button>
                  </label>

                  {/* Test Feedback */}
                  {callbackTestMsg && (
                    <div
                      className={`text-xs px-3 py-2 rounded-lg flex items-center space-x-1.5 ${
                        callbackTestMsg.success
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                    >
                      {callbackTestMsg.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                      <span>{callbackTestMsg.text}</span>
                    </div>
                  )}

                  {/* Input Row */}
                  <div className="flex space-x-2">
                    <div className="relative flex-1">
                      <input
                        type="email"
                        value={newCallbackInput}
                        onChange={(e) => {
                          setNewCallbackInput(e.target.value)
                          setCallbackError(null)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAddCallbackEmail()
                          }
                        }}
                        placeholder="e.g. callback-team@mantratec.com, support@mantratec.com"
                        className="w-full pl-3.5 pr-4 py-2 bg-transparent border border-border rounded-xl focus:outline-none focus:border-indigo-500 text-sm text-text-primary transition-colors"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleAddCallbackEmail}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-sm cursor-pointer"
                    >
                      <Plus size={15} />
                      <span>Add</span>
                    </button>
                  </div>

                  {callbackError && (
                    <p className="text-xs text-red-500 font-medium flex items-center space-x-1">
                      <AlertCircle size={14} />
                      <span>{callbackError}</span>
                    </p>
                  )}

                  {/* Tag List */}
                  {settings.callback_emails.length === 0 ? (
                    <div className="p-3.5 border border-dashed border-border rounded-xl text-center text-xs text-text-secondary bg-surface-card/50">
                      No callback recipients added yet. Enter an email above to receive callback alerts.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {settings.callback_emails.map((email) => (
                        <div
                          key={email}
                          className="flex items-center space-x-2 px-3 py-1.5 bg-surface-card border border-border rounded-xl text-xs font-medium text-text-primary hover:border-indigo-300 transition-all shadow-2xs group"
                        >
                          <Mail size={13} className="text-indigo-500" />
                          <span className="font-mono text-xs">{email}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveCallbackEmail(email)}
                            title={`Remove ${email}`}
                            className="text-text-secondary hover:text-red-600 transition-colors p-1 rounded-md hover:bg-red-50 flex items-center justify-center ml-0.5 cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Notification Save Action Footer */}
              <div className="pt-4 border-t border-border flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {notificationsSaveSuccess && (
                    <span className="text-xs font-semibold text-green-600 flex items-center space-x-1 animate-fade-in">
                      <CheckCircle2 size={16} />
                      <span>{notificationsSaveSuccess}</span>
                    </span>
                  )}
                  {notificationsError && (
                    <span className="text-xs font-semibold text-red-500 flex items-center space-x-1 animate-fade-in">
                      <AlertCircle size={16} />
                      <span>{notificationsError}</span>
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleSaveNotifications}
                  disabled={isSavingNotifications}
                  className="px-6 py-2.5 bg-text-primary text-surface-card rounded-xl hover:bg-black text-xs font-semibold transition-all flex items-center space-x-2 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isSavingNotifications && <Loader2 className="animate-spin" size={14} />}
                  <span>{isSavingNotifications ? 'Saving...' : 'Save Notification Settings'}</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default SettingsPage
import { FC, useState, useEffect } from 'react'
import {
  Bell,
  Mail,
  Plus,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Trash2,
  PhoneForwarded,
  Phone,
  PhoneCall,
  Send,
  Package,
  Wrench,
  TrendingUp,
} from 'lucide-react'
import { settingsApi } from '../api/client'

interface SystemSettings {
  organization_name: string
  notify_on_escalation: boolean
  escalation_emails: string[]
  notify_on_callback: boolean
  callback_emails: string[]
  delivery_callback_emails: string[]
  repair_callback_emails: string[]
  device_issue_callback_emails: string[]
  sales_callback_emails: string[]
  forward_to_human?: boolean
  forward_phone_number?: string
}

type CallbackTab = 'delivery' | 'repair' | 'device_issue' | 'sales' | 'general'

interface CallbackCategoryConfig {
  id: CallbackTab
  name: string
  shortLabel: string
  badgeText: string
  icon: typeof Package
  accentColor: string
  badgeClass: string
  field: 'delivery_callback_emails' | 'repair_callback_emails' | 'device_issue_callback_emails' | 'sales_callback_emails' | 'callback_emails'
  testType: 'callback_delivery' | 'callback_repair' | 'callback_device_issue' | 'callback_sales' | 'callback'
  description: string
  placeholder: string
}

const CALLBACK_CATEGORY_CONFIG: CallbackCategoryConfig[] = [
  {
    id: 'delivery',
    name: 'New Device Delivery Enquiries',
    shortLabel: 'Delivery Enquiries',
    badgeText: 'Logistics & Dispatch',
    icon: Package,
    accentColor: 'text-sky-600',
    badgeClass: 'bg-sky-50 text-sky-700 border border-sky-200/80',
    field: 'delivery_callback_emails',
    testType: 'callback_delivery',
    description: 'Dispatched when a caller is asking about new device delivery, order dispatch, courier tracking, or shipment status.',
    placeholder: 'e.g. delivery@mantratec.com, dispatch@mantratec.com',
  },
  {
    id: 'repair',
    name: 'Device Repair & Service Status',
    shortLabel: 'Repair & RMA',
    badgeText: 'RMA / Service Desk',
    icon: Wrench,
    accentColor: 'text-amber-600',
    badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200/80',
    field: 'repair_callback_emails',
    testType: 'callback_repair',
    description: 'Dispatched when a caller sent their biometric device for repair / RMA / servicing and is asking for progress or return date.',
    placeholder: 'e.g. repair-desk@mantratec.com, rma@mantratec.com',
  },
  {
    id: 'device_issue',
    name: 'Device Not Working / Complaints',
    shortLabel: 'Device Issues',
    badgeText: 'Technical Support',
    icon: AlertTriangle,
    accentColor: 'text-rose-600',
    badgeClass: 'bg-rose-50 text-rose-700 border border-rose-200/80',
    field: 'device_issue_callback_emails',
    testType: 'callback_device_issue',
    description: 'Dispatched when a caller currently has the device and complains that it is malfunctioning, failing to scan, or not working.',
    placeholder: 'e.g. techsupport@mantratec.com, hardware-help@mantratec.com',
  },
  {
    id: 'sales',
    name: 'Sales, Bulk Orders & Quotation Enquiries',
    shortLabel: 'Sales & Quotes',
    badgeText: 'Commercial & Sales',
    icon: TrendingUp,
    accentColor: 'text-emerald-600',
    badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80',
    field: 'sales_callback_emails',
    testType: 'callback_sales',
    description: 'Dispatched when a caller is asking to buy devices, request quotations (RFQ), bulk purchases, or commercial pricing.',
    placeholder: 'e.g. sales@mantratec.com, b2b@mantratec.com',
  },
  {
    id: 'general',
    name: 'General & Fallback Callback Queue',
    shortLabel: 'General / Fallback',
    badgeText: 'Default Follow-Up',
    icon: PhoneCall,
    accentColor: 'text-indigo-600',
    badgeClass: 'bg-indigo-50 text-indigo-700 border border-indigo-200/80',
    field: 'callback_emails',
    testType: 'callback',
    description: 'Fallback queue for all other callback requests (RD service renewals, helpline busy callbacks) or when a category has no emails.',
    placeholder: 'e.g. callback@mantratec.com, support@mantratec.com',
  },
]


const SettingsPage: FC = () => {
  const [settings, setSettings] = useState<SystemSettings>({
    organization_name: 'Mantra Tech',
    notify_on_escalation: true,
    escalation_emails: ['admin@mantratec.com', 'escalations@mantratec.com'],
    notify_on_callback: true,
    callback_emails: ['callback@mantratec.com', 'support@mantratec.com'],
    delivery_callback_emails: ['delivery@mantratec.com'],
    repair_callback_emails: ['repair@mantratec.com'],
    device_issue_callback_emails: ['techsupport@mantratec.com'],
    sales_callback_emails: ['sales@mantratec.com'],
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

  // Categorized Callback Email states
  const [activeCallbackTab, setActiveCallbackTab] = useState<CallbackTab>('delivery')
  const [categoryInputs, setCategoryInputs] = useState<Record<CallbackTab, string>>({
    delivery: '',
    repair: '',
    device_issue: '',
    sales: '',
    general: '',
  })
  const [categoryErrors, setCategoryErrors] = useState<Record<CallbackTab, string | null>>({
    delivery: null,
    repair: null,
    device_issue: null,
    sales: null,
    general: null,
  })
  const [isTestingCategory, setIsTestingCategory] = useState<Record<CallbackTab, boolean>>({
    delivery: false,
    repair: false,
    device_issue: false,
    sales: false,
    general: false,
  })
  const [categoryTestMsgs, setCategoryTestMsgs] = useState<Record<CallbackTab, { success: boolean; text: string } | null>>({
    delivery: null,
    repair: null,
    device_issue: null,
    sales: null,
    general: null,
  })

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
          delivery_callback_emails: Array.isArray(data.delivery_callback_emails) ? data.delivery_callback_emails : prev.delivery_callback_emails,
          repair_callback_emails: Array.isArray(data.repair_callback_emails) ? data.repair_callback_emails : prev.repair_callback_emails,
          device_issue_callback_emails: Array.isArray(data.device_issue_callback_emails) ? data.device_issue_callback_emails : prev.device_issue_callback_emails,
          sales_callback_emails: Array.isArray(data.sales_callback_emails) ? data.sales_callback_emails : prev.sales_callback_emails,
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

  // ── Categorized Callback Email Handlers ───────────────────────────────────

  const getCategoryEmails = (catId: CallbackTab): string[] => {
    switch (catId) {
      case 'delivery':
        return settings.delivery_callback_emails || []
      case 'repair':
        return settings.repair_callback_emails || []
      case 'device_issue':
        return settings.device_issue_callback_emails || []
      case 'sales':
        return settings.sales_callback_emails || []
      case 'general':
      default:
        return settings.callback_emails || []
    }
  }

  const setCategoryEmails = (catId: CallbackTab, newEmails: string[]) => {
    setSettings(prev => {
      switch (catId) {
        case 'delivery':
          return { ...prev, delivery_callback_emails: newEmails }
        case 'repair':
          return { ...prev, repair_callback_emails: newEmails }
        case 'device_issue':
          return { ...prev, device_issue_callback_emails: newEmails }
        case 'sales':
          return { ...prev, sales_callback_emails: newEmails }
        case 'general':
        default:
          return { ...prev, callback_emails: newEmails }
      }
    })
  }

  const handleAddCategoryEmail = (catId: CallbackTab) => {
    setCategoryErrors(prev => ({ ...prev, [catId]: null }))
    const email = (categoryInputs[catId] || '').trim().toLowerCase()
    if (!email) return

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setCategoryErrors(prev => ({ ...prev, [catId]: 'Please enter a valid email address' }))
      return
    }

    const currentList = getCategoryEmails(catId)
    if (currentList.includes(email)) {
      setCategoryErrors(prev => ({ ...prev, [catId]: 'This email is already in this recipient list' }))
      return
    }

    setCategoryEmails(catId, [...currentList, email])
    setCategoryInputs(prev => ({ ...prev, [catId]: '' }))
  }

  const handleRemoveCategoryEmail = (catId: CallbackTab, emailToRemove: string) => {
    const currentList = getCategoryEmails(catId)
    setCategoryEmails(catId, currentList.filter(e => e !== emailToRemove))
  }

  const handleTestCategory = async (catId: CallbackTab) => {
    const currentList = getCategoryEmails(catId)
    if (currentList.length === 0) {
      setCategoryTestMsgs(prev => ({
        ...prev,
        [catId]: { success: false, text: 'Add at least one recipient email before sending a test.' }
      }))
      return
    }

    setIsTestingCategory(prev => ({ ...prev, [catId]: true }))
    setCategoryTestMsgs(prev => ({ ...prev, [catId]: null }))

    const testTypeMap: Record<CallbackTab, 'callback_delivery' | 'callback_repair' | 'callback_device_issue' | 'callback_sales' | 'callback'> = {
      delivery: 'callback_delivery',
      repair: 'callback_repair',
      device_issue: 'callback_device_issue',
      sales: 'callback_sales',
      general: 'callback',
    }

    try {
      const res = await settingsApi.sendTestEmail({
        emails: currentList,
        type: testTypeMap[catId],
      })
      if (res.data?.success) {
        setCategoryTestMsgs(prev => ({
          ...prev,
          [catId]: { success: true, text: res.data?.message || 'Test alert sent successfully!' }
        }))
      } else {
        setCategoryTestMsgs(prev => ({
          ...prev,
          [catId]: { success: false, text: res.data?.message || 'Failed to send test email' }
        }))
      }
    } catch (err: any) {
      setCategoryTestMsgs(prev => ({
        ...prev,
        [catId]: {
          success: false,
          text: err.response?.data?.message || err.message || 'Error sending test email',
        }
      }))
    } finally {
      setIsTestingCategory(prev => ({ ...prev, [catId]: false }))
      setTimeout(() => {
        setCategoryTestMsgs(prev => ({ ...prev, [catId]: null }))
      }, 6000)
    }
  }

  // ── Save All Notifications ─────────────────────────────────────────────────

  const handleSaveNotifications = async () => {
    setIsSavingNotifications(true)
    setNotificationsSaveSuccess(null)
    setNotificationsError(null)

    // Prepare updated settings including any pending input in active fields
    const updatedSettings = { ...settings }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    // Flush pending escalation email input if valid
    const pendingEsc = newEscalationInput.trim().toLowerCase()
    if (pendingEsc && emailRegex.test(pendingEsc) && !updatedSettings.escalation_emails.includes(pendingEsc)) {
      updatedSettings.escalation_emails = [...updatedSettings.escalation_emails, pendingEsc]
      setNewEscalationInput('')
    }

    // Flush any pending category email input if valid
    const catKeys: Record<CallbackTab, 'delivery_callback_emails' | 'repair_callback_emails' | 'device_issue_callback_emails' | 'sales_callback_emails' | 'callback_emails'> = {
      delivery: 'delivery_callback_emails',
      repair: 'repair_callback_emails',
      device_issue: 'device_issue_callback_emails',
      sales: 'sales_callback_emails',
      general: 'callback_emails',
    }

    const newInputs = { ...categoryInputs }
    for (const [cat, key] of Object.entries(catKeys) as [CallbackTab, (typeof catKeys)[CallbackTab]][]) {
      const pendingVal = (categoryInputs[cat] || '').trim().toLowerCase()
      if (pendingVal && emailRegex.test(pendingVal) && !updatedSettings[key].includes(pendingVal)) {
        updatedSettings[key] = [...updatedSettings[key], pendingVal]
        newInputs[cat] = ''
      }
    }
    setCategoryInputs(newInputs)
    setSettings(updatedSettings)

    try {
      const response = await settingsApi.update(updatedSettings)
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

            <div className="p-6 md:p-8 space-y-6">
              {/* ── USE CASE 1: Escalated Call Notifications ── */}
              <div className="rounded-xl border border-border bg-surface-page/40 p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2.5">
                      <span className="p-1.5 rounded-lg bg-rose-50 border border-rose-100 text-rose-600">
                        <AlertCircle size={16} />
                      </span>
                      <h4 className="text-sm font-semibold text-text-primary">
                        Escalated Call Notifications
                      </h4>
                      <span className="px-2.5 py-0.5 text-[10px] font-semibold rounded-full uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
                        Priority Queue
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary pl-8">
                      Immediate email alerts dispatched when a call is escalated, encounters red flags, or requires manager intervention.
                    </p>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer ml-4 shrink-0">
                    <input
                      type="checkbox"
                      checked={Boolean(settings.notify_on_escalation)}
                      onChange={(e) =>
                        setSettings(prev => ({ ...prev, notify_on_escalation: e.target.checked }))
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-text-primary"></div>
                  </label>
                </div>

                {/* Email Input & Tags for Escalation */}
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-text-secondary">
                      Escalation Email Recipients ({settings.escalation_emails.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleTestEscalation}
                      disabled={isTestingEscalation || settings.escalation_emails.length === 0}
                      className="text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-card px-2.5 py-1 rounded-lg border border-border flex items-center space-x-1.5 disabled:opacity-40 cursor-pointer transition-colors"
                      title="Send a sample escalation email to verify recipient emails"
                    >
                      {isTestingEscalation ? (
                        <Loader2 className="animate-spin" size={12} />
                      ) : (
                        <Send size={12} />
                      )}
                      <span>{isTestingEscalation ? 'Sending Test...' : 'Send Test Escalation Alert'}</span>
                    </button>
                  </div>

                  {/* Test Feedback */}
                  {escalationTestMsg && (
                    <div
                      className={`text-xs px-3 py-2 rounded-xl flex items-center space-x-1.5 ${
                        escalationTestMsg.success
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
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
                        className="w-full pl-3.5 pr-4 py-2 bg-surface-card border border-border hover:border-border-strong rounded-xl focus:outline-none focus:ring-1 focus:ring-text-primary/20 focus:border-text-primary text-xs text-text-primary placeholder:text-text-muted transition-all"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleAddEscalationEmail}
                      className="px-4 py-2 bg-text-primary hover:bg-black text-surface-card rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-2xs cursor-pointer shrink-0"
                    >
                      <Plus size={14} />
                      <span>Add</span>
                    </button>
                  </div>

                  {escalationError && (
                    <p className="text-xs text-rose-600 font-medium flex items-center space-x-1">
                      <AlertCircle size={14} />
                      <span>{escalationError}</span>
                    </p>
                  )}

                  {/* Tag List */}
                  {settings.escalation_emails.length === 0 ? (
                    <div className="p-4 border border-dashed border-border rounded-xl text-center text-xs text-text-secondary bg-surface-card/60">
                      No escalation recipients added yet. Enter an email above to receive escalation alerts.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {settings.escalation_emails.map((email) => (
                        <div
                          key={email}
                          className="flex items-center space-x-2 px-3 py-1.5 bg-surface-card border border-border rounded-xl text-xs font-medium text-text-primary hover:border-border-strong transition-all shadow-2xs group"
                        >
                          <Mail size={13} className="text-rose-500" />
                          <span className="font-mono text-xs">{email}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveEscalationEmail(email)}
                            title={`Remove ${email}`}
                            className="text-text-muted hover:text-rose-600 hover:bg-rose-50 transition-colors p-1 rounded-md flex items-center justify-center ml-0.5 cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── USE CASE 2: Categorized Callback Notifications & Routing ── */}
              <div className="rounded-xl border border-border bg-surface-page/40 p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2.5">
                      <span className="p-1.5 rounded-lg bg-blue-50 border border-blue-100 text-blue-600">
                        <PhoneCall size={16} />
                      </span>
                      <h4 className="text-sm font-semibold text-text-primary">
                        Callback Notifications & Department Routing
                      </h4>
                      <span className="px-2.5 py-0.5 text-[10px] font-semibold rounded-full uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                        Multi-Queue Routing
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary pl-8">
                      Route callback requests to separate recipient emails based on the enquiry type: New Device Delivery, Repair Status, Device Not Working complaints, or General Follow-up.
                    </p>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer ml-4 shrink-0">
                    <input
                      type="checkbox"
                      checked={Boolean(settings.notify_on_callback)}
                      onChange={(e) =>
                        setSettings(prev => ({ ...prev, notify_on_callback: e.target.checked }))
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-text-primary"></div>
                  </label>
                </div>

                {/* Category Navigation Tabs */}
                <div className="space-y-4 pt-1">
                  <div className="p-1 bg-surface-card border border-border rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-1">
                    {CALLBACK_CATEGORY_CONFIG.map((cat) => {
                      const IconComponent = cat.icon
                      const count = getCategoryEmails(cat.id).length
                      const isActive = activeCallbackTab === cat.id

                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setActiveCallbackTab(cat.id)}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all cursor-pointer ${
                            isActive
                              ? 'bg-surface-page text-text-primary shadow-xs border border-border/80 font-semibold'
                              : 'text-text-secondary hover:text-text-primary hover:bg-surface-page/50 font-medium'
                          }`}
                        >
                          <div className="flex items-center space-x-2 min-w-0">
                            <IconComponent size={14} className={isActive ? cat.accentColor : 'text-text-muted'} />
                            <span className="truncate">{cat.shortLabel}</span>
                          </div>
                          <span
                            className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold shrink-0 ${
                              count > 0
                                ? isActive
                                  ? 'bg-text-primary text-surface-card'
                                  : 'bg-surface-card border border-border text-text-secondary'
                                : 'text-text-muted opacity-50'
                            }`}
                          >
                            {count}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  {/* Active Category Studio Card */}
                  {(() => {
                    const activeCat = CALLBACK_CATEGORY_CONFIG.find(c => c.id === activeCallbackTab) || CALLBACK_CATEGORY_CONFIG[0]
                    const IconComponent = activeCat.icon
                    const currentList = getCategoryEmails(activeCat.id)
                    const inputVal = categoryInputs[activeCat.id] || ''
                    const errorMsg = categoryErrors[activeCat.id]
                    const isTesting = isTestingCategory[activeCat.id]
                    const testMsg = categoryTestMsgs[activeCat.id]

                    return (
                      <div className="p-5 rounded-xl border border-border bg-surface-card space-y-4 shadow-2xs transition-all">
                        {/* Header Row */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center space-x-2.5">
                            <span className={`p-2 rounded-xl bg-surface-page border border-border ${activeCat.accentColor}`}>
                              <IconComponent size={16} />
                            </span>
                            <div>
                              <div className="flex items-center space-x-2">
                                <h4 className="text-sm font-semibold text-text-primary">
                                  {activeCat.name}
                                </h4>
                                <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full uppercase tracking-wider ${activeCat.badgeClass}`}>
                                  {activeCat.badgeText}
                                </span>
                              </div>
                              <p className="text-xs text-text-secondary mt-0.5">
                                {activeCat.description}
                              </p>
                            </div>
                          </div>

                          {/* Test Button for this Category */}
                          <button
                            type="button"
                            onClick={() => handleTestCategory(activeCat.id)}
                            disabled={isTesting || currentList.length === 0}
                            className="text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-page px-2.5 py-1.5 rounded-lg border border-border flex items-center space-x-1.5 disabled:opacity-40 cursor-pointer transition-colors self-start sm:self-center shrink-0"
                            title={`Send a sample ${activeCat.shortLabel} alert to verify recipients`}
                          >
                            {isTesting ? (
                              <Loader2 className="animate-spin" size={12} />
                            ) : (
                              <Send size={12} />
                            )}
                            <span>{isTesting ? 'Sending Test...' : `Test ${activeCat.shortLabel} Alert`}</span>
                          </button>
                        </div>

                        {/* Test Feedback */}
                        {testMsg && (
                          <div
                            className={`text-xs px-3 py-2 rounded-xl flex items-center space-x-1.5 ${
                              testMsg.success
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {testMsg.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                            <span>{testMsg.text}</span>
                          </div>
                        )}

                        {/* Input Row */}
                        <div className="flex space-x-2">
                          <div className="relative flex-1">
                            <input
                              type="email"
                              value={inputVal}
                              onChange={(e) => {
                                setCategoryInputs(prev => ({ ...prev, [activeCat.id]: e.target.value }))
                                setCategoryErrors(prev => ({ ...prev, [activeCat.id]: null }))
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  handleAddCategoryEmail(activeCat.id)
                                }
                              }}
                              placeholder={activeCat.placeholder}
                              className="w-full pl-3.5 pr-4 py-2 bg-surface-page/50 border border-border hover:border-border-strong rounded-xl focus:outline-none focus:ring-1 focus:ring-text-primary/20 focus:border-text-primary text-xs text-text-primary placeholder:text-text-muted transition-all"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleAddCategoryEmail(activeCat.id)}
                            className="px-4 py-2 bg-text-primary hover:bg-black text-surface-card rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-2xs cursor-pointer shrink-0"
                          >
                            <Plus size={14} />
                            <span>Add</span>
                          </button>
                        </div>

                        {errorMsg && (
                          <p className="text-xs text-rose-600 font-medium flex items-center space-x-1">
                            <AlertCircle size={14} />
                            <span>{errorMsg}</span>
                          </p>
                        )}

                        {/* Recipients List */}
                        {currentList.length === 0 ? (
                          <div className="p-4 border border-dashed border-border rounded-xl text-center text-xs text-text-secondary bg-surface-page/30">
                            No recipient emails for {activeCat.name} yet. If empty, alerts will automatically fall back to General / Fallback recipients.
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2 pt-0.5">
                            {currentList.map((email) => (
                              <div
                                key={email}
                                className="flex items-center space-x-2 px-3 py-1.5 bg-surface-page border border-border rounded-xl text-xs font-medium text-text-primary hover:border-border-strong transition-all shadow-2xs group"
                              >
                                <Mail size={13} className={activeCat.accentColor} />
                                <span className="font-mono text-xs">{email}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCategoryEmail(activeCat.id, email)}
                                  title={`Remove ${email}`}
                                  className="text-text-muted hover:text-rose-600 hover:bg-rose-50 transition-colors p-1 rounded-md flex items-center justify-center ml-0.5 cursor-pointer"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })()}
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
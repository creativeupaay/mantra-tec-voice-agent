import { FC, useState, useEffect } from 'react'
import {
  Bell,
  Mail,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  PhoneForwarded,
  Phone
} from 'lucide-react'
import { settingsApi } from '../api/client'

interface SystemSettings {
  organization_name: string
  notify_on_escalation: boolean
  escalation_emails: string[]
  forward_to_human?: boolean
  forward_phone_number?: string
}

const SettingsPage: FC = () => {
  const [settings, setSettings] = useState<SystemSettings>({
    organization_name: 'Mantra Tech',
    notify_on_escalation: true,
    escalation_emails: ['admin@mantratec.com', 'escalations@mantratec.com'],
    forward_to_human: false,
    forward_phone_number: '',
  })

  const [newEmailInput, setNewEmailInput] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)

  // Load settings on mount
  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    setIsLoading(true)
    try {
      const response = await settingsApi.get()
      if (response.data?.data) {
        setSettings(response.data.data)
      }
    } catch (err) {
      console.warn('Failed to fetch settings from API, using default state:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddEmail = () => {
    setEmailError(null)
    const email = newEmailInput.trim().toLowerCase()

    if (!email) return

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setEmailError('Please enter a valid email address')
      return
    }

    if (settings.escalation_emails.includes(email)) {
      setEmailError('This email is already in the notification list')
      return
    }

    setSettings(prev => ({
      ...prev,
      escalation_emails: [...prev.escalation_emails, email]
    }))
    setNewEmailInput('')
  }

  const handleRemoveEmail = (emailToRemove: string) => {
    setSettings(prev => ({
      ...prev,
      escalation_emails: prev.escalation_emails.filter(e => e !== emailToRemove)
    }))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddEmail()
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaveSuccess(null)

    try {
      const response = await settingsApi.update(settings)
      if (response.data?.data) {
        setSettings(response.data.data)
        setSaveSuccess('Settings saved successfully!')
        setTimeout(() => setSaveSuccess(null), 4000)
      }
    } catch (err: any) {
      console.error('Failed to save settings:', err)
      alert(err.response?.data?.message || 'Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-text-primary tracking-tight">System Settings</h2>
        <p className="text-sm text-text-secondary mt-1">
          Manage system preferences, inbound call routing, and escalation alert recipients.
        </p>
      </div>

      {/* Call Routing & Forwarding Card */}
      <div className="bg-surface-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="border-b border-border bg-surface-page/50 px-6">
          <div className="flex items-center space-x-2 py-4">
            <PhoneForwarded size={18} className="text-blue-500" />
            <span className="text-sm font-semibold text-text-primary">Inbound Call Routing & Human Forwarding</span>
          </div>
        </div>

        <div className="p-6 md:p-8 space-y-6">
          {/* Toggle */}
          <div className="flex items-center justify-between p-4 bg-surface-page rounded-xl border border-border">
            <div className="space-y-0.5">
              <div className="flex items-center space-x-2">
                <PhoneForwarded size={18} className={settings.forward_to_human ? "text-amber-500" : "text-text-secondary"} />
                <h3 className="text-base font-semibold text-text-primary">
                  Forward All Inbound Calls to Human Agent
                </h3>
                {settings.forward_to_human ? (
                  <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-semibold rounded-full uppercase tracking-wider">
                    Human Forwarding Active
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-green-50 border border-green-200 text-green-700 text-[10px] font-semibold rounded-full uppercase tracking-wider">
                    AI Voicebot Active
                  </span>
                )}
              </div>
              <p className="text-xs text-text-secondary pl-6">
                When enabled, incoming calls on Exotel will immediately bypass the AI Voicebot and forward directly to the human phone number below.
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(settings.forward_to_human)}
                onChange={(e) =>
                  setSettings(prev => ({ ...prev, forward_to_human: e.target.checked }))
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
            </label>
          </div>

          {/* Forwarding Phone Number */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-text-primary flex items-center space-x-2">
              <Phone size={16} className="text-text-secondary" />
              <span>Forward Destination Phone Number</span>
            </label>
            <p className="text-xs text-text-secondary">
              Enter the phone number in international format with country code (e.g. <span className="font-mono font-medium">+919876543210</span>) that Exotel will dial when forwarding is turned on.
            </p>
            <input
              type="tel"
              value={settings.forward_phone_number || ''}
              onChange={(e) =>
                setSettings(prev => ({ ...prev, forward_phone_number: e.target.value }))
              }
              placeholder="+919876543210"
              className="w-full max-w-md px-3.5 py-2.5 bg-transparent border border-border rounded-xl focus:outline-none focus:border-text-primary text-sm font-mono text-text-primary transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Main Settings Card */}
      <div className="bg-surface-card rounded-2xl border border-border shadow-sm overflow-hidden">
        {/* Section Header */}
        <div className="border-b border-border bg-surface-page/50 px-6">
          <div className="flex items-center space-x-2 py-4">
            <Bell size={18} className="text-red-500" />
            <span className="text-sm font-semibold text-text-primary">Escalated Call Notifications</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 md:p-8 space-y-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 space-x-3 text-text-secondary">
              <Loader2 className="animate-spin" size={24} />
              <span className="text-sm font-medium">Loading system settings...</span>
            </div>
          ) : (
            <>
              {/* Notification Enable Toggle */}
              <div className="flex items-center justify-between p-4 bg-surface-page rounded-xl border border-border">
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <Bell size={18} className="text-red-500" />
                    <h3 className="text-base font-semibold text-text-primary">
                      Email Notifications for Escalated Calls
                    </h3>
                  </div>
                  <p className="text-xs text-text-secondary pl-6">
                    Automatically send email alerts whenever a customer call is escalated or requires urgent attention.
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notify_on_escalation}
                    onChange={(e) =>
                      setSettings(prev => ({ ...prev, notify_on_escalation: e.target.checked }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
                </label>
              </div>

              {/* Multiple Email Recipients Input & Badges */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-text-primary flex items-center space-x-2">
                    <Mail size={16} className="text-text-secondary" />
                    <span>Escalation Email Recipients</span>
                  </h4>
                  <p className="text-xs text-text-secondary mt-1">
                    Add multiple email addresses that will receive instant notification alerts for every escalated call.
                  </p>
                </div>

                {/* Email Input Field */}
                <div className="space-y-2">
                  <div className="flex space-x-2">
                    <div className="relative flex-1">
                      <input
                        type="email"
                        value={newEmailInput}
                        onChange={(e) => {
                          setNewEmailInput(e.target.value)
                          setEmailError(null)
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder="Enter email address (e.g. manager@mantratec.com)"
                        className="w-full pl-3.5 pr-10 py-2.5 bg-transparent border border-border rounded-xl focus:outline-none focus:border-text-primary text-sm text-text-primary transition-colors"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleAddEmail}
                      className="px-4 py-2.5 bg-text-primary text-surface-card rounded-xl hover:bg-black text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-sm"
                    >
                      <Plus size={16} />
                      <span>Add Email</span>
                    </button>
                  </div>

                  {emailError && (
                    <p className="text-xs text-red-500 font-medium flex items-center space-x-1">
                      <AlertCircle size={14} />
                      <span>{emailError}</span>
                    </p>
                  )}
                </div>

                {/* Active Recipients List */}
                <div className="pt-2">
                  <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                    Configured Recipients ({settings.escalation_emails.length})
                  </label>

                  {settings.escalation_emails.length === 0 ? (
                    <div className="p-4 border border-dashed border-border rounded-xl text-center text-xs text-text-secondary">
                      No email recipients added yet. Enter an email above to add notification targets.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2.5">
                      {settings.escalation_emails.map((email) => (
                        <div
                          key={email}
                          className="flex items-center space-x-2.5 px-3.5 py-2 bg-surface-page border border-border rounded-xl text-xs font-medium text-text-primary group hover:border-red-300 transition-all shadow-2xs"
                        >
                          <Mail size={14} className="text-text-secondary" />
                          <span className="font-mono text-xs">{email}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveEmail(email)}
                            title={`Remove ${email}`}
                            className="text-text-secondary hover:text-red-600 transition-colors p-1 rounded-md hover:bg-red-50 flex items-center justify-center ml-1"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Global Save Action Footer */}
              <div className="pt-6 border-t border-border flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {saveSuccess && (
                    <span className="text-xs font-semibold text-green-600 flex items-center space-x-1 animate-fade-in">
                      <CheckCircle2 size={16} />
                      <span>{saveSuccess}</span>
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-text-primary text-surface-card rounded-xl hover:bg-black text-xs font-semibold transition-all flex items-center space-x-2 shadow-sm disabled:opacity-50"
                >
                  {isSaving && <Loader2 className="animate-spin" size={14} />}
                  <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
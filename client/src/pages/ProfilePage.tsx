import { FC, useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { authApi, analyticsApi } from '../api/client'
import { User, Mail, Shield, Key, Bell, CheckCircle2, AlertCircle, RefreshCw, CreditCard } from 'lucide-react'

export const ProfilePage: FC = () => {
  const { user, login } = useAuth()

  // Profile Form State
  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Credit Balance State
  const [creditBalance, setCreditBalance] = useState<number | null>(user?.creditBalance ?? null)

  // Preferences State (local state mock)
  const [prefs, setPrefs] = useState({
    redFlagAlerts: true,
    escalationAlerts: true,
    creditLowAlerts: true,
    systemUpdates: false,
  })

  useEffect(() => {
    if (user) {
      setName(user.name)
      setEmail(user.email)
    }
    // Fetch latest credit balance
    analyticsApi.getCreditBalance()
      .then(res => {
        if (res.data.success) setCreditBalance(res.data.data.creditBalance)
      })
      .catch(() => {})
  }, [user])

  // Handle Profile Update
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileMsg(null)
    setProfileLoading(true)

    try {
      const res = await authApi.updateProfile({ name, email })
      if (res.data.success) {
        setProfileMsg({ type: 'success', text: 'Profile updated successfully!' })
        // Refresh token / state if email/name changed
      }
    } catch (err: any) {
      setProfileMsg({
        type: 'error',
        text: err.response?.data?.message || 'Failed to update profile. Please try again.',
      })
    } finally {
      setProfileLoading(false)
    }
  }

  // Handle Password Change
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordMsg(null)

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New password and confirm password do not match.' })
      return
    }

    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 6 characters long.' })
      return
    }

    setPasswordLoading(true)

    try {
      const res = await authApi.changePassword({ currentPassword, newPassword })
      if (res.data.success) {
        setPasswordMsg({ type: 'success', text: 'Password changed successfully!' })
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      }
    } catch (err: any) {
      setPasswordMsg({
        type: 'error',
        text: err.response?.data?.message || 'Failed to change password. Please check your current password.',
      })
    } finally {
      setPasswordLoading(false)
    }
  }

  return (
    <div className="space-y-6 pb-12">

      {/* ── HEADER ── */}
      <div>
        <h2 className="text-2xl font-semibold text-text-primary tracking-tight">Account Profile</h2>
        <p className="text-[14px] text-text-secondary mt-1">
          Manage your account settings, security options, and notifications.
        </p>
      </div>

      {/* ── PROFILE OVERVIEW CARD ── */}
      <div className="bg-surface-card rounded-2xl border border-border p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-2xl bg-text-primary text-surface-card flex items-center justify-center text-2xl font-semibold border border-border">
            {name ? name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-xl font-semibold text-text-primary">{name || 'User Profile'}</h3>
              <span className="px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase rounded-full bg-accent-bg text-accent border border-accent/20">
                {user?.role || 'Admin'}
              </span>
            </div>
            <p className="text-[13px] text-text-secondary mt-0.5">{email}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center space-x-6 border-t md:border-t-0 md:border-l border-border pt-4 md:pt-0 md:pl-6">
          <div>
            <p className="text-[11px] font-medium text-text-secondary uppercase tracking-wider">Account Role</p>
            <p className="text-[14px] font-semibold text-text-primary capitalize mt-0.5">{user?.role?.replace('_', ' ') || 'Admin'}</p>
          </div>
        </div>
      </div>

      {/* ── TWO-COLUMN GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── EDIT PROFILE DETAILS ── */}
        <div className="bg-surface-card rounded-2xl border border-border shadow-sm flex flex-col">
          <div className="px-6 py-5 border-b border-border flex items-center space-x-2">
            <User size={18} className="text-text-secondary" />
            <h3 className="text-[15px] font-semibold text-text-primary">Personal Details</h3>
          </div>

          <form onSubmit={handleProfileSubmit} className="p-6 space-y-4 flex-1 flex flex-col justify-between">
            <div className="space-y-4">
              {profileMsg && (
                <div className={`p-3 rounded-lg text-[13px] flex items-center space-x-2 border ${
                  profileMsg.type === 'success'
                    ? 'bg-[#5B8C5A]/10 border-[#5B8C5A]/20 text-[#5B8C5A]'
                    : 'bg-[#C1554A]/10 border-[#C1554A]/20 text-[#C1554A]'
                }`}>
                  {profileMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>{profileMsg.text}</span>
                </div>
              )}

              <div>
                <label className="block text-[13px] font-medium text-text-secondary mb-1.5">Full Name</label>
                <div className="relative">
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    className="w-full pl-9 pr-3 py-2.5 bg-transparent border border-border rounded-lg focus:outline-none focus:border-text-primary text-[14px] text-text-primary transition-colors"
                  />
                  <User size={16} className="absolute left-3 top-3 text-text-muted" />
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-text-secondary mb-1.5">Email Address</label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="w-full pl-9 pr-3 py-2.5 bg-transparent border border-border rounded-lg focus:outline-none focus:border-text-primary text-[14px] text-text-primary transition-colors"
                  />
                  <Mail size={16} className="absolute left-3 top-3 text-text-muted" />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border mt-6">
              <button
                type="submit"
                disabled={profileLoading}
                className="px-5 py-2.5 bg-text-primary text-surface-card rounded-lg hover:bg-black text-[13px] font-medium transition-colors disabled:opacity-50 flex items-center space-x-2"
              >
                {profileLoading && <RefreshCw size={14} className="animate-spin" />}
                <span>Save Changes</span>
              </button>
            </div>
          </form>
        </div>

        {/* ── SECURITY / CHANGE PASSWORD ── */}
        <div className="bg-surface-card rounded-2xl border border-border shadow-sm flex flex-col">
          <div className="px-6 py-5 border-b border-border flex items-center space-x-2">
            <Key size={18} className="text-text-secondary" />
            <h3 className="text-[15px] font-semibold text-text-primary">Change Password</h3>
          </div>

          <form onSubmit={handlePasswordSubmit} className="p-6 space-y-4 flex-1 flex flex-col justify-between">
            <div className="space-y-4">
              {passwordMsg && (
                <div className={`p-3 rounded-lg text-[13px] flex items-center space-x-2 border ${
                  passwordMsg.type === 'success'
                    ? 'bg-[#5B8C5A]/10 border-[#5B8C5A]/20 text-[#5B8C5A]'
                    : 'bg-[#C1554A]/10 border-[#C1554A]/20 text-[#C1554A]'
                }`}>
                  {passwordMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>{passwordMsg.text}</span>
                </div>
              )}

              <div>
                <label className="block text-[13px] font-medium text-text-secondary mb-1.5">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-3 py-2.5 bg-transparent border border-border rounded-lg focus:outline-none focus:border-text-primary text-[14px] text-text-primary transition-colors"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-text-secondary mb-1.5">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  className="w-full px-3 py-2.5 bg-transparent border border-border rounded-lg focus:outline-none focus:border-text-primary text-[14px] text-text-primary transition-colors"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-text-secondary mb-1.5">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                  className="w-full px-3 py-2.5 bg-transparent border border-border rounded-lg focus:outline-none focus:border-text-primary text-[14px] text-text-primary transition-colors"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-border mt-6">
              <button
                type="submit"
                disabled={passwordLoading}
                className="px-5 py-2.5 bg-text-primary text-surface-card rounded-lg hover:bg-black text-[13px] font-medium transition-colors disabled:opacity-50 flex items-center space-x-2"
              >
                {passwordLoading && <RefreshCw size={14} className="animate-spin" />}
                <span>Update Password</span>
              </button>
            </div>
          </form>
        </div>

      </div>

      {/* ── NOTIFICATION PREFERENCES ── */}
      <div className="bg-surface-card rounded-2xl border border-border shadow-sm">
        <div className="px-6 py-5 border-b border-border flex items-center space-x-2">
          <Bell size={18} className="text-text-secondary" />
          <h3 className="text-[15px] font-semibold text-text-primary">Notification Preferences</h3>
        </div>

        <div className="p-6 divide-y divide-border">
          <div className="py-3.5 flex items-center justify-between">
            <div>
              <p className="text-[14px] font-medium text-text-primary">Red Flag Call Alerts</p>
              <p className="text-[12px] text-text-secondary mt-0.5">Receive immediate notifications when a call triggers guardrails or red flags.</p>
            </div>
            <button
              onClick={() => setPrefs(p => ({ ...p, redFlagAlerts: !p.redFlagAlerts }))}
              className={`w-11 h-6 rounded-full transition-colors relative ${prefs.redFlagAlerts ? 'bg-accent' : 'bg-border-strong'}`}
            >
              <span className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${prefs.redFlagAlerts ? 'left-6' : 'left-1'}`} />
            </button>
          </div>

          <div className="py-3.5 flex items-center justify-between">
            <div>
              <p className="text-[14px] font-medium text-text-primary">Escalation Warnings</p>
              <p className="text-[12px] text-text-secondary mt-0.5">Notify when calls require human agent escalation.</p>
            </div>
            <button
              onClick={() => setPrefs(p => ({ ...p, escalationAlerts: !p.escalationAlerts }))}
              className={`w-11 h-6 rounded-full transition-colors relative ${prefs.escalationAlerts ? 'bg-accent' : 'bg-border-strong'}`}
            >
              <span className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${prefs.escalationAlerts ? 'left-6' : 'left-1'}`} />
            </button>
          </div>

          <div className="py-3.5 flex items-center justify-between">
            <div>
              <p className="text-[14px] font-medium text-text-primary">Credit Balance Thresholds</p>
              <p className="text-[12px] text-text-secondary mt-0.5">Alert when remaining credits drop below 100 units.</p>
            </div>
            <button
              onClick={() => setPrefs(p => ({ ...p, creditLowAlerts: !p.creditLowAlerts }))}
              className={`w-11 h-6 rounded-full transition-colors relative ${prefs.creditLowAlerts ? 'bg-accent' : 'bg-border-strong'}`}
            >
              <span className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${prefs.creditLowAlerts ? 'left-6' : 'left-1'}`} />
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}

export default ProfilePage

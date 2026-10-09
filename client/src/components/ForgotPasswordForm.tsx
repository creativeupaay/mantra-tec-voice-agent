import { FC, useState, useEffect, useRef } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react'
import { authApi } from '../api/client'

interface ForgotPasswordFormProps {
  initialEmail?: string
  onBackToLogin: () => void
  onResetSuccess: (email: string) => void
}

type Step = 'EMAIL' | 'VERIFY_AND_RESET' | 'SUCCESS'

export const ForgotPasswordForm: FC<ForgotPasswordFormProps> = ({
  initialEmail = '',
  onBackToLogin,
  onResetSuccess,
}) => {
  const [step, setStep] = useState<Step>('EMAIL')
  const [email, setEmail] = useState(initialEmail)
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', ''])
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  const digitRefs = useRef<(HTMLInputElement | null)[]>([])

  // Resend countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return

    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)

    return () => clearInterval(timer)
  }, [resendCooldown])

  // Clear errors when step changes
  useEffect(() => {
    setError('')
    setSuccessMessage('')
  }, [step])

  // Step 1: Send OTP
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setError('')
    setSuccessMessage('')

    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail) {
      setError('Please enter your email address')
      return
    }

    setIsLoading(true)
    try {
      const res = await authApi.sendForgotPasswordOtp(trimmedEmail)
      setSuccessMessage(res.message || 'Verification code sent to your email')
      setStep('VERIFY_AND_RESET')
      setResendCooldown(60)
      // Focus first OTP input after switching step
      setTimeout(() => {
        digitRefs.current[0]?.focus()
      }, 100)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send verification code. Please check the email and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Handle OTP digit inputs
  const handleDigitChange = (index: number, value: string) => {
    // Only accept numeric digits
    const cleaned = value.replace(/\D/g, '')

    // Handle multi-character paste into one input
    if (cleaned.length > 1) {
      handlePaste(cleaned)
      return
    }

    const newDigits = [...otpDigits]
    newDigits[index] = cleaned.slice(-1)
    setOtpDigits(newDigits)

    // Auto-advance to next box if digit entered
    if (cleaned && index < 5) {
      digitRefs.current[index + 1]?.focus()
    }
  }

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      // If current box is empty, move back and clear previous
      const newDigits = [...otpDigits]
      newDigits[index - 1] = ''
      setOtpDigits(newDigits)
      digitRefs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowLeft' && index > 0) {
      digitRefs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < 5) {
      digitRefs.current[index + 1]?.focus()
    }
  }

  const handlePaste = (pastedText: string) => {
    const digits = pastedText.replace(/\D/g, '').slice(0, 6).split('')
    if (digits.length === 0) return

    const newDigits = [...otpDigits]
    digits.forEach((d, i) => {
      newDigits[i] = d
    })
    setOtpDigits(newDigits)

    const nextIndex = Math.min(digits.length, 5)
    digitRefs.current[nextIndex]?.focus()
  }

  // Resend OTP handler
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isLoading) return
    setError('')
    setSuccessMessage('')
    setIsLoading(true)

    try {
      const res = await authApi.sendForgotPasswordOtp(email.trim().toLowerCase())
      setSuccessMessage(res.message || 'A new verification code has been sent')
      setResendCooldown(60)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to resend code')
    } finally {
      setIsLoading(false)
    }
  }

  // Step 2: Reset Password with OTP
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMessage('')

    const fullOtp = otpDigits.join('')
    if (fullOtp.length !== 6) {
      setError('Please enter the full 6-digit verification code')
      return
    }

    if (!newPassword) {
      setError('Please enter a new password')
      return
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setIsLoading(true)
    try {
      const res = await authApi.resetPasswordWithOtp(
        email.trim().toLowerCase(),
        fullOtp,
        newPassword
      )
      setSuccessMessage(res.message || 'Password reset successfully')
      setStep('SUCCESS')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reset password. Please check your verification code.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full">
      {/* ── Step 1: Request OTP by Email ── */}
      {step === 'EMAIL' && (
        <div>
          <div className="mb-8">
            <button
              type="button"
              onClick={onBackToLogin}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-secondary hover:text-text-primary transition-colors mb-6 group cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              Back to sign in
            </button>
            <h1 className="text-3xl font-semibold text-text-primary tracking-tight">Forgot password?</h1>
            <p className="text-[14px] text-text-secondary mt-2">
              Enter the email address registered with your account and we'll send you a 6-digit verification code.
            </p>
          </div>

          <form onSubmit={handleSendOtp} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 text-red-600 rounded-xl text-[13px] font-medium flex items-start gap-3 border border-red-100 animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-[13px] font-medium text-text-primary mb-2">
                Email address
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@mantratech.com"
                  required
                  autoFocus
                  className="w-full pl-11 pr-4 py-3 bg-surface-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-text-primary/10 focus:border-text-primary text-[14px] text-text-primary transition-all placeholder:text-text-muted shadow-sm"
                />
                <Mail className="w-4 h-4 text-text-muted absolute left-4 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-text-primary text-surface-card rounded-xl hover:bg-black text-[14px] font-medium transition-all shadow-lg shadow-black/5 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending code...
                </>
              ) : (
                'Send Verification Code'
              )}
            </button>
          </form>
        </div>
      )}

      {/* ── Step 2: Enter OTP & New Password ── */}
      {step === 'VERIFY_AND_RESET' && (
        <div>
          <div className="mb-6">
            <button
              type="button"
              onClick={() => setStep('EMAIL')}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-secondary hover:text-text-primary transition-colors mb-6 group cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              Change email address
            </button>
            <h1 className="text-3xl font-semibold text-text-primary tracking-tight">Enter verification code</h1>
            <div className="mt-2 text-[14px] text-text-secondary flex flex-wrap items-center gap-1">
              <span>We sent a 6-digit code to</span>
              <span className="font-semibold text-text-primary">{email}</span>
            </div>
          </div>

          <form onSubmit={handleResetPassword} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 text-red-600 rounded-xl text-[13px] font-medium flex items-start gap-3 border border-red-100 animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {successMessage && !error && (
              <div className="p-3 bg-zinc-100 text-text-primary rounded-xl text-[13px] font-medium flex items-start gap-2.5 border border-border animate-in fade-in duration-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* 6-Digit OTP Box Grid */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-[13px] font-medium text-text-primary">
                  6-digit security code
                </label>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || isLoading}
                  className="text-[12px] font-medium text-text-secondary hover:text-text-primary disabled:opacity-50 disabled:hover:text-text-secondary flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
                </button>
              </div>

              <div
                className="grid grid-cols-6 gap-2 sm:gap-2.5"
                onPaste={(e) => {
                  e.preventDefault()
                  handlePaste(e.clipboardData.getData('text'))
                }}
              >
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (digitRefs.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                    className="w-full h-12 sm:h-13 text-center text-xl font-mono font-semibold bg-surface-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-text-primary/10 focus:border-text-primary text-text-primary transition-all shadow-sm"
                  />
                ))}
              </div>
            </div>

            {/* Password Fields */}
            <div className="space-y-4 pt-1">
              <div>
                <label className="block text-[13px] font-medium text-text-primary mb-2">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                    minLength={6}
                    className="w-full pl-11 pr-11 py-3 bg-surface-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-text-primary/10 focus:border-text-primary text-[14px] text-text-primary transition-all placeholder:text-text-muted shadow-sm"
                  />
                  <KeyRound className="w-4 h-4 text-text-muted absolute left-4 top-1/2 -translate-y-1/2" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary p-1 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-text-primary mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    required
                    minLength={6}
                    className="w-full pl-11 pr-11 py-3 bg-surface-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-text-primary/10 focus:border-text-primary text-[14px] text-text-primary transition-all placeholder:text-text-muted shadow-sm"
                  />
                  <KeyRound className="w-4 h-4 text-text-muted absolute left-4 top-1/2 -translate-y-1/2" />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary p-1 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || otpDigits.join('').length !== 6}
              className="w-full py-3 bg-text-primary text-surface-card rounded-xl hover:bg-black text-[14px] font-medium transition-all shadow-lg shadow-black/5 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Resetting password...
                </>
              ) : (
                'Reset Password'
              )}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={onBackToLogin}
                className="text-[13px] font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
              >
                Cancel and return to sign in
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Step 3: Success State ── */}
      {step === 'SUCCESS' && (
        <div className="text-center py-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-center mx-auto mb-6 text-emerald-600 shadow-sm">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <h1 className="text-2xl font-semibold text-text-primary tracking-tight mb-2">
            Password reset complete!
          </h1>
          <p className="text-[14px] text-text-secondary max-w-sm mx-auto mb-8">
            Your password has been successfully updated. You can now use your new password to sign into your account.
          </p>

          <button
            type="button"
            onClick={() => onResetSuccess(email)}
            className="w-full py-3 bg-text-primary text-surface-card rounded-xl hover:bg-black text-[14px] font-medium transition-all shadow-lg shadow-black/5 active:scale-[0.98] cursor-pointer"
          >
            Sign In with New Password
          </button>
        </div>
      )}
    </div>
  )
}

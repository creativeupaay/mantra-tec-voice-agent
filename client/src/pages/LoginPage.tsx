import { FC, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { ForgotPasswordForm } from '../components/ForgotPasswordForm'

const LoginPage: FC = () => {
  const [view, setView] = useState<'login' | 'forgot-password'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (isAuthenticated) navigate('/')
  }, [isAuthenticated, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setInfoMessage('')
    setIsSubmitting(true)
    try {
      await login(email.trim(), password.trim())
      navigate('/') // redirect to dashboard after login
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid credentials')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResetSuccess = (resetEmail: string) => {
    setEmail(resetEmail)
    setPassword('')
    setError('')
    setInfoMessage('Password reset successfully! Please sign in with your new password.')
    setView('login')
  }

  return (
    <div className="flex min-h-screen bg-surface-page">
      {/* ── Left Side: Beautiful Abstract Background ── */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-black items-center justify-center overflow-hidden">
        {/* The background image */}
        <img
          src="/images/login-bg.png"
          alt="Premium abstract background"
          className="absolute inset-0 w-full h-full object-cover opacity-80 mix-blend-screen"
        />

        {/* Subtle gradient overlay to make text readable */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent" />

        {/* Branding / Quote over the image */}
        <div className="relative z-10 max-w-md px-10 text-white">
          <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center mb-8 border border-white/20">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-white"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <h2 className="text-4xl font-semibold tracking-tight leading-tight mb-4 text-white">
            Enterprise intelligence at your fingertips.
          </h2>
          <p className="text-lg text-white/70 font-light">
            Manage your organization, analyze communication, and drive insights with the Mantra Tech dashboard.
          </p>
        </div>
      </div>

      {/* ── Right Side: Minimalist Login / Forgot Password Form ── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12">
        <div className="w-full max-w-[380px]">
          {view === 'login' ? (
            <div>
              <div className="mb-10">
                <h1 className="text-3xl font-semibold text-text-primary tracking-tight">Welcome back</h1>
                <p className="text-[14px] text-text-secondary mt-2">Sign in to your admin account to continue.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {infoMessage && (
                  <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl text-[13px] font-medium flex items-start gap-3 border border-emerald-200 animate-in fade-in duration-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{infoMessage}</span>
                  </div>
                )}

                {error && (
                  <div className="p-4 bg-red-50 text-red-600 rounded-xl text-[13px] font-medium flex items-start gap-3 border border-red-100 animate-in fade-in duration-200">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-[13px] font-medium text-text-primary mb-2">Email address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@mantratech.com"
                      required
                      className="w-full px-4 py-3 bg-surface-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-text-primary/10 focus:border-text-primary text-[14px] text-text-primary transition-all placeholder:text-text-muted shadow-sm"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-[13px] font-medium text-text-primary">Password</label>
                      <button
                        type="button"
                        onClick={() => {
                          setError('')
                          setInfoMessage('')
                          setView('forgot-password')
                        }}
                        className="text-[12px] font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full px-4 py-3 bg-surface-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-text-primary/10 focus:border-text-primary text-[14px] text-text-primary transition-all placeholder:text-text-muted shadow-sm"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-text-primary text-surface-card rounded-xl hover:bg-black text-[14px] font-medium transition-colors shadow-lg shadow-black/5 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </button>

                <p className="text-center text-[13px] text-text-secondary mt-8">
                  Don't have an account?{' '}
                  <a href="#" className="font-medium text-text-primary hover:underline">
                    Contact support
                  </a>
                </p>
              </form>
            </div>
          ) : (
            <ForgotPasswordForm
              initialEmail={email}
              onBackToLogin={() => {
                setError('')
                setView('login')
              }}
              onResetSuccess={handleResetSuccess}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default LoginPage
import { FC, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const LoginPage: FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (isAuthenticated) navigate('/')
  }, [isAuthenticated, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await login(email, password)
      navigate('/')  // redirect to dashboard after login
    } catch (err) {
      setError('Invalid credentials')
    }
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
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
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

      {/* ── Right Side: Minimalist Login Form ── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12">
        <div className="w-full max-w-[380px]">
          
          <div className="mb-10">
            <h1 className="text-3xl font-semibold text-text-primary tracking-tight">Welcome back</h1>
            <p className="text-[14px] text-text-secondary mt-2">Sign in to your admin account to continue.</p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 text-red-600 rounded-xl text-[13px] font-medium flex items-start gap-3 border border-red-100">
                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
                {error}
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
                  <a href="#" className="text-[12px] font-medium text-text-secondary hover:text-text-primary transition-colors">Forgot password?</a>
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
              className="w-full py-3 bg-text-primary text-surface-card rounded-xl hover:bg-black text-[14px] font-medium transition-colors shadow-lg shadow-black/5 active:scale-[0.98]"
            >
              Sign In
            </button>
            
            <p className="text-center text-[13px] text-text-secondary mt-8">
              Don't have an account? <a href="#" className="font-medium text-text-primary hover:underline">Contact support</a>
            </p>
          </form>

        </div>
      </div>
      
    </div>
  )
}

export default LoginPage
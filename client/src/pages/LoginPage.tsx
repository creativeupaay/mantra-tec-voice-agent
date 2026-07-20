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
    <div className="flex items-center justify-center min-h-screen bg-surface-page">
      <div className="bg-surface-card p-10 rounded-2xl border border-border w-[400px]">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-text-primary">Mantra Tech</h1>
          <p className="text-[13px] text-text-secondary mt-2">Sign in to your admin account</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="border border-border-strong p-3 rounded-lg text-sm text-text-primary font-medium text-center">
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-[13px] font-medium text-text-primary mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2.5 bg-transparent border border-border rounded-lg focus:outline-none focus:border-text-primary text-[14px] text-text-primary transition-colors"
            />
          </div>
          
          <div>
            <label className="block text-[13px] font-medium text-text-primary mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2.5 bg-transparent border border-border rounded-lg focus:outline-none focus:border-text-primary text-[14px] text-text-primary transition-colors"
            />
          </div>
          
          <button
            type="submit"
            className="w-full mt-2 px-4 py-2.5 bg-text-primary text-surface-card rounded-lg hover:bg-black text-[14px] font-medium transition-colors"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  )
}

export default LoginPage
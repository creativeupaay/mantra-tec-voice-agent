import { useEffect, useState, createContext, useContext, FC, ReactNode } from 'react'
import { authApi } from '../api/client'
import { IUser } from '../types/api'

interface IAuthContext {
  user: IUser | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, name: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<IAuthContext | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<IUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('auth_token') || localStorage.getItem('token')
      const storedUserStr = localStorage.getItem('auth_user')

      if (storedToken && storedUserStr) {
        try {
          const parsedUser = JSON.parse(storedUserStr)
          setUser(parsedUser)
        } catch (error) {
          localStorage.removeItem('auth_token')
          localStorage.removeItem('token')
          localStorage.removeItem('auth_user')
        }
      }
      setIsLoading(false)
    }
    initAuth()
  }, [])

  const login = async (email: string, password: string) => {
    const res = await authApi.login({ email, password })
    if (res && res.token && res.user) {
      localStorage.setItem('auth_token', res.token)
      localStorage.setItem('token', res.token)
      if (res.refreshToken) {
        localStorage.setItem('refreshToken', res.refreshToken)
      }
      localStorage.setItem('auth_user', JSON.stringify(res.user))
      setUser(res.user)
    } else {
      throw new Error('Login failed')
    }
  }

  const register = async (email: string, name: string, password: string) => {
    const res = await authApi.register({ email, name, password })
    if (res && res.token && res.user) {
      localStorage.setItem('auth_token', res.token)
      localStorage.setItem('token', res.token)
      if (res.refreshToken) {
        localStorage.setItem('refreshToken', res.refreshToken)
      }
      localStorage.setItem('auth_user', JSON.stringify(res.user))
      setUser(res.user)
    } else {
      throw new Error('Registration failed')
    }
  }

  const logout = () => {
    authApi.logout().catch(() => {})
    localStorage.removeItem('auth_token')
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('auth_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
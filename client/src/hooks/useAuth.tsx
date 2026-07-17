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
      const token = localStorage.getItem('token')
      if (token) {
        try {
          const response = await authApi.getProfile()
          setUser(response.data.user)
        } catch (error) {
          localStorage.removeItem('token')
          localStorage.removeItem('refreshToken')
        }
      }
      setIsLoading(false)
    }
    initAuth()
  }, [])

  const login = async (email: string, password: string) => {
    const response = await authApi.login({ email, password })
    const { token, refreshToken, user } = response.data
    localStorage.setItem('token', token)
    localStorage.setItem('refreshToken', refreshToken)
    setUser(user)
  }

  const register = async (email: string, name: string, password: string) => {
    const response = await authApi.register({ email, name, password })
    const { token, refreshToken, user } = response.data
    localStorage.setItem('token', token)
    localStorage.setItem('refreshToken', refreshToken)
    setUser(user)
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
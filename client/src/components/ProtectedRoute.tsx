import { FC, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

interface IProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: ('admin' | 'super_admin')[]
}

const ProtectedRoute: FC<IProtectedRouteProps> = ({ children, allowedRoles = ['admin', 'super_admin'] }) => {
  const { isAuthenticated, isLoading, user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        navigate('/login')
      } else if (user?.role && !allowedRoles.includes(user.role as any)) {
        navigate('/')
      }
    }
  }, [isLoading, isAuthenticated, user, navigate, allowedRoles])

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!isAuthenticated) {
    return null
  }

  if (user?.role && !allowedRoles.includes(user.role as any)) {
    return <div className="flex items-center justify-center min-h-screen">Access Denied</div>
  }

  return <>{children}</>
}

export default ProtectedRoute
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { User, UserRole } from '../models/User.js'

// Generic role check middleware
export const authorize = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' })
      return
    }

    if (!(req.user as any).role || !roles.includes((req.user as any).role as UserRole)) {
      res.status(403).json({ success: false, message: 'Access denied - insufficient permissions' })
      return
    }

    next()
  }
}

// Specific role middlewares
export const isAdmin = authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export const isSuperAdmin = authorize(UserRole.SUPER_ADMIN)

// Main authenticate middleware
export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    
    if (!token) {
      res.status(401).json({ success: false, message: 'No token provided' })
      return
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; role?: string }
    
    const user = await User.findById(decoded.id).select('-password')
    
    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid token' })
      return
    }

    // Set user on request with properly typed _id
    req.user = {
      _id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role
    }
    next()
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' })
  }
}
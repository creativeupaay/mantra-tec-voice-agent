import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { User, IUser } from '../models/User.js'
import { env } from '../config/env.config'

// Helper to get tokens from user
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const generateTokens = (user: any) => ({
  token: user.generateAccessToken(),
  refreshToken: user.generateRefreshToken(),
})

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password, name, role } = req.body

    const existingUser = await User.findOne({ email })
    if (existingUser) {
      res.status(400).json({ success: false, message: 'User already exists' })
      return
    }

    const user = await User.create({ email, password, name, role })
    const { token, refreshToken } = generateTokens(user)

    res.status(201).json({
      success: true,
      token,
      refreshToken,
      user: { id: user._id, email: user.email, name: user.name, role: user.role },
    })
  } catch (error) {
    next(error)
  }
}

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const rawEmail = String(req.body.email || '').trim().toLowerCase()
    const password = String(req.body.password || '').trim()

    const user = await User.findOne({ email: { $regex: new RegExp(`^${rawEmail}$`, 'i') } })
    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid credentials' })
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isMatch = await (user as any).comparePassword(password)
    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Invalid credentials' })
      return
    }

    const { token, refreshToken } = generateTokens(user)

    res.json({
      success: true,
      token,
      refreshToken,
      user: { id: user._id, email: user.email, name: user.name, role: user.role },
    })
  } catch (error) {
    next(error)
  }
}

export const getProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' })
      return
    }

    const user = await User.findById(req.user._id).select('-password')
    res.json({ success: true, user })
  } catch (error) {
    next(error)
  }
}

export const updateProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' })
      return
    }

    const { name, email } = req.body

    if (email) {
      const existingUser = await User.findOne({ email, _id: { $ne: req.user._id } })
      if (existingUser) {
        res.status(400).json({ success: false, message: 'Email is already in use by another user' })
        return
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { ...(name && { name }), ...(email && { email }) },
      { new: true }
    ).select('-password')

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser,
    })
  } catch (error) {
    next(error)
  }
}

export const changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' })
      return
    }

    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) {
      res.status(400).json({ success: false, message: 'Both current password and new password are required' })
      return
    }

    const user = await User.findById(req.user._id)
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' })
      return
    }

    const isMatch = await (user as any).comparePassword(currentPassword)
    if (!isMatch) {
      res.status(400).json({ success: false, message: 'Current password is incorrect' })
      return
    }

    user.password = newPassword
    await user.save()

    res.json({
      success: true,
      message: 'Password changed successfully',
    })
  } catch (error) {
    next(error)
  }
}

export const refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { refreshToken: token } = req.body

    if (!token) {
      res.status(401).json({ success: false, message: 'No refresh token provided' })
      return
    }

    const decoded = jwt.verify(token, env.JWT_SECRET + '_refresh') as { id: string }
    
    const user = await User.findById(decoded.id)
    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid refresh token' })
      return
    }

    const { token: newToken } = generateTokens(user)

    res.json({
      success: true,
      token: newToken,
    })
  } catch (error) {
    next(error)
  }
}
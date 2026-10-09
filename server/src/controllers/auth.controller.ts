import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { User, IUser } from '../models/User.js'
import { Otp } from '../models/Otp.js'
import { env } from '../config/env.config.js'
import { sendPasswordResetOtpEmail } from '../services/email.service.js'

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

export const sendForgotPasswordOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const rawEmail = String(req.body.email || '').trim().toLowerCase()

    const user = await User.findOne({ email: { $regex: new RegExp(`^${rawEmail}$`, 'i') } })
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'No account registered with this email address.',
      })
      return
    }

    // Rate-limit check: check if an OTP was created in the last 60 seconds
    const recentOtp = await Otp.findOne({
      email: rawEmail,
      purpose: 'forgot_password',
      createdAt: { $gt: new Date(Date.now() - 60 * 1000) },
    })

    if (recentOtp) {
      const waitSeconds = Math.max(1, Math.ceil((recentOtp.createdAt.getTime() + 60 * 1000 - Date.now()) / 1000))
      res.status(429).json({
        success: false,
        message: `Please wait ${waitSeconds} seconds before requesting a new verification code.`,
      })
      return
    }

    // Generate 6-digit random code
    const plainOtp = Math.floor(100000 + Math.random() * 900000).toString()
    const salt = await bcrypt.genSalt(10)
    const otpHash = await bcrypt.hash(plainOtp, salt)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    // Delete any active OTP for this email and purpose
    await Otp.deleteMany({ email: rawEmail, purpose: 'forgot_password' })

    // Create new OTP record
    await Otp.create({
      email: rawEmail,
      otpHash,
      purpose: 'forgot_password',
      expiresAt,
    })

    // Send email
    const emailResult = await sendPasswordResetOtpEmail(user.email, plainOtp, user.name)

    res.status(200).json({
      success: true,
      message: emailResult.success
        ? 'Verification code sent to your email.'
        : `Verification code generated. ${emailResult.message}`,
    })
  } catch (error) {
    next(error)
  }
}

export const verifyForgotPasswordOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const rawEmail = String(req.body.email || '').trim().toLowerCase()
    const otp = String(req.body.otp || '').trim()

    const otpRecord = await Otp.findOne({
      email: rawEmail,
      purpose: 'forgot_password',
      expiresAt: { $gt: new Date() },
    })

    if (!otpRecord) {
      res.status(400).json({
        success: false,
        message: 'Verification code has expired or does not exist. Please request a new code.',
      })
      return
    }

    if (otpRecord.attempts >= 5) {
      await Otp.deleteOne({ _id: otpRecord._id })
      res.status(400).json({
        success: false,
        message: 'Too many invalid attempts. Please request a new verification code.',
      })
      return
    }

    const isValid = await otpRecord.compareOtp(otp)
    if (!isValid) {
      otpRecord.attempts += 1
      await otpRecord.save()
      res.status(400).json({
        success: false,
        message: 'Invalid verification code. Please check and try again.',
      })
      return
    }

    res.status(200).json({
      success: true,
      message: 'Verification code verified successfully.',
    })
  } catch (error) {
    next(error)
  }
}

export const resetPasswordWithOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const rawEmail = String(req.body.email || '').trim().toLowerCase()
    const otp = String(req.body.otp || '').trim()
    const newPassword = String(req.body.newPassword || '').trim()

    const otpRecord = await Otp.findOne({
      email: rawEmail,
      purpose: 'forgot_password',
      expiresAt: { $gt: new Date() },
    })

    if (!otpRecord) {
      res.status(400).json({
        success: false,
        message: 'Verification code has expired or is invalid. Please request a new code.',
      })
      return
    }

    if (otpRecord.attempts >= 5) {
      await Otp.deleteOne({ _id: otpRecord._id })
      res.status(400).json({
        success: false,
        message: 'Too many invalid attempts. Please request a new verification code.',
      })
      return
    }

    const isValid = await otpRecord.compareOtp(otp)
    if (!isValid) {
      otpRecord.attempts += 1
      await otpRecord.save()
      res.status(400).json({
        success: false,
        message: 'Invalid verification code. Please check and try again.',
      })
      return
    }

    const user = await User.findOne({ email: { $regex: new RegExp(`^${rawEmail}$`, 'i') } })
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'No account found for this email address.',
      })
      return
    }

    // Update password (Mongoose pre-save hook will hash it)
    user.password = newPassword
    await user.save()

    // Delete OTP records so it cannot be reused
    await Otp.deleteMany({ email: rawEmail, purpose: 'forgot_password' })

    res.status(200).json({
      success: true,
      message: 'Password reset successfully. You can now sign in with your new password.',
    })
  } catch (error) {
    next(error)
  }
}
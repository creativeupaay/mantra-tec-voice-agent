import { Router } from 'express'
import {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  refreshToken,
  sendForgotPasswordOtp,
  verifyForgotPasswordOtp,
  resetPasswordWithOtp,
} from '../../controllers/auth.controller.js'
import { authenticate } from '../../middleware/auth.middleware.js'
import {
  sendOtpSchema,
  verifyOtpSchema,
  resetPasswordSchema,
  validateBody,
} from '../../validations/auth.validation.js'

const router = Router()

router.post('/register', register)
router.post('/login', login)
router.post('/refresh', refreshToken)

// Forgot password OTP flow
router.post('/forgot-password/send-otp', validateBody(sendOtpSchema), sendForgotPasswordOtp)
router.post('/forgot-password/verify-otp', validateBody(verifyOtpSchema), verifyForgotPasswordOtp)
router.post('/forgot-password/reset-password', validateBody(resetPasswordSchema), resetPasswordWithOtp)

// Protected user routes
router.get('/profile', authenticate, getProfile)
router.put('/profile', authenticate, updateProfile)
router.put('/change-password', authenticate, changePassword)

export default router
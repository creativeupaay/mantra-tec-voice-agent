import { Router } from 'express'
import { register, login, getProfile, updateProfile, changePassword, refreshToken } from '../../controllers/auth.controller.js'
import { authenticate } from '../../middleware/auth.middleware.js'

const router = Router()

router.post('/register', register)
router.post('/login', login)
router.post('/refresh', refreshToken)
router.get('/profile', authenticate, getProfile)
router.put('/profile', authenticate, updateProfile)
router.put('/change-password', authenticate, changePassword)

export default router
import { Router } from 'express'
import { register, login, getProfile, refreshToken } from '../../controllers/auth.controller.js'
import { authenticate } from '../../middleware/auth.middleware.js'

const router = Router()

router.post('/register', register)
router.post('/login', login)
router.post('/refresh', refreshToken)
router.get('/profile', authenticate, getProfile)

export default router
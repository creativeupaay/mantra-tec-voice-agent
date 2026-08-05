import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware.js'
import {
  getSettings,
  updateSettings,
  sendTestEmail,
} from '../../controllers/settings.controller.js'

const router = Router()

// All settings routes require authentication
router.use(authenticate)

router.get('/', getSettings)
router.put('/', updateSettings)
router.post('/test-email', sendTestEmail)

export default router

import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware.js'
import { validateBody } from '../../validations/auth.validation.js'
import {
  updateSettingsSchema,
  sendTestEmailSchema,
} from '../../validations/settings.validation.js'
import {
  getSettings,
  updateSettings,
  sendTestEmail,
} from '../../controllers/settings.controller.js'

const router = Router()

// All settings routes require authentication
router.use(authenticate)

router.get('/', getSettings)
router.put('/', validateBody(updateSettingsSchema), updateSettings)
router.post('/test-email', validateBody(sendTestEmailSchema), sendTestEmail)

export default router

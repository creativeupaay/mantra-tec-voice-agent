import { Router } from 'express'
import { authenticate, isAdmin, isSuperAdmin } from '../../middleware/auth.middleware.js'
import {
  getAllCalls,
  getCallById,
  getCallRecording,
} from '../../controllers/call.controller.js'

const router = Router()

// All routes require authentication
router.use(authenticate)

// Routes accessible to admin and super_admin
router.get('/', isAdmin, getAllCalls)
router.get('/:id', isAdmin, getCallById)
router.get('/:id/recording', isAdmin, getCallRecording)

export default router
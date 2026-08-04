import { Router } from 'express'
import { authenticate, isAdmin } from '../../middleware/auth.middleware.js'
import {
  getAllCalls,
  getCallById,
  getCallRecording,
  updateCallStatus,
} from '../../controllers/call.controller.js'

const router = Router()

// All routes require authentication
router.use(authenticate)

// Routes accessible to admin and super_admin
router.get('/', isAdmin, getAllCalls)
router.get('/:id', isAdmin, getCallById)
router.get('/:id/recording', isAdmin, getCallRecording)

// Status update handlers for all common HTTP methods and paths
router.patch('/:id/status', isAdmin, updateCallStatus)
router.post('/:id/status', isAdmin, updateCallStatus)
router.put('/:id/status', isAdmin, updateCallStatus)
router.patch('/:id', isAdmin, updateCallStatus)
router.post('/:id', isAdmin, updateCallStatus)
router.put('/:id', isAdmin, updateCallStatus)

export default router
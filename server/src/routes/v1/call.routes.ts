import { Router } from 'express'
import { authenticate, isAdmin } from '../../middleware/auth.middleware.js'
import {
  getAllCalls,
  getCallById,
  getCallRecording,
  getCallIntents,
  updateCallStatus,
  updateCallReviewed,
  batchUpdateCallReviewed,
} from '../../controllers/call.controller.js'
import { validateBody } from '../../validations/auth.validation.js'
import {
  updateCallReviewedSchema,
  batchCallReviewedSchema,
} from '../../validations/call.validation.js'

const router = Router()

// All routes require authentication
router.use(authenticate)

// Batch reviewed operations (placed before /:id routes to prevent ID shadowing)
router.patch('/batch-reviewed', isAdmin, validateBody(batchCallReviewedSchema), batchUpdateCallReviewed)
router.post('/batch-reviewed', isAdmin, validateBody(batchCallReviewedSchema), batchUpdateCallReviewed)

// Standardized intents taxonomy endpoint (placed before /:id to prevent ID shadowing)
router.get('/intents', isAdmin, getCallIntents)

// Routes accessible to admin and super_admin
router.get('/', isAdmin, getAllCalls)
router.get('/:id', isAdmin, getCallById)
router.get('/:id/recording', isAdmin, getCallRecording)

// Single call review status update handlers
router.patch('/:id/reviewed', isAdmin, validateBody(updateCallReviewedSchema), updateCallReviewed)
router.post('/:id/reviewed', isAdmin, validateBody(updateCallReviewedSchema), updateCallReviewed)
router.put('/:id/reviewed', isAdmin, validateBody(updateCallReviewedSchema), updateCallReviewed)

// Status update handlers for all common HTTP methods and paths
router.patch('/:id/status', isAdmin, updateCallStatus)
router.post('/:id/status', isAdmin, updateCallStatus)
router.put('/:id/status', isAdmin, updateCallStatus)
router.patch('/:id', isAdmin, updateCallStatus)
router.post('/:id', isAdmin, updateCallStatus)
router.put('/:id', isAdmin, updateCallStatus)

export default router
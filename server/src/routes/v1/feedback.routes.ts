import { Router } from 'express'
import { authenticate, isAdmin } from '../../middleware/auth.middleware.js'
import {
  createFeedback,
  getFeedbacks,
  getFeedbackById,
  updateFeedbackStatus,
  deleteFeedback,
} from '../../controllers/feedback.controller.js'
import {
  createFeedbackSchema,
  updateFeedbackStatusSchema,
  queryFeedbackSchema,
  validateBody,
  validateQuery,
} from '../../validations/feedback.validation.js'

const router = Router()

// All routes require authentication
router.use(authenticate)

// Feedback CRUD routes
router.get('/', validateQuery(queryFeedbackSchema), getFeedbacks)
router.post('/', validateBody(createFeedbackSchema), createFeedback)
router.get('/:id', getFeedbackById)

// Status update endpoints supporting PATCH and PUT
router.patch('/:id/status', validateBody(updateFeedbackStatusSchema), updateFeedbackStatus)
router.patch('/:id', validateBody(updateFeedbackStatusSchema), updateFeedbackStatus)
router.put('/:id/status', validateBody(updateFeedbackStatusSchema), updateFeedbackStatus)
router.put('/:id', validateBody(updateFeedbackStatusSchema), updateFeedbackStatus)

// Delete feedback
router.delete('/:id', isAdmin, deleteFeedback)

export default router

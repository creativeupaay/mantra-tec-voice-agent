import { Router } from 'express'
import { authenticate, isSuperAdmin, isAdmin } from '../../middleware/auth.middleware'
import { getAnalytics, getCallAnalytics, getAllCreditUsage, getUserCreditBalance } from '../../controllers/analytics.controller'
import { getCallAnalyticsQuerySchema, validateQuery } from '../../validations/analytics.validation.js'

const router = Router()

// All routes require authentication
router.use(authenticate)

// Authenticated routes
router.get('/call-analytics', validateQuery(getCallAnalyticsQuerySchema), getCallAnalytics)
router.get('/credit-balance', getUserCreditBalance)
router.get('/credit-usage', getAllCreditUsage)
router.get('/analytics', getAnalytics)

export default router
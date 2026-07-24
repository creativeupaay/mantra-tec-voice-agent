import { Router } from 'express'
import { authenticate, isSuperAdmin, isAdmin } from '../../middleware/auth.middleware'
import { getAnalytics, getCallAnalytics, getAllCreditUsage, getUserCreditBalance } from '../../controllers/analytics.controller'

const router = Router()

// All routes require authentication
router.use(authenticate)

// Admin + Super Admin routes (client-facing call analytics)
router.get('/call-analytics', isAdmin, getCallAnalytics)
router.get('/credit-balance', getUserCreditBalance)

// Super Admin only routes (internal platform views)
router.get('/analytics', isSuperAdmin, getAnalytics)
router.get('/credit-usage', isSuperAdmin, getAllCreditUsage)

export default router
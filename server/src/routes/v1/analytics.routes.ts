import { Router } from 'express'
import { authenticate, isSuperAdmin, isAdmin } from '../../middleware/auth.middleware'
import { getAnalytics, getAllCreditUsage, getUserCreditBalance } from '../../controllers/analytics.controller'

const router = Router()

// All routes require authentication
router.use(authenticate)

// Admin & Super Admin routes
router.get('/analytics', isAdmin, getAnalytics)
router.get('/credit-balance', getUserCreditBalance)

// Super Admin only routes
router.get('/credit-usage', isSuperAdmin, getAllCreditUsage)

export default router
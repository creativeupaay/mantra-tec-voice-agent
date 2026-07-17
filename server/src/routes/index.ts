import { Router } from 'express'
import authRoutes from './v1/auth.routes.js'
import agentRoutes from './v1/agent.routes.js'
import sessionRoutes from './v1/session.routes.js'
import analyticsRoutes from './v1/analytics.routes.js'
import callRoutes from './v1/call.routes.js'

const router = Router()

router.use('/auth', authRoutes)
router.use('/agents', agentRoutes)
router.use('/sessions', sessionRoutes)
router.use('/analytics', analyticsRoutes)
router.use('/calls', callRoutes)

export { router as apiRouter }
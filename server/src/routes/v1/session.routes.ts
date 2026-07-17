import { Router } from 'express'
import {
  getAllSessions,
  getSessionById,
  createSession,
  endSession,
} from '../../controllers/session.controller'
import { authenticate } from '../../middleware/auth.middleware'

const router = Router()

router.use(authenticate)

router.get('/', getAllSessions)
router.get('/:id', getSessionById)
router.post('/', createSession)
router.patch('/:id/end', endSession)

export default router
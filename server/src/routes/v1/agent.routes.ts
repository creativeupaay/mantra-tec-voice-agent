import { Router } from 'express'
import {
  getAllAgents,
  getAgentById,
  createAgent,
  updateAgent,
  deleteAgent,
} from '../../controllers/agent.controller'
import { authenticate } from '../../middleware/auth.middleware'

const router = Router()

router.use(authenticate)

router.get('/', getAllAgents)
router.get('/:id', getAgentById)
router.post('/', createAgent)
router.put('/:id', updateAgent)
router.delete('/:id', deleteAgent)

export default router
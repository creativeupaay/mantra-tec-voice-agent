import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware.js'
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
} from '../../controllers/notification.controller.js'

const router = Router()

router.use(authenticate)

router.get('/', getNotifications)
router.patch('/read-all', markAllAsRead)
router.patch('/:id/read', markAsRead)
router.delete('/clear-all', deleteAllNotifications)
router.delete('/:id', deleteNotification)

export default router

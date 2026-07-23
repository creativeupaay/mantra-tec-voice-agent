import { Request, Response, NextFunction } from 'express'
import { Notification } from '../models/Notification.js'

export const getNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' })
      return
    }

    const userId = req.user._id

    // Fetch user notifications OR broadcast notifications (userId is null)
    const notifications = await Notification.find({
      $or: [{ userId }, { userId: { $exists: false } }, { userId: null }]
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()

    const unreadCount = notifications.filter(n => !n.read).length

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount
      }
    })
  } catch (error) {
    next(error)
  }
}

export const markAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params
    const notification = await Notification.findByIdAndUpdate(
      id,
      { read: true },
      { new: true }
    )

    if (!notification) {
      res.status(404).json({ success: false, message: 'Notification not found' })
      return
    }

    res.json({ success: true, data: notification })
  } catch (error) {
    next(error)
  }
}

export const markAllAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' })
      return
    }

    const userId = req.user._id

    await Notification.updateMany(
      {
        $or: [{ userId }, { userId: { $exists: false } }, { userId: null }],
        read: false
      },
      { read: true }
    )

    res.json({ success: true, message: 'All notifications marked as read' })
  } catch (error) {
    next(error)
  }
}

export const deleteNotification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params
    await Notification.findByIdAndDelete(id)
    res.json({ success: true, message: 'Notification deleted' })
  } catch (error) {
    next(error)
  }
}

export const deleteAllNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' })
      return
    }

    const userId = req.user._id

    await Notification.deleteMany({
      $or: [{ userId }, { userId: { $exists: false } }, { userId: null }]
    })

    res.json({ success: true, message: 'All notifications cleared' })
  } catch (error) {
    next(error)
  }
}

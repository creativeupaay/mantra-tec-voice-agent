import mongoose from 'mongoose'
import { Notification, NotificationCategory, NotificationSeverity, INotification } from '../models/Notification.js'

export interface CreateNotificationParams {
  userId?: string | mongoose.Types.ObjectId
  title: string
  message: string
  category?: NotificationCategory
  severity?: NotificationSeverity
  link?: string
  metadata?: Record<string, any>
}

/**
 * Generic helper to dispatch notifications programmatically from anywhere in the codebase.
 */
export const dispatchNotification = async (params: CreateNotificationParams): Promise<INotification> => {
  const notification = await Notification.create({
    userId: params.userId ? new mongoose.Types.ObjectId(params.userId) : undefined,
    title: params.title,
    message: params.message,
    category: params.category || 'system',
    severity: params.severity || 'info',
    link: params.link,
    metadata: params.metadata,
  })
  return notification
}

import mongoose, { Schema, Document, model } from 'mongoose'

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error'
export type NotificationCategory = 'call' | 'credit' | 'system' | 'agent' | 'ticket' | string

export interface INotification extends Document {
  userId?: mongoose.Types.ObjectId
  title: string
  message: string
  category: NotificationCategory
  severity: NotificationSeverity
  read: boolean
  link?: string
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: false, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    category: { type: String, required: true, default: 'system', index: true },
    severity: { 
      type: String, 
      enum: ['info', 'success', 'warning', 'error'], 
      default: 'info' 
    },
    read: { type: Boolean, default: false, index: true },
    link: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
)

export const Notification = model<INotification>('Notification', notificationSchema)

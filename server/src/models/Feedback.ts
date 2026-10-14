import mongoose, { Schema, Document, model } from 'mongoose'

export type FeedbackStatus = 'pending' | 'inprogress' | 'resolved'

export interface IFeedback extends Document {
  call?: mongoose.Types.ObjectId
  call_id?: string
  content: string
  status: FeedbackStatus
  category?: string
  user_id?: mongoose.Types.ObjectId
  user_name?: string
  user_email?: string
  resolution_notes?: string
  resolved_by?: string
  resolved_at?: Date
  createdAt: Date
  updatedAt: Date
}

const feedbackSchema = new Schema<IFeedback>(
  {
    call: {
      type: Schema.Types.ObjectId,
      ref: 'Call',
      required: false,
      index: true,
    },
    call_id: {
      type: String,
      required: false,
      trim: true,
      index: true,
    },
    content: {
      type: String,
      required: [true, 'Feedback content is required'],
      trim: true,
      maxlength: [5000, 'Feedback content cannot exceed 5000 characters'],
    },
    status: {
      type: String,
      enum: ['pending', 'inprogress', 'resolved'],
      default: 'pending',
      index: true,
    },
    category: {
      type: String,
      trim: true,
      default: 'general',
    },
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true,
    },
    user_name: {
      type: String,
      trim: true,
    },
    user_email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    resolution_notes: {
      type: String,
      trim: true,
      maxlength: [2000, 'Resolution notes cannot exceed 2000 characters'],
    },
    resolved_by: {
      type: String,
      trim: true,
    },
    resolved_at: {
      type: Date,
    },
  },
  { timestamps: true }
)

// Compound indexes for optimal query and sorting performance
feedbackSchema.index({ status: 1, createdAt: -1 })
feedbackSchema.index({ call_id: 1, createdAt: -1 })
feedbackSchema.index({ call: 1, createdAt: -1 })

export const Feedback = model<IFeedback>('Feedback', feedbackSchema)

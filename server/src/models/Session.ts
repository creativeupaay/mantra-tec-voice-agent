import mongoose, { Schema, Document } from 'mongoose'

export interface ISession extends Document {
  agentId: mongoose.Types.ObjectId
  userId: mongoose.Types.ObjectId
  startTime: Date
  endTime?: Date
  duration?: number
  status: 'active' | 'completed' | 'failed'
  transcript?: string
}

const sessionSchema = new Schema<ISession>(
  {
    agentId: { type: Schema.Types.ObjectId, ref: 'VoiceAgent', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    duration: { type: Number },
    status: { type: String, enum: ['active', 'completed', 'failed'], default: 'active' },
    transcript: { type: String },
  },
  { timestamps: true }
)

export const Session = mongoose.model<ISession>('Session', sessionSchema)
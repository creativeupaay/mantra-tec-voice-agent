import mongoose, { Schema, Document } from 'mongoose'

export interface IVoiceAgent extends Document {
  name: string
  description: string
  userId: mongoose.Types.ObjectId
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const voiceAgentSchema = new Schema<IVoiceAgent>(
  {
    name: { type: String, required: true },
    description: { type: String },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

export const VoiceAgent = mongoose.model<IVoiceAgent>('VoiceAgent', voiceAgentSchema)
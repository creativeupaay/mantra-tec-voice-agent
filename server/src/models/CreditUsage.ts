import mongoose, { Schema, model } from 'mongoose'

const creditUsageSchema = new Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  amount: { 
    type: Number, 
    required: true 
  },
  description: { 
    type: String, 
    required: true 
  },
  type: { 
    type: String, 
    enum: ['usage', 'purchase', 'refund'], 
    required: true 
  },
  service: {
    type: String,
    enum: ['plivo', 'deepgram', 'elevenlabs', 'cartesia', 'openrouter', 'gemini', 'platform'],
    required: function(this: any) { return this.type === 'usage'; }
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  }
}, { timestamps: true })

export interface ICreditUsage {
  _id: mongoose.Types.ObjectId
  userId: mongoose.Types.ObjectId
  amount: number
  description: string
  type: 'usage' | 'purchase' | 'refund'
  service?: 'plivo' | 'deepgram' | 'elevenlabs' | 'cartesia' | 'openrouter' | 'gemini' | 'platform'
  metadata?: {
    duration_seconds?: number
    tokens_prompt?: number
    tokens_completion?: number
    [key: string]: any
  }
  createdAt: Date
  updatedAt: Date
}

export const CreditUsage = model('CreditUsage', creditUsageSchema)
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
  metadata?: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export const CreditUsage = model('CreditUsage', creditUsageSchema)
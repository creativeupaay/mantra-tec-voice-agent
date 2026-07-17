import mongoose, { Schema, model } from 'mongoose'

// Call record schema for voice agent calls
const callSchema = new Schema({
  call_id: { type: String, required: true, unique: true }, // Plivo call UUID
  phone_number: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  duration: { type: Number }, // seconds
  transcript: { type: String },
  call_summary: { type: String },
  detected_intent: { type: String }, // e.g. "support", "booking", "query"
  call_outcome: { type: String }, // e.g. "ticket_created", "booking_made"
  recording_url: { type: String }, // URL to the recording (presigned or public)
  recording_path: { type: String }, // Storage path/key
}, { timestamps: true })

export interface ICall {
  _id: mongoose.Types.ObjectId | string
  call_id: string
  phone_number: string
  timestamp: Date
  duration?: number
  transcript?: string
  call_summary?: string
  detected_intent?: string
  call_outcome?: string
  recording_url?: string
  recording_path?: string
  createdAt: Date
  updatedAt: Date
}

export const Call = model('Call', callSchema)
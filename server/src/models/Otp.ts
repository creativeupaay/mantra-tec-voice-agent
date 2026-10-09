import mongoose, { Schema, Document } from 'mongoose'
import bcrypt from 'bcryptjs'

export interface IOtp extends Document {
  email: string
  otpHash: string
  purpose: string
  attempts: number
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
  compareOtp(candidateOtp: string): Promise<boolean>
}

const OtpSchema = new Schema<IOtp>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    otpHash: {
      type: String,
      required: true,
    },
    purpose: {
      type: String,
      default: 'forgot_password',
      enum: ['forgot_password', 'email_verification'],
    },
    attempts: {
      type: Number,
      default: 0,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  { timestamps: true }
)

OtpSchema.methods.compareOtp = async function (candidateOtp: string): Promise<boolean> {
  return bcrypt.compare(candidateOtp, this.otpHash)
}

export const Otp = mongoose.model<IOtp>('Otp', OtpSchema)

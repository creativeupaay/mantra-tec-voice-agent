import mongoose, { Schema, model } from 'mongoose'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.config'

// Role enum
export enum UserRole {
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
}

// Schema definition
const userSchema = new Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { 
    type: String, 
    enum: Object.values(UserRole), 
    default: UserRole.ADMIN 
  },
  creditBalance: { type: Number, default: 0 },
}, { timestamps: true })

// Hash password before saving
userSchema.pre('save', async function () {
  // eslint-disable-next-line @typescript-eslint/no-this-alias
  const doc = this as any
  
  if (!doc.isModified('password')) {
    return  // in Mongoose v6+, async pre hooks don't use next()
  }
  
  const salt = await bcrypt.genSalt(10)
  doc.password = await bcrypt.hash(doc.password, salt)
})

// Add methods to the schema
userSchema.methods.comparePassword = function (this: any, candidatePassword: string) {
  return bcrypt.compare(candidatePassword, this.password)
}

userSchema.methods.generateAccessToken = function (this: any) {
  return jwt.sign(
    { id: String(this._id), email: this.email, role: this.role },
    env.JWT_SECRET,
    { expiresIn: '7d' }
  )
}

userSchema.methods.generateRefreshToken = function (this: any) {
  return jwt.sign(
    { id: String(this._id), role: this.role },
    env.JWT_SECRET + '_refresh',
    { expiresIn: '30d' }
  )
}

export interface IUser {
  _id: mongoose.Types.ObjectId
  email: string
  password: string
  name: string
  role: UserRole
  creditBalance: number
  createdAt: Date
  updatedAt: Date
}

export const User = model('User', userSchema)
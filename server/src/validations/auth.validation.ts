import { Request, Response, NextFunction } from 'express'
import { z, ZodSchema } from 'zod'

export const sendOtpSchema = z.object({
  email: z
    .string({ message: 'Email address is required' })
    .trim()
    .min(1, { message: 'Email address cannot be empty' })
    .email({ message: 'Please enter a valid email address' })
    .toLowerCase(),
})

export const verifyOtpSchema = z.object({
  email: z
    .string({ message: 'Email address is required' })
    .trim()
    .min(1, { message: 'Email address cannot be empty' })
    .email({ message: 'Please enter a valid email address' })
    .toLowerCase(),
  otp: z
    .string({ message: 'Verification code is required' })
    .trim()
    .length(6, { message: 'Verification code must be exactly 6 digits' })
    .regex(/^\d{6}$/, { message: 'Verification code must contain digits only' }),
})

export const resetPasswordSchema = z.object({
  email: z
    .string({ message: 'Email address is required' })
    .trim()
    .min(1, { message: 'Email address cannot be empty' })
    .email({ message: 'Please enter a valid email address' })
    .toLowerCase(),
  otp: z
    .string({ message: 'Verification code is required' })
    .trim()
    .length(6, { message: 'Verification code must be exactly 6 digits' })
    .regex(/^\d{6}$/, { message: 'Verification code must contain digits only' }),
  newPassword: z
    .string({ message: 'New password is required' })
    .min(6, { message: 'New password must be at least 6 characters long' })
    .max(128, { message: 'New password cannot exceed 128 characters' }),
})

export const validateBody = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      const issues = (result.error as any).issues || []
      const firstErrorMessage = issues[0]?.message || (result.error as any).message || 'Validation error'
      res.status(400).json({
        success: false,
        message: firstErrorMessage,
        errors: issues,
      })
      return
    }
    req.body = result.data
    next()
  }
}

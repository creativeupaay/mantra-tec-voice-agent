import { Request, Response, NextFunction } from 'express'
import { z, ZodSchema } from 'zod'

export const createFeedbackSchema = z.object({
  content: z
    .string({ message: 'Feedback content is required' })
    .trim()
    .min(2, { message: 'Feedback content must be at least 2 characters long' })
    .max(5000, { message: 'Feedback content cannot exceed 5000 characters' }),
  call_id: z.string().trim().optional(),
  status: z
    .enum(['pending', 'inprogress', 'resolved'] as const, {
      message: 'Status must be one of: pending, inprogress, resolved',
    })
    .optional(),
  category: z.string().trim().max(100).optional(),
})

export const updateFeedbackStatusSchema = z.object({
  status: z.enum(['pending', 'inprogress', 'resolved'] as const, {
    message: 'Status must be one of: pending, inprogress, resolved',
  }),
  resolution_notes: z.string().trim().max(2000).optional(),
})

export const queryFeedbackSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  status: z.enum(['all', 'pending', 'inprogress', 'resolved']).default('all'),
  search: z.string().trim().optional(),
  call_id: z.string().trim().optional(),
})

export const validateBody = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      const issues = (result.error as any).issues || []
      const firstErrorMessage =
        issues[0]?.message || (result.error as any).message || 'Validation error'
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

export const validateQuery = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query)
    if (!result.success) {
      const issues = (result.error as any).issues || []
      const firstErrorMessage =
        issues[0]?.message || (result.error as any).message || 'Validation error'
      res.status(400).json({
        success: false,
        message: firstErrorMessage,
        errors: issues,
      })
      return
    }
    req.query = result.data as any
    next()
  }
}

import { z, ZodSchema } from 'zod'
import { Request, Response, NextFunction } from 'express'

export const getCallAnalyticsQuerySchema = z.object({
  startDate: z.string({ message: 'Start date must be a valid string' }).optional(),
  endDate: z.string({ message: 'End date must be a valid string' }).optional(),
  cycle: z.string({ message: 'Cycle must be a valid string' }).optional(),
})

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
    Object.defineProperty(req, 'query', {
      value: { ...req.query, ...(result.data as Record<string, any>) },
      writable: true,
      configurable: true,
      enumerable: true,
    })
    next()
  }
}

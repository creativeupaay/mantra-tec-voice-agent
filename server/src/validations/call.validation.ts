import { z } from 'zod'

export const updateCallReviewedSchema = z.object({
  is_reviewed: z.boolean({
    message: 'Review status must be true or false',
  }),
})

export const batchCallReviewedSchema = z.object({
  call_ids: z
    .array(
      z
        .string({ message: 'Each call ID must be a string' })
        .trim()
        .min(1, { message: 'Call ID cannot be empty' }),
      {
        message: 'Call IDs must be an array of strings',
      }
    )
    .min(1, { message: 'Please provide at least one call ID to update' }),
  is_reviewed: z.boolean({
    message: 'Review status must be true or false',
  }),
})

export const updateCallStatusSchema = z.object({
  status: z
    .enum(['live', 'resolved', 'escalated', 'missed', 'callback_required'] as const, {
      message: 'Invalid call status. Must be one of: live, resolved, escalated, missed, callback_required',
    })
    .optional(),
  is_reviewed: z.boolean().optional(),
})

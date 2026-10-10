import { z } from 'zod'

export const updateSettingsSchema = z.object({
  organization_name: z
    .string({ message: 'Organization name must be a string' })
    .trim()
    .min(1, { message: 'Organization name cannot be empty' })
    .optional(),
  notify_on_escalation: z
    .boolean({ message: 'notify_on_escalation must be a boolean' })
    .optional(),
  escalation_emails: z
    .array(
      z
        .string({ message: 'Email address must be a string' })
        .trim()
        .email({ message: 'Each escalation recipient must be a valid email address' })
    )
    .optional(),
  notify_on_callback: z
    .boolean({ message: 'notify_on_callback must be a boolean' })
    .optional(),
  callback_emails: z
    .array(
      z
        .string({ message: 'Email address must be a string' })
        .trim()
        .email({ message: 'Each callback recipient must be a valid email address' })
    )
    .optional(),
  resend_api_key: z.string().trim().optional(),
  resend_from_email: z.string().trim().optional(),
  forward_to_human: z.boolean({ message: 'forward_to_human must be a boolean' }).optional(),
  forward_phone_number: z.string().trim().optional(),
})

export const sendTestEmailSchema = z.object({
  emails: z
    .array(
      z
        .string({ message: 'Email address must be a string' })
        .trim()
        .email({ message: 'Each recipient must be a valid email address' })
    )
    .optional(),
  type: z
    .enum(['escalation', 'callback'] as const, {
      message: 'Test email type must be either escalation or callback',
    })
    .optional(),
})

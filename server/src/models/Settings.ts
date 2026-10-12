import mongoose, { Schema, Document } from 'mongoose'

export interface ISettings extends Document {
  organization_name: string
  notify_on_escalation: boolean
  escalation_emails: string[]
  notify_on_callback: boolean
  callback_emails: string[]
  delivery_callback_emails: string[]
  repair_callback_emails: string[]
  device_issue_callback_emails: string[]
  sales_callback_emails: string[]
  resend_api_key?: string
  resend_from_email?: string
  forward_to_human: boolean
  forward_phone_number: string
  updatedAt: Date
  createdAt: Date
}

const SettingsSchema: Schema = new Schema(
  {
    organization_name: { type: String, default: 'Mantra Tech' },
    notify_on_escalation: { type: Boolean, default: true },
    escalation_emails: { type: [String], default: ['admin@mantratec.com'] },
    notify_on_callback: { type: Boolean, default: true },
    callback_emails: { type: [String], default: ['callback@mantratec.com'] },
    delivery_callback_emails: { type: [String], default: ['delivery@mantratec.com'] },
    repair_callback_emails: { type: [String], default: ['repair@mantratec.com'] },
    device_issue_callback_emails: { type: [String], default: ['techsupport@mantratec.com'] },
    sales_callback_emails: { type: [String], default: ['sales@mantratec.com'] },
    resend_api_key: { type: String, default: '' },
    resend_from_email: { type: String, default: 'onboarding@resend.dev' },
    forward_to_human: { type: Boolean, default: false },
    forward_phone_number: { type: String, default: '' },
  },
  { timestamps: true }
)

export const Settings = mongoose.model<ISettings>('Settings', SettingsSchema)

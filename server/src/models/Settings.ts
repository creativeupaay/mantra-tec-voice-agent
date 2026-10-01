import mongoose, { Schema, Document } from 'mongoose'

export interface ISettings extends Document {
  organization_name: string
  notify_on_escalation: boolean
  escalation_emails: string[]
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
    resend_api_key: { type: String, default: '' },
    resend_from_email: { type: String, default: 'onboarding@resend.dev' },
    forward_to_human: { type: Boolean, default: false },
    forward_phone_number: { type: String, default: '' },
  },
  { timestamps: true }
)

export const Settings = mongoose.model<ISettings>('Settings', SettingsSchema)

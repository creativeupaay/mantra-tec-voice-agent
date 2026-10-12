import { Request, Response, NextFunction } from 'express'
import { Settings } from '../models/Settings.js'
import {
  sendTestEscalationEmail,
  sendTestCallbackEmail,
} from '../services/email.service.js'

// Get system settings
export const getSettings = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let settings = await Settings.findOne().lean()
    
    if (!settings) {
      const created = await Settings.create({
        organization_name: 'Mantra Tech',
        notify_on_escalation: true,
        escalation_emails: ['admin@mantratec.com'],
        notify_on_callback: true,
        callback_emails: ['callback@mantratec.com'],
        delivery_callback_emails: ['delivery@mantratec.com'],
        repair_callback_emails: ['repair@mantratec.com'],
        device_issue_callback_emails: ['techsupport@mantratec.com'],
        sales_callback_emails: ['sales@mantratec.com'],
        resend_api_key: '',
        resend_from_email: 'onboarding@resend.dev',
        forward_to_human: false,
        forward_phone_number: '',
      })
      settings = created.toObject()
    } else {
      // Ensure defaults for any newly introduced fields in existing documents
      if (!Array.isArray(settings.delivery_callback_emails)) {
        settings.delivery_callback_emails = ['delivery@mantratec.com']
      }
      if (!Array.isArray(settings.repair_callback_emails)) {
        settings.repair_callback_emails = ['repair@mantratec.com']
      }
      if (!Array.isArray(settings.device_issue_callback_emails)) {
        settings.device_issue_callback_emails = ['techsupport@mantratec.com']
      }
      if (!Array.isArray(settings.sales_callback_emails)) {
        settings.sales_callback_emails = ['sales@mantratec.com']
      }
    }

    res.json({
      success: true,
      data: settings,
    })
  } catch (error) {
    next(error)
  }
}

// Update system settings
export const updateSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      organization_name,
      notify_on_escalation,
      escalation_emails,
      notify_on_callback,
      callback_emails,
      delivery_callback_emails,
      repair_callback_emails,
      device_issue_callback_emails,
      sales_callback_emails,
      resend_api_key,
      resend_from_email,
      forward_to_human,
      forward_phone_number,
    } = req.body

    let settings = await Settings.findOne()
    
    if (!settings) {
      settings = new Settings()
    }

    if (organization_name !== undefined) settings.organization_name = String(organization_name).trim()
    if (notify_on_escalation !== undefined) settings.notify_on_escalation = Boolean(notify_on_escalation)
    if (Array.isArray(escalation_emails)) {
      // Clean and validate emails
      const cleanEmails = escalation_emails
        .map((e: any) => String(e).trim().toLowerCase())
        .filter((e: string) => e.length > 3 && e.includes('@'))
      settings.escalation_emails = Array.from(new Set(cleanEmails))
    }
    if (notify_on_callback !== undefined) settings.notify_on_callback = Boolean(notify_on_callback)
    if (Array.isArray(callback_emails)) {
      // Clean and validate emails
      const cleanEmails = callback_emails
        .map((e: any) => String(e).trim().toLowerCase())
        .filter((e: string) => e.length > 3 && e.includes('@'))
      settings.callback_emails = Array.from(new Set(cleanEmails))
    }
    if (Array.isArray(delivery_callback_emails)) {
      const cleanEmails = delivery_callback_emails
        .map((e: any) => String(e).trim().toLowerCase())
        .filter((e: string) => e.length > 3 && e.includes('@'))
      settings.delivery_callback_emails = Array.from(new Set(cleanEmails))
    }
    if (Array.isArray(repair_callback_emails)) {
      const cleanEmails = repair_callback_emails
        .map((e: any) => String(e).trim().toLowerCase())
        .filter((e: string) => e.length > 3 && e.includes('@'))
      settings.repair_callback_emails = Array.from(new Set(cleanEmails))
    }
    if (Array.isArray(device_issue_callback_emails)) {
      const cleanEmails = device_issue_callback_emails
        .map((e: any) => String(e).trim().toLowerCase())
        .filter((e: string) => e.length > 3 && e.includes('@'))
      settings.device_issue_callback_emails = Array.from(new Set(cleanEmails))
    }
    if (Array.isArray(sales_callback_emails)) {
      const cleanEmails = sales_callback_emails
        .map((e: any) => String(e).trim().toLowerCase())
        .filter((e: string) => e.length > 3 && e.includes('@'))
      settings.sales_callback_emails = Array.from(new Set(cleanEmails))
    }
    if (resend_api_key !== undefined) settings.resend_api_key = String(resend_api_key).trim()
    if (resend_from_email !== undefined) settings.resend_from_email = String(resend_from_email).trim()
    if (forward_to_human !== undefined) settings.forward_to_human = Boolean(forward_to_human)
    if (forward_phone_number !== undefined) settings.forward_phone_number = String(forward_phone_number).trim()

    await settings.save()

    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: settings,
    })
  } catch (error) {
    next(error)
  }
}

// Send test email notification (escalation or categorized callback)
export const sendTestEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { emails, type } = req.body
    const targetEmails = Array.isArray(emails) && emails.length > 0 ? emails : undefined

    let result
    if (type === 'callback_delivery') {
      result = await sendTestCallbackEmail(targetEmails, 'delivery')
    } else if (type === 'callback_repair') {
      result = await sendTestCallbackEmail(targetEmails, 'repair')
    } else if (type === 'callback_device_issue') {
      result = await sendTestCallbackEmail(targetEmails, 'device_issue')
    } else if (type === 'callback_sales') {
      result = await sendTestCallbackEmail(targetEmails, 'sales')
    } else if (type === 'callback') {
      result = await sendTestCallbackEmail(targetEmails, 'general')
    } else {
      result = await sendTestEscalationEmail(targetEmails)
    }

    res.json({
      success: result.success,
      message: result.message,
    })
  } catch (error) {
    next(error)
  }
}

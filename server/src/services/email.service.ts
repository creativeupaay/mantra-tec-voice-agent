import { Settings } from '../models/Settings.js'
import { env } from '../config/env.config.js'

export interface CallEscalationData {
  _id?: string
  call_id?: string
  caller_name?: string | null
  phone_number?: string
  call_category?: string
  call_summary?: string
  transcript?: string
  timestamp?: string | Date
}

/**
 * Send an email notification for an escalated call to all configured recipients using Resend API.
 */
export async function sendEscalationEmailNotification(callData: CallEscalationData): Promise<{ success: boolean; message: string }> {
  try {
    const settings = await Settings.findOne()
    
    if (!settings || !settings.notify_on_escalation) {
      console.log('[EmailService] Escalation email notifications are disabled in settings.')
      return { success: false, message: 'Escalation email notifications are disabled' }
    }

    const recipients = (settings.escalation_emails || []).filter(e => Boolean(e && e.includes('@')))
    if (recipients.length === 0) {
      console.warn('[EmailService] No valid recipient emails configured for call escalation.')
      return { success: false, message: 'No valid recipient emails configured' }
    }

    const apiKey = (env.RESEND_API_KEY || settings.resend_api_key || '').trim()
    const fromEmail = (env.FROM_EMAIL || settings.resend_from_email || 'noreply@creativeupaay.in').trim()

    if (!apiKey) {
      console.warn('[EmailService] RESEND_API_KEY is not configured in process.env or settings.')
      return { success: false, message: 'RESEND_API_KEY is not configured' }
    }

    const dashboardBase = (
      (settings as any)?.dashboard_url ||
      env.DASHBOARD_URL ||
      env.CLIENT_URL ||
      'http://localhost:5173'
    ).replace(/\/$/, '')
    const targetCallId = callData._id || callData.call_id || ''
    const callDetailUrl = `${dashboardBase}/calls?callId=${targetCallId}`

    const callerIdentifier = callData.caller_name || callData.phone_number || 'Unknown Caller'
    const subject = `🚨 Escalated Call Alert: ${callerIdentifier} (${callData.call_category || 'General'})`

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ffffff;">
        <div style="background-color: #ef4444; color: #ffffff; padding: 16px 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h2 style="margin: 0; font-size: 20px; font-weight: bold;">Escalated Call Notification</h2>
          <p style="margin: 4px 0 0 0; font-size: 14px; opacity: 0.9;">Mantra Tech Voice Agent System</p>
        </div>

        <div style="padding: 20px; color: #333333;">
          <p style="font-size: 15px; line-height: 1.5; margin-bottom: 20px;">
            A voice call has been marked as <strong>ESCALATED</strong> and requires immediate team attention.
          </p>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
            <tr style="border-bottom: 1px solid #eeeeee;">
              <td style="padding: 10px; font-weight: bold; color: #666666; width: 35%;">Caller:</td>
              <td style="padding: 10px; color: #111111;">${callData.caller_name || 'N/A'} (${callData.phone_number || 'Unknown'})</td>
            </tr>
            <tr style="border-bottom: 1px solid #eeeeee;">
              <td style="padding: 10px; font-weight: bold; color: #666666;">Category:</td>
              <td style="padding: 10px; color: #111111; text-transform: capitalize;">${callData.call_category || 'General Inquiry'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eeeeee;">
              <td style="padding: 10px; font-weight: bold; color: #666666;">Date & Time:</td>
              <td style="padding: 10px; color: #111111;">${callData.timestamp ? new Date(callData.timestamp).toLocaleString() : new Date().toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: bold; color: #666666;">Call ID:</td>
              <td style="padding: 10px; color: #111111; font-family: monospace;">${callData.call_id || callData._id || 'N/A'}</td>
            </tr>
          </table>

          <div style="background-color: #f8fafc; border-left: 4px solid #ef4444; padding: 14px 16px; margin-bottom: 20px; border-radius: 4px;">
            <h4 style="margin: 0 0 8px 0; color: #1e293b; font-size: 14px;">Call Summary:</h4>
            <p style="margin: 0; color: #475569; font-size: 14px; line-height: 1.5;">${callData.call_summary || 'No summary available.'}</p>
          </div>

          ${callData.transcript ? `
          <div style="background-color: #f1f5f9; padding: 14px 16px; border-radius: 6px; margin-bottom: 20px;">
            <h4 style="margin: 0 0 8px 0; color: #334155; font-size: 13px;">Recent Transcript Snippet:</h4>
            <pre style="margin: 0; font-family: monospace; font-size: 12px; white-space: pre-wrap; color: #1e293b;">${callData.transcript.slice(0, 500)}${callData.transcript.length > 500 ? '...' : ''}</pre>
          </div>
          ` : ''}

          <div style="text-align: center; margin-top: 25px;">
            <a href="${callDetailUrl}" style="background-color: #0f172a; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">
              View Escalated Call in Dashboard
            </a>
          </div>
        </div>

        <div style="border-top: 1px solid #e0e0e0; padding-top: 15px; margin-top: 20px; text-align: center; color: #94a3b8; font-size: 12px;">
          This is an automated notification from Mantra Tech Voice Agent.
        </div>
      </div>
    `

    const resendPayload = {
      from: `Mantra Tech <${fromEmail}>`,
      to: recipients,
      subject,
      html: htmlBody,
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'MantraTechVoiceAgent/1.0',
      },
      body: JSON.stringify(resendPayload),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error(`[EmailService] Resend API Error (${response.status}): ${errText}`)
      return { success: false, message: `Resend API Error: ${errText}` }
    }

    const resData = await response.json()
    console.log(`[EmailService] Sent escalation email to ${recipients.join(', ')} via Resend. Email ID:`, (resData as any).id)
    return { success: true, message: `Notification sent to ${recipients.length} recipients` }
  } catch (error: any) {
    console.error('[EmailService] Failed to send escalation email:', error.message || error)
    return { success: false, message: error.message || 'Email sending failed' }
  }
}

/**
 * Send a sample test escalation email to verify recipient emails and Resend setup.
 */
export async function sendTestEscalationEmail(targetEmails?: string[]): Promise<{ success: boolean; message: string }> {
  const sampleCall: CallEscalationData = {
    call_id: 'test-escalation-sample-123',
    caller_name: 'Test Customer (Sample)',
    phone_number: '+919999988888',
    call_category: 'sales_escalation',
    call_summary: 'This is a test notification sent from Mantra Tech Settings to verify your email recipient list.',
    transcript: 'user: Hello, I need urgent assistance with bulk order quotation.\nassistant: I am escalating your query to our management team right away.',
    timestamp: new Date().toISOString()
  }

  if (targetEmails && targetEmails.length > 0) {
    const settings = await Settings.findOne() || new Settings()
    settings.escalation_emails = targetEmails
    await settings.save()
  }

  return await sendEscalationEmailNotification(sampleCall)
}

/**
 * Send a 6-digit OTP email for password reset via Resend API (with console fallback for local dev).
 */
export async function sendPasswordResetOtpEmail(
  toEmail: string,
  otp: string,
  userName?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const settings = await Settings.findOne()
    const apiKey = (env.RESEND_API_KEY || settings?.resend_api_key || '').trim()
    const fromEmail = (env.FROM_EMAIL || settings?.resend_from_email || 'noreply@creativeupaay.in').trim()

    console.log(`[EmailService] 🔐 Password Reset OTP for ${toEmail}: ${otp}`)

    if (!apiKey) {
      console.warn('[EmailService] RESEND_API_KEY is not configured. Logged OTP in console for testing.')
      return {
        success: true,
        message: 'Verification code generated (check server console in dev mode).',
      }
    }

    const recipientName = userName ? ` ${userName}` : ''
    const subject = `Mantra Tech — Password Reset Code: ${otp}`

    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 20px; background-color: #fafaf9; border-radius: 16px;">
        <div style="background-color: #ffffff; padding: 36px 28px; border-radius: 12px; border: 1px solid #e4e4e7; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
          
          <!-- Logo & Brand Header -->
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; width: 44px; height: 44px; line-height: 44px; background-color: #18181b; border-radius: 10px; text-align: center; margin-bottom: 12px;">
              <span style="color: #ffffff; font-size: 20px; font-weight: bold; vertical-align: middle;">M</span>
            </div>
            <h1 style="margin: 0; font-size: 20px; font-weight: 600; color: #18181b; letter-spacing: -0.02em;">Mantra Tech</h1>
            <p style="margin: 4px 0 0; font-size: 13px; color: #71717a;">Voice Agent Administration</p>
          </div>

          <!-- Message Body -->
          <h2 style="font-size: 16px; font-weight: 600; color: #18181b; margin-top: 0; margin-bottom: 8px; text-align: center;">
            Password Reset Verification
          </h2>
          <p style="font-size: 14px; line-height: 1.5; color: #3f3f46; margin-bottom: 24px; text-align: center;">
            Hi${recipientName}, we received a request to reset your Mantra Tech admin account password. Use the verification code below:
          </p>

          <!-- OTP Box -->
          <div style="background-color: #f4f4f5; border: 1px solid #e4e4e7; border-radius: 10px; padding: 20px 16px; text-align: center; margin-bottom: 24px;">
            <div style="font-family: 'JetBrains Mono', 'IBM Plex Mono', Menlo, Consolas, monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #18181b; margin-left: 8px;">
              ${otp}
            </div>
            <p style="margin: 8px 0 0; font-size: 12px; color: #71717a;">
              Valid for 10 minutes
            </p>
          </div>

          <!-- Security Notice -->
          <div style="border-top: 1px solid #f4f4f5; padding-top: 18px; margin-top: 24px;">
            <p style="font-size: 12px; line-height: 1.5; color: #71717a; margin: 0; text-align: center;">
              If you did not request this password reset, please ignore this email or contact support. Your password remains unchanged.
            </p>
          </div>

        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #a1a1aa;">
          &copy; ${new Date().getFullYear()} Mantra Tech Inc. All rights reserved.
        </div>
      </div>
    `

    const resendPayload = {
      from: `Mantra Tech <${fromEmail}>`,
      to: [toEmail],
      subject,
      html: htmlBody,
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'MantraTechVoiceAgent/1.0',
      },
      body: JSON.stringify(resendPayload),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error(`[EmailService] Resend API Error (${response.status}): ${errText}`)
      return { success: false, message: `Resend error: ${errText}` }
    }

    const resData = await response.json()
    console.log(`[EmailService] Sent password reset OTP to ${toEmail}. Resend ID:`, (resData as any).id)
    return { success: true, message: 'Verification code sent to your email.' }
  } catch (error: any) {
    console.error('[EmailService] Failed to send password reset OTP email:', error.message || error)
    return { success: false, message: error.message || 'Email delivery failed' }
  }
}

import { Settings } from '../models/Settings.js'

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

    const apiKey = process.env.RESEND_API_KEY || settings.resend_api_key || ''
    const fromEmail = process.env.FROM_EMAIL || settings.resend_from_email || 'noreply@creativeupaay.in'

    if (!apiKey) {
      console.warn('[EmailService] RESEND_API_KEY is not configured in server/.env')
      return { success: false, message: 'RESEND_API_KEY is not configured' }
    }

    const callerIdentifier = callData.caller_name || callData.phone_number || 'Unknown Caller'
    const subject = `🚨 Escalated Call Alert: ${callerIdentifier} (${callData.call_category || 'General'})`

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ffffff;">
        <div style="background-color: #ef4444; color: #ffffff; padding: 16px 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h2 style="margin: 0; font-size: 20px; font-weight: bold;">🚨 Escalated Call Notification</h2>
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
            <a href="http://localhost:5173/calls" style="background-color: #0f172a; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">
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

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

export type CallbackCategory = 'delivery' | 'repair' | 'device_issue' | 'sales' | 'general'

/**
 * Send an email notification for a callback-required call to configured category recipients using Resend API.
 */
export async function sendCallbackEmailNotification(
  callData: CallEscalationData,
  explicitCategory?: CallbackCategory
): Promise<{ success: boolean; message: string }> {
  try {
    const settings = await Settings.findOne()
    
    if (!settings || !settings.notify_on_callback) {
      console.log('[EmailService] Callback email notifications are disabled in settings.')
      return { success: false, message: 'Callback email notifications are disabled' }
    }

    // Determine category: either explicit, or from callData.callback_category, or infer from summary/transcript
    let category: CallbackCategory = explicitCategory || (callData as any).callback_category

    if (!category) {
      const textToAnalyze = `${callData.call_category || ''} ${callData.call_summary || ''} ${callData.transcript || ''}`.toLowerCase()
      if (textToAnalyze.includes('repair') || textToAnalyze.includes('rma') || textToAnalyze.includes('service center') || textToAnalyze.includes('servicing')) {
        category = 'repair'
      } else if (textToAnalyze.includes('delivery') || textToAnalyze.includes('courier') || textToAnalyze.includes('dispatch') || textToAnalyze.includes('tracking') || textToAnalyze.includes('order status') || textToAnalyze.includes('shipped')) {
        category = 'delivery'
      } else if (textToAnalyze.includes('not working') || textToAnalyze.includes('chal nahi raha') || textToAnalyze.includes('malfunction') || textToAnalyze.includes('defective') || textToAnalyze.includes('sensor error') || textToAnalyze.includes('kharab')) {
        category = 'device_issue'
      } else if (textToAnalyze.includes('sales') || textToAnalyze.includes('buy') || textToAnalyze.includes('purchase') || textToAnalyze.includes('bulk') || textToAnalyze.includes('wholesale') || textToAnalyze.includes('quotation') || textToAnalyze.includes('rfq') || textToAnalyze.includes('price') || textToAnalyze.includes('pricing') || textToAnalyze.includes('distributor') || textToAnalyze.includes('dealer')) {
        category = 'sales'
      } else {
        category = 'general'
      }
    }

    // Route to category-specific recipients with fallback to general callback_emails
    let targetEmailList: string[] = []
    let categoryBadgeText = 'Follow-Up Queue'
    let categoryThemeColor = '#4f46e5' // Indigo
    let categorySubjectPrefix = '📞 Callback Required Alert'
    let categoryDescription = 'A caller has requested or requires a <strong>CALLBACK</strong> from the support or sales team.'

    switch (category) {
      case 'delivery':
        targetEmailList = settings.delivery_callback_emails || []
        categoryBadgeText = 'New Device Delivery Follow-up'
        categoryThemeColor = '#0284c7' // Blue/Sky
        categorySubjectPrefix = '📦 Delivery Inquiry Callback'
        categoryDescription = 'A customer has inquired about <strong>NEW DEVICE DELIVERY / ORDER STATUS / DISPATCH TRACKING</strong> and requested a callback.'
        break
      case 'repair':
        targetEmailList = settings.repair_callback_emails || []
        categoryBadgeText = 'Device Repair & Service Status'
        categoryThemeColor = '#d97706' // Amber
        categorySubjectPrefix = '🔧 Repair & Service Status Callback'
        categoryDescription = 'A customer who sent their device for <strong>REPAIR / SERVICING / RMA</strong> is asking for a progress update and requested a callback.'
        break
      case 'device_issue':
        targetEmailList = settings.device_issue_callback_emails || []
        categoryBadgeText = 'Device Not Working / Malfunction Complaint'
        categoryThemeColor = '#e11d48' // Rose/Red
        categorySubjectPrefix = '⚠️ Device Malfunction Complaint Callback'
        categoryDescription = 'A customer is complaining that their <strong>DEVICE IS NOT WORKING / MALFUNCTIONING</strong> and urgently requires technical support callback.'
        break
      case 'sales':
        targetEmailList = settings.sales_callback_emails || []
        categoryBadgeText = 'Sales & Commercial Opportunity'
        categoryThemeColor = '#059669' // Emerald Green
        categorySubjectPrefix = '💼 Sales Inquiry Callback'
        categoryDescription = 'A prospective customer or partner has inquired about <strong>PURCHASING DEVICES / BULK ORDERS / QUOTATIONS / PRICING</strong> and requested a callback.'
        break
      case 'general':
      default:
        targetEmailList = settings.callback_emails || []
        categoryBadgeText = 'General Callback Queue'
        categoryThemeColor = '#4f46e5'
        categorySubjectPrefix = '📞 Callback Required Alert'
        categoryDescription = 'A caller has requested or requires a <strong>CALLBACK</strong> from the customer follow-up team.'
        break
    }

    let recipients = (targetEmailList || []).filter(e => Boolean(e && e.includes('@')))
    // If specific category has no emails configured, fall back to general callback_emails
    if (recipients.length === 0) {
      recipients = (settings.callback_emails || []).filter(e => Boolean(e && e.includes('@')))
    }

    if (recipients.length === 0) {
      console.warn(`[EmailService] No valid recipient emails configured for ${category} callback notifications.`)
      return { success: false, message: `No valid recipient emails configured for ${category} callback` }
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

    const callerIdentifier = callData.caller_name || callData.phone_number || 'Customer'
    const subject = `${categorySubjectPrefix}: ${callerIdentifier} (${callData.call_category || 'Inquiry'})`

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ffffff;">
        <div style="background-color: ${categoryThemeColor}; color: #ffffff; padding: 16px 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <span style="display: inline-block; padding: 3px 10px; background-color: rgba(255,255,255,0.2); border-radius: 12px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
            ${categoryBadgeText}
          </span>
          <h2 style="margin: 0; font-size: 20px; font-weight: bold;">Callback Notification</h2>
          <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">Mantra Tech Voice Agent System</p>
        </div>

        <div style="padding: 20px; color: #333333;">
          <p style="font-size: 15px; line-height: 1.5; margin-bottom: 20px;">
            ${categoryDescription}
          </p>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
            <tr style="border-bottom: 1px solid #eeeeee;">
              <td style="padding: 10px; font-weight: bold; color: #666666; width: 35%;">Caller:</td>
              <td style="padding: 10px; color: #111111;">${callData.caller_name || 'N/A'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eeeeee;">
              <td style="padding: 10px; font-weight: bold; color: #666666;">Phone to Call:</td>
              <td style="padding: 10px; color: #111111; font-weight: bold; font-family: monospace;">${callData.phone_number || 'Unknown'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eeeeee;">
              <td style="padding: 10px; font-weight: bold; color: #666666;">Category:</td>
              <td style="padding: 10px; color: #111111; text-transform: capitalize;">${callData.call_category || category}</td>
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

          <div style="background-color: #f8fafc; border-left: 4px solid ${categoryThemeColor}; padding: 14px 16px; margin-bottom: 20px; border-radius: 4px;">
            <h4 style="margin: 0 0 8px 0; color: #1e293b; font-size: 14px;">Call Summary & Inquiry:</h4>
            <p style="margin: 0; color: #334155; font-size: 14px; line-height: 1.5;">${callData.call_summary || 'No summary available.'}</p>
          </div>

          ${callData.transcript ? `
          <div style="background-color: #f1f5f9; padding: 14px 16px; border-radius: 6px; margin-bottom: 20px;">
            <h4 style="margin: 0 0 8px 0; color: #334155; font-size: 13px;">Recent Transcript Snippet:</h4>
            <pre style="margin: 0; font-family: monospace; font-size: 12px; white-space: pre-wrap; color: #1e293b;">${callData.transcript.slice(0, 500)}${callData.transcript.length > 500 ? '...' : ''}</pre>
          </div>
          ` : ''}

          <div style="text-align: center; margin-top: 25px;">
            <a href="${callDetailUrl}" style="background-color: ${categoryThemeColor}; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">
              View Call in Dashboard
            </a>
          </div>
        </div>

        <div style="border-top: 1px solid #e0e0e0; padding-top: 15px; margin-top: 20px; text-align: center; color: #94a3b8; font-size: 12px;">
          This is an automated categorized notification from Mantra Tech Voice Agent.
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
    console.log(`[EmailService] Sent ${category} callback email to ${recipients.join(', ')} via Resend. Email ID:`, (resData as any).id)
    return { success: true, message: `${categoryBadgeText} email sent to ${recipients.length} recipients` }
  } catch (error: any) {
    console.error('[EmailService] Failed to send callback email:', error.message || error)
    return { success: false, message: error.message || 'Email sending failed' }
  }
}

/**
 * Send a sample test callback email for a specific category to verify recipient emails and Resend setup.
 */
export async function sendTestCallbackEmail(
  targetEmails?: string[],
  category: CallbackCategory = 'general'
): Promise<{ success: boolean; message: string }> {
  let sampleCall: CallEscalationData

  switch (category) {
    case 'delivery':
      sampleCall = {
        call_id: 'test-delivery-sample-101',
        caller_name: 'Rajesh Sharma (Sample Delivery Query)',
        phone_number: '+919876543210',
        call_category: 'delivery',
        call_summary: 'Customer called inquiring about delivery and courier tracking for newly ordered Mantra MFS110 L1 biometric device. Docket #DTDC-99281. Requested callback from dispatch team.',
        transcript: 'user: Maine naya MFS110 order kiya tha, kab tak deliver hoga? Tracking number kaam nahi kar raha.\nassistant: Ji Rajesh ji, main delivery aur dispatch team se aapka callback arrange karwa deti hoon taaki wo exact tracking check karke aapko update dein.',
        timestamp: new Date().toISOString()
      }
      break

    case 'repair':
      sampleCall = {
        call_id: 'test-repair-sample-202',
        caller_name: 'Amit Patel (Sample RMA / Repair Query)',
        phone_number: '+919876543211',
        call_category: 'repair',
        call_summary: 'Customer inquiring about RMA status for device sent to Mantra service center 5 days ago for optical prism repair. Requested callback from service department.',
        transcript: 'user: Maine apna biometric device repair ke liye bheja tha RMA number 4829 ke sath. Kya update hai?\nassistant: Ji Amit ji, main repair desk ko aapki request bhej deti hoon. Hamari service team repair sheet check karke aapse callback karegi.',
        timestamp: new Date().toISOString()
      }
      break

    case 'device_issue':
      sampleCall = {
        call_id: 'test-device-issue-sample-303',
        caller_name: 'Sunil Verma (Sample Device Complaint)',
        phone_number: '+919876543212',
        call_category: 'device_issue',
        call_summary: 'Customer complaining that device red LED is blinking and finger is not capturing during authentication. Requested callback from senior technical support engineer.',
        transcript: 'user: Mere paas Mantra MFS110 device hai par chal nahi raha. Red light blink ho rahi hai aur capture nahi kar raha.\nassistant: Ji Sunil ji, pareshan mat hoiye. Main technical support team se turant callback arrange kar rahi hoon taaki wo issue solve kar sakein.',
        timestamp: new Date().toISOString()
      }
      break

    case 'sales':
      sampleCall = {
        call_id: 'test-sales-sample-404',
        caller_name: 'Vikram Singhania (Sample Sales Query)',
        phone_number: '+919876543214',
        call_category: 'sales',
        call_summary: 'Customer called inquiring about bulk purchase of 100 units of Mantra Iris & Fingerprint scanner devices for enterprise attendance. Requested formal quotation and callback from sales executive.',
        transcript: 'user: Mujhe 100 biometric devices chahiye hamari company ke liye. Bulk discount aur quotation chahiye.\nassistant: Ji Vikram ji, main sales department ko aapki requirement forward kar rahi hoon. Hamare sales manager aapse jald hi call karke quotation share karenge.',
        timestamp: new Date().toISOString()
      }
      break

    case 'general':
    default:
      sampleCall = {
        call_id: 'test-callback-sample-456',
        caller_name: 'Pooja Mehta (Sample General Follow-up)',
        phone_number: '+919876543213',
        call_category: 'support_callback',
        call_summary: 'This is a test notification sent from Mantra Tech Settings to verify your callback email recipient list.',
        transcript: 'user: Main thoda busy hoon, kya mujhe thodi der mein wapas call kar sakte hain?\nassistant: Ji bilkul, hamari follow-up team aapko callback karegi.',
        timestamp: new Date().toISOString()
      }
      break
  }

  if (targetEmails && targetEmails.length > 0) {
    const settings = await Settings.findOne() || new Settings()
    if (category === 'delivery') {
      settings.delivery_callback_emails = targetEmails
    } else if (category === 'repair') {
      settings.repair_callback_emails = targetEmails
    } else if (category === 'device_issue') {
      settings.device_issue_callback_emails = targetEmails
    } else if (category === 'sales') {
      settings.sales_callback_emails = targetEmails
    } else {
      settings.callback_emails = targetEmails
    }
    await settings.save()
  }

  return await sendCallbackEmailNotification(sampleCall, category)
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

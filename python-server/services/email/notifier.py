import os
import urllib.request
import json
from typing import List, Optional
from loguru import logger
from config.database import get_db

async def send_escalation_email(
    *,
    call_id: str,
    caller_name: Optional[str] = None,
    phone_number: Optional[str] = None,
    call_category: Optional[str] = None,
    call_summary: Optional[str] = None,
    transcript: Optional[str] = None,
):
    """Send an automated escalation email notification using Resend API to all configured recipients in settings."""
    try:
        db = get_db()
        settings_doc = await db.settings.find_one()
        
        if settings_doc and not settings_doc.get("notify_on_escalation", True):
            logger.info("[EmailNotifier] Escalation email notifications are disabled in settings.")
            return

        recipients: List[str] = []
        if settings_doc and isinstance(settings_doc.get("escalation_emails"), list):
            recipients = [e for e in settings_doc.get("escalation_emails") if isinstance(e, str) and "@" in e]
        
        if not recipients:
            recipients = ["admin@mantratec.com"]

        api_key = os.getenv("RESEND_API_KEY", "")
        from_email = os.getenv("FROM_EMAIL", "noreply@creativeupaay.in")

        if not api_key:
            logger.warning("[EmailNotifier] RESEND_API_KEY is not set in python-server/.env")
            return

        caller_id = caller_name or phone_number or "Unknown Caller"
        subject = f"🚨 Escalated Call Alert: {caller_id} ({call_category or 'General'})"

        html_body = f"""
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
                <td style="padding: 10px; color: #111111;">{caller_name or 'N/A'} ({phone_number or 'Unknown'})</td>
              </tr>
              <tr style="border-bottom: 1px solid #eeeeee;">
                <td style="padding: 10px; font-weight: bold; color: #666666;">Category:</td>
                <td style="padding: 10px; color: #111111; text-transform: capitalize;">{call_category or 'General Inquiry'}</td>
              </tr>
              <tr>
                <td style="padding: 10px; font-weight: bold; color: #666666;">Call ID:</td>
                <td style="padding: 10px; color: #111111; font-family: monospace;">{call_id}</td>
              </tr>
            </table>

            <div style="background-color: #f8fafc; border-left: 4px solid #ef4444; padding: 14px 16px; margin-bottom: 20px; border-radius: 4px;">
              <h4 style="margin: 0 0 8px 0; color: #1e293b; font-size: 14px;">Call Summary:</h4>
              <p style="margin: 0; color: #475569; font-size: 14px; line-height: 1.5;">{call_summary or 'No summary available.'}</p>
            </div>

            {f'<div style="background-color: #f1f5f9; padding: 14px 16px; border-radius: 6px; margin-bottom: 20px;"><h4 style="margin: 0 0 8px 0; color: #334155; font-size: 13px;">Recent Transcript:</h4><pre style="margin: 0; font-family: monospace; font-size: 12px; white-space: pre-wrap; color: #1e293b;">{transcript[:500] if transcript else ""}</pre></div>' if transcript else ''}

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
        """

        payload = json.dumps({
            "from": f"Mantra Tech <{from_email}>",
            "to": recipients,
            "subject": subject,
            "html": html_body,
        }).encode("utf-8")

        req = urllib.request.Request(
            "https://api.resend.com/emails",
            data=payload,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "User-Agent": "MantraTechVoiceAgent/1.0",
            },
            method="POST"
        )

        with urllib.request.urlopen(req) as resp:
            resp_body = resp.read().decode("utf-8")
            logger.info(f"[EmailNotifier] Sent escalation email to {recipients} via Resend. Response: {resp_body}")
    except Exception as e:
        logger.error(f"[EmailNotifier] Failed to send escalation email via Resend: {e}")

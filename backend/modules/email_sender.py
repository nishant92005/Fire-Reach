import os
import smtplib
import ssl
import sys
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any
import traceback


def send_email(to: str, subject: str, text: str, html: str) -> Dict[str, Any]:
    """
    Send email via Gmail SMTP
    """
    sender_email = os.getenv("SENDER_EMAIL")
    password = os.getenv("SENDER_PASSWORD")

    print(f"[EMAIL DEBUG] SENDER_EMAIL set: {bool(sender_email)}", file=sys.stderr)
    print(f"[EMAIL DEBUG] SENDER_PASSWORD set: {bool(password)}", file=sys.stderr)
    print(f"[EMAIL DEBUG] Recipient provided: {bool(to)}", file=sys.stderr)

    if not sender_email:
        error = "missing_SENDER_EMAIL - Check .env file"
        print(f"[EMAIL ERROR] {error}", file=sys.stderr)
        return {"status": "error", "error": error}
    
    if not password:
        error = "missing_SENDER_PASSWORD - Check .env file"
        print(f"[EMAIL ERROR] {error}", file=sys.stderr)
        return {"status": "error", "error": error}
    
    if not to or "@" not in to:
        error = f"invalid_recipient_email: {to}"
        print(f"[EMAIL ERROR] {error}", file=sys.stderr)
        return {"status": "error", "error": error}

    try:
        print(f"[EMAIL DEBUG] Creating MIME message...", file=sys.stderr)
        
        # Create the email
        msg = MIMEMultipart("alternative")
        msg["From"] = sender_email
        msg["To"] = to
        msg["Subject"] = subject

        # Attach plain text and HTML versions
        part1 = MIMEText(text, "plain")
        part2 = MIMEText(html or f"<pre>{text}</pre>", "html")
        msg.attach(part1)
        msg.attach(part2)

        print(f"[EMAIL DEBUG] Connecting to Gmail SMTP at smtp.gmail.com:465...", file=sys.stderr)
        
        # Connect to Gmail SMTP
        context = ssl.create_default_context()
        
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=context) as server:
            print(f"[EMAIL DEBUG] Connected to SMTP server", file=sys.stderr)
            
            print("[EMAIL DEBUG] Attempting SMTP login...", file=sys.stderr)
            server.login(sender_email, password)
            print(f"[EMAIL DEBUG] Login successful", file=sys.stderr)
            
            print("[EMAIL DEBUG] Sending email...", file=sys.stderr)
            server.sendmail(sender_email, to, msg.as_string())
            print(f"[EMAIL DEBUG] Email sent successfully", file=sys.stderr)

        return {
            "status": "sent",
            "message": f"Email sent successfully to {to}",
            "to": to,
            "from": sender_email,
        }
        
    except smtplib.SMTPAuthenticationError as e:
        error_msg = f"Gmail authentication FAILED. Check SENDER_EMAIL and SENDER_PASSWORD in .env. Details: {str(e)}"
        print(f"[EMAIL ERROR] {error_msg}", file=sys.stderr)
        return {"status": "error", "error": error_msg, "type": "authentication_error"}
        
    except smtplib.SMTPException as e:
        error_msg = f"SMTP error: {str(e)}"
        print(f"[EMAIL ERROR] {error_msg}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return {"status": "error", "error": error_msg, "type": "smtp_error"}
        
    except Exception as e:
        error_msg = f"Unexpected error: {str(e)}"
        print(f"[EMAIL ERROR] {error_msg}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return {"status": "error", "error": error_msg, "type": "unexpected_error", "details": traceback.format_exc()}


def test_email_config() -> Dict[str, Any]:
    """Debug function to test email configuration"""
    sender_email = os.getenv("SENDER_EMAIL")
    password = os.getenv("SENDER_PASSWORD")
    
    result = {
        "sender_email_set": bool(sender_email),
        "sender_password_set": bool(password),
    }
    
    # Try to connect to Gmail
    if sender_email and password:
        try:
            print("[TEST] Testing Gmail connection...", file=sys.stderr)
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=context) as server:
                print(f"[TEST] Connected, attempting login...", file=sys.stderr)
                server.login(sender_email, password)
                print(f"[TEST] Login successful!", file=sys.stderr)
                result["gmail_connection"] = "✅ SUCCESS - Gmail SMTP is working!"
        except smtplib.SMTPAuthenticationError as e:
            error_msg = f"❌ FAILED - Authentication error. Credentials are incorrect. Error: {str(e)}"
            print(f"[TEST] {error_msg}", file=sys.stderr)
            result["gmail_connection"] = error_msg
        except Exception as e:
            error_msg = f"❌ FAILED - {str(e)}"
            print(f"[TEST] {error_msg}", file=sys.stderr)
            result["gmail_connection"] = error_msg
    else:
        result["gmail_connection"] = "⚠️ SKIPPED - Missing credentials (check .env file)"
    
    return result


def send_email_tool(to_email: str, subject: str, body: str) -> str:
    """Helper function for sending emails"""
    result = send_email(
        to=to_email,
        subject=subject,
        text=body,
        html=body.replace("\n", "<br/>"),
    )

    status = result.get("status")
    if status == "sent":
        return "Email Sent Successfully"

    return f"Email send failed: {result.get('error')}"

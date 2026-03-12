# import os
# from typing import Dict, Any

# import resend


# def send_email(to: str, subject: str, text: str, html: str) -> Dict[str, Any]:
#     api_key = os.getenv("RESEND_API_KEY")
#     if not api_key:
#         return {"status": "error", "error": "missing_resend_api_key"}

#     resend.api_key = api_key

#     try:
#         r = resend.Emails.send(
#             {
#                 "from": os.getenv("RESEND_FROM", "onboarding@resend.dev"),
#                 "to": to,
#                 "subject": subject,
#                 "html": html or f"<pre>{text}</pre>",
#             }
#         )
#         email_id = getattr(r, "id", None) or (isinstance(r, dict) and r.get("id"))
#         return {"status": "sent", "id": email_id}
#     except Exception as e:
#         return {"status": "error", "error": str(e)}


# def send_email_tool(to_email: str, subject: str, body: str) -> str:
#     result = send_email(
#         to=to_email,
#         subject=subject,
#         text=body,
#         html=body.replace("\n", "<br/>"),
#     )

#     status = result.get("status")
#     if status == "sent":
#         return "Email Sent Successfully"

#     return f"Email send failed: {result.get('error')}"


import os
import smtplib, ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any


def send_email(to: str, subject: str, text: str, html: str) -> Dict[str, Any]:
    sender_email = os.getenv("SENDER_EMAIL")
    password = os.getenv("SENDER_PASSWORD")  # 16-char Gmail app password

    if not sender_email or not password:
        return {"status": "error", "error": "missing_sender_credentials"}

    try:
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

        # Connect to Gmail SMTP
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=context) as server:
            server.login(sender_email, password)
            server.sendmail(sender_email, to, msg.as_string())

        return {"status": "sent"}
    except Exception as e:
        return {"status": "error", "error": str(e)}


def send_email_tool(to_email: str, subject: str, body: str) -> str:
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
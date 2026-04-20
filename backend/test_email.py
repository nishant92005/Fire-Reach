#!/usr/bin/env python3
"""
Email Configuration Test Script
Helps diagnose email sending issues
"""

import os
import sys
from dotenv import load_dotenv

# Load .env file
env_path = os.path.join(os.path.dirname(__file__), ".env")
print(f"Loading .env from: {env_path}")
print(f".env file exists: {os.path.exists(env_path)}\n")

load_dotenv(dotenv_path=env_path, override=True)

# Test 1: Check if variables are loaded
print("=" * 60)
print("TEST 1: Environment Variables Loading")
print("=" * 60)

sender_email = os.getenv("SENDER_EMAIL")
sender_password = os.getenv("SENDER_PASSWORD")

print(f"SENDER_EMAIL set: {bool(sender_email)}")
print(f"SENDER_PASSWORD set: {bool(sender_password)}")
print()

# Test 2: Check if credentials are valid
print("=" * 60)
print("TEST 2: Gmail Credentials Validation")
print("=" * 60)

if not sender_email:
    print("❌ ERROR: SENDER_EMAIL not found in .env")
    sys.exit(1)

if not sender_password:
    print("❌ ERROR: SENDER_PASSWORD not found in .env")
    sys.exit(1)

if "@" not in sender_email:
    print(f"❌ ERROR: Invalid email format: {sender_email}")
    sys.exit(1)

if len(sender_password) < 16:
    print(f"⚠️  WARNING: Password seems too short ({len(sender_password)} chars). Gmail app passwords are usually 16+ chars.")

print("✅ Credentials format looks valid")
print()

# Test 3: Try to connect to Gmail SMTP
print("=" * 60)
print("TEST 3: Gmail SMTP Connection Test")
print("=" * 60)

import smtplib
import ssl

try:
    print(f"Connecting to smtp.gmail.com:465...")
    context = ssl.create_default_context()
    server = smtplib.SMTP_SSL("smtp.gmail.com", 465, context=context)
    print("✅ Connected to SMTP server")
    
    print("Attempting Gmail SMTP login...")
    server.login(sender_email, sender_password)
    print("✅ Login successful!")
    
    server.quit()
    print("\n✅ ALL TESTS PASSED - Email configuration is working!")
    
except smtplib.SMTPAuthenticationError as e:
    print(f"\n❌ AUTHENTICATION FAILED")
    print(f"Error: {str(e)}")
    print("\nPossible causes:")
    print("1. Wrong email or password")
    print("2. Gmail account doesn't have 2-factor authentication enabled")
    print("3. App password wasn't generated from https://myaccount.google.com/apppasswords")
    print("4. App password includes special characters (copy-paste it exactly)")
    sys.exit(1)
    
except smtplib.SMTPException as e:
    print(f"\n❌ SMTP ERROR: {str(e)}")
    sys.exit(1)
    
except Exception as e:
    print(f"\n❌ UNEXPECTED ERROR: {str(e)}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

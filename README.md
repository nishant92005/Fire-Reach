# FireReach

FireReach is an AI-powered outreach project that collects public company signals, summarizes them, generates a personalized outreach email, and lets the user review and send that email.

The project has two main parts:

- `backend/`: FastAPI backend for APIs, signal harvesting, AI research, email drafting, and SMTP sending
- `frontend/`: Next.js frontend where the user runs the workflow from a web interface

## What This Project Does

Imagine you want to send outreach to a target company. Normally you would have to:

- research the company
- check recent funding, hiring, or launch updates
- write a personalized email
- send it manually

FireReach brings this flow into one guided pipeline:

1. The user enters an ICP and a company name
2. The backend collects relevant public signals
3. Groq generates a short company brief
4. A personalized outreach email is drafted
5. The user can review, edit, and send the email

## Main Features

- Live signal harvesting from News API, Serper, and SerpAPI
- AI-generated account brief using Groq
- Personalized outreach email generation
- Manual review before email sending
- Gmail SMTP based email delivery
- Hunter.io based contact extraction
- Clean step-by-step frontend workflow

## Full Workflow

### 1. User Input

The frontend collects:

- ICP (Ideal Customer Profile)
- target company name
- target email or guessed company email

### 2. Signal Harvesting

The backend gathers public signals such as:

- funding news
- hiring activity
- product launches
- technology changes
- general public mentions

Signals are also deduplicated and filtered for relevance.

### 3. Research Summary

The collected signals are sent to Groq, which produces a short account brief describing the company’s current stage, direction, and likely pain points.

### 4. Outreach Email Generation

Using the brief and the signals, the system creates an outreach email that is:

- company-specific
- based on recent events or signals
- short and professional
- focused on one clear call to action

### 5. Review and Send

The user can:

- view the generated email
- edit it if needed
- send it through Gmail SMTP

### 6. Contact Extraction

The user can also extract company contacts using Hunter.io.

## Tech Stack

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS

### Backend

- FastAPI
- Pydantic
- python-dotenv
- Python standard library `urllib`
- SMTP via `smtplib`

### External Services

- Groq
- News API
- Serper
- SerpAPI
- Hunter.io
- Gmail SMTP

## Project Structure

```text
Fire-Reach-main/
├─ backend/
│  ├─ main.py
│  ├─ requirements.txt
│  ├─ test_email.py
│  └─ modules/
│     ├─ signal_harvester.py
│     ├─ research_analyst.py
│     └─ email_sender.py
├─ frontend/
│  ├─ package.json
│  ├─ src/app/
│  │  ├─ layout.tsx
│  │  ├─ page.tsx
│  │  └─ globals.css
│  └─ public/
└─ README.md
```

## Important Backend Files

### `backend/main.py`

This is the main FastAPI app. It handles:

- API endpoint definitions
- signal harvesting flow
- brief and email generation
- email sending
- Hunter.io contact extraction

### `backend/modules/signal_harvester.py`

This module is responsible for:

- News API fetching
- Serper fetching
- SerpAPI fallback
- signal classification
- deduplication
- relevance filtering

### `backend/modules/research_analyst.py`

This module uses Groq to:

- generate the account brief
- generate the outreach email
- provide fallback output if an LLM request fails

### `backend/modules/email_sender.py`

This module sends email through Gmail SMTP. Sensitive values are no longer exposed in logs.

### `backend/test_email.py`

This is a small diagnostic script that helps validate local email configuration.

## Important Frontend Files

### `frontend/src/app/page.tsx`

This is the main UI. The user can:

- enter the ICP
- enter the company name
- run the agent workflow
- extract contacts
- edit and send the generated email

### `frontend/src/app/layout.tsx`

Defines root layout and metadata.

### `frontend/src/app/globals.css`

Contains global CSS variables and base styling.

## API Endpoints

### Main Endpoints

- `POST /run-agent`
  Purpose: collect signals, generate brief, and generate outreach email

- `POST /send-email`
  Purpose: send the reviewed or edited email

- `GET /extract-contacts?company=...`
  Purpose: fetch company contacts from Hunter.io

### Debug Endpoints

The project also includes debug endpoints, but they are now disabled by default. To enable them, set `FIRE_REACH_ENABLE_DEBUG=true` in the backend environment.

## Environment Variables

Secrets should never be stored directly in the repository. Example files are included:

- `backend/.env.example`
- `frontend/.env.local.example`

### Backend Environment Variables

- `GROQ_API_KEY`
- `GROQ_MODEL`
- `NEWS_API_KEY`
- `SERPER_API_KEY`
- `SERPAPI_KEY`
- `HUNTER_API_KEY`
- `SENDER_EMAIL`
- `SENDER_PASSWORD`
- `FIRE_REACH_ENV`
- `FIRE_REACH_ENABLE_DEBUG`

### Frontend Environment Variables

- `NEXT_PUBLIC_API_BASE_URL`

## Local Setup

### Backend Setup

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Use `backend/.env.example` as a reference and create your real `backend/.env`.

To run the backend:

```powershell
uvicorn main:app --reload --port 8000
```

### Frontend Setup

```powershell
cd frontend
npm install
```

Use `frontend/.env.local.example` as a reference and create `frontend/.env.local`.

To run the frontend:

```powershell
npm run dev
```

The frontend will normally run on `http://localhost:3000`.

## How To Use The App

1. Start the backend
2. Start the frontend
3. Open the frontend in the browser
4. Enter the ICP
5. Enter the company name
6. Enter your own email or choose the guessed company email
7. Click `Run Agent`
8. Review the detected signals, company brief, and generated email
9. Edit the email if needed
10. Click `Send Email`

## Security Improvements Already Applied

Before pushing and sharing the repository, the following improvements were made:

- cleaned up `.gitignore`
- ignored `.env` files
- ignored `node_modules`, logs, caches, and virtual environments
- added example environment files
- made frontend API URL configurable through environment variables
- reduced sensitive SMTP logging
- disabled debug endpoints by default

## Remaining Security Advice

Before deploying publicly, still make sure that:

- real `.env` files are never committed
- API keys never appear in screenshots or logs
- Gmail app passwords are used instead of the main account password
- debug endpoints remain disabled in production
- CORS origins are reviewed for actual deployment domains

## Known Limitations

- Company domain guessing is heuristic-based and may not always be correct
- Contact extraction depends on Hunter.io response quality
- Signal quality depends on third-party APIs
- Email personalization depends on LLM output quality
- The backend still does not include full authentication or rate limiting

## Suggested Next Improvements

- add backend authentication
- add rate limiting
- improve input validation and sanitization
- modularize email templates
- add database-backed history
- document deployment steps
- add automated tests

## Summary

FireReach is a practical outreach automation tool that combines company research, signal detection, AI summarization, and personalized email drafting into a single workflow. It is especially useful for outbound sales, lead research, and founder-led outreach use cases.

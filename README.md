# FireReach

FireReach ek AI-powered outreach project hai jo kisi target company ke baare mein public web signals collect karta hai, un signals ko summarize karta hai, personalized outreach email draft karta hai, aur user review ke baad email send bhi kar sakta hai.

Ye project do parts mein bana hai:

- `backend/`: FastAPI backend jo APIs, signal harvesting, AI research, email drafting aur SMTP sending handle karta hai
- `frontend/`: Next.js frontend jahan user ICP, company aur email details dekar poora workflow chala sakta hai

## Project ka simple idea

Maan lo aap kisi B2B company ko outreach bhejna chahte ho. Normally aapko:

- company research karni padti hai
- recent funding ya hiring news dekhni padti hai
- phir personalized email likhna padta hai
- phir usse send karna padta hai

FireReach is process ko ek guided workflow mein laata hai:

1. User ICP aur company ka naam deta hai
2. Backend web se relevant signals dhoondhta hai
3. Groq LLM un signals se company brief banata hai
4. Personalized email generate hoti hai
5. User chahe to email edit karke send karta hai

## Main features

- Live signal harvesting from News API, Serper, and SerpAPI
- AI-generated account brief using Groq
- Personalized outreach email generation
- Manual review before sending email
- Gmail SMTP based email delivery
- Hunter.io based contact extraction
- Clean step-by-step UI

## Full workflow

### 1. User input

Frontend user se ye input leta hai:

- ICP (Ideal Customer Profile)
- target company name
- target email ya guessed company email

### 2. Signal harvesting

Backend company ke liye public signals collect karta hai:

- funding related news
- hiring updates
- product launches
- technology changes
- general market mentions

Signals ko deduplicate bhi kiya jata hai aur relevance ke hisaab se filter kiya jata hai.

### 3. Research summary

Collected signals ko Groq LLM ko diya jata hai, jisse ek short account brief banta hai. Ye brief company ki current stage, direction aur possible pain points ko explain karta hai.

### 4. Outreach email generation

Brief aur signals ke base par ek outreach email banayi jati hai jo:

- company-specific hoti hai
- recent signals ko reference karti hai
- short aur professional tone mein hoti hai
- clear CTA rakhti hai

### 5. Email review and send

User generated email ko frontend mein dekh sakta hai:

- direct send
- pehle edit kare
- phir send kare

Email Gmail SMTP ke through bheji jati hai.

### 6. Contact extraction

User alag se company contacts bhi fetch kar sakta hai. Iske liye backend Hunter.io API use karta hai.

## Tech stack

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS

### Backend

- FastAPI
- Pydantic
- python-dotenv
- standard library `urllib`
- SMTP via `smtplib`

### External services

- Groq
- News API
- Serper
- SerpAPI
- Hunter.io
- Gmail SMTP

## Folder structure

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

## Important backend files

### `backend/main.py`

Ye main FastAPI app hai. Ismein:

- API endpoints defined hain
- signal harvesting flow call hota hai
- brief aur email generation trigger hota hai
- email sending handle hota hai
- Hunter.io contact extraction hota hai

### `backend/modules/signal_harvester.py`

Ye module public web sources se signals collect karta hai.

Responsibilities:

- News API fetch
- Serper fetch
- SerpAPI fallback
- signal classification
- deduplication
- relevance filtering

### `backend/modules/research_analyst.py`

Ye Groq ke through:

- account brief generate karta hai
- outreach email generate karta hai
- fallback text bhi deta hai agar LLM call fail ho jaye

### `backend/modules/email_sender.py`

Ye Gmail SMTP use karke email send karta hai. Ab ismein sensitive values ko logs mein expose nahi kiya jata.

### `backend/test_email.py`

Ye local diagnostic script hai jo email setup validate karne mein help karta hai.

## Important frontend files

### `frontend/src/app/page.tsx`

Main UI yahin hai. User:

- ICP enter karta hai
- company name deta hai
- email run karta hai
- contacts extract karta hai
- generated email ko edit/send karta hai

### `frontend/src/app/layout.tsx`

App metadata aur root layout define karta hai.

### `frontend/src/app/globals.css`

Global CSS variables aur base styling rakhta hai.

## API endpoints

### Main endpoints

- `POST /run-agent`
  Purpose: signal collection + brief generation + email draft generation

- `POST /send-email`
  Purpose: reviewed/edited email send karna

- `GET /extract-contacts?company=...`
  Purpose: Hunter.io se company contacts nikalna

### Debug endpoints

Project mein debug endpoints bhi hain, lekin ab wo default se disabled hain. Unko enable karne ke liye backend env mein `FIRE_REACH_ENABLE_DEBUG=true` set karna padega.

## Environment variables

Secrets ko repo mein directly store nahi karna chahiye. Isliye example files add ki gayi hain:

- `backend/.env.example`
- `frontend/.env.local.example`

### Backend env variables

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

### Frontend env variables

- `NEXT_PUBLIC_API_BASE_URL`

## Local setup

### Backend setup

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

`backend/.env.example` ko dekhkar apna real `backend/.env` banao.

Backend run karne ke liye:

```powershell
uvicorn main:app --reload --port 8000
```

### Frontend setup

```powershell
cd frontend
npm install
```

`frontend/.env.local.example` ko copy karke `frontend/.env.local` banao aur API base URL set karo.

Frontend run karne ke liye:

```powershell
npm run dev
```

Frontend by default `http://localhost:3000` par chalega.

## How to use the app

1. Backend start karo
2. Frontend start karo
3. Browser mein frontend kholo
4. ICP likho
5. Company name do
6. Apna email do ya guessed company email choose karo
7. `Run Agent` click karo
8. Signals, research brief aur generated email dekho
9. Email edit karo agar zarurat ho
10. `Send Email` click karo

## Security improvements already applied

Project ko push aur share karne se pehle ye important changes kiye gaye:

- `.gitignore` ko clean kiya gaya
- `.env` files ko ignore kiya gaya
- `node_modules`, logs, cache, `.venv` ko ignore kiya gaya
- example env files add ki gayi
- frontend API URL ko env-based banaya gaya
- sensitive SMTP logs ko reduce kiya gaya
- debug endpoints ko default se disable kiya gaya

## Remaining practical security advice

Push karne se pehle ye check zarur karo:

- real `.env` file repo mein na ho
- API keys screenshot ya logs mein na ho
- Gmail app password hi use ho, personal password nahi
- production mein debug endpoints off rakho
- CORS origins ko deployment domains ke hisaab se review karo

## Known limitations

- Company domain guessing simple heuristic par based hai, isliye har company ke liye perfect nahi hoga
- Contact extraction Hunter.io response quality par depend karta hai
- Signal quality external APIs par depend karti hai
- Email personalization LLM output quality par depend karti hai
- Backend mein proper auth/rate-limit abhi nahi hai, isliye public internet exposure se pehle aur hardening karni chahiye

## Suggested next improvements

- backend authentication add karna
- rate limiting add karna
- input validation aur sanitization aur strong karna
- email templates ko modular banana
- database-based history add karna
- deployment config document karna
- automated tests add karna

## Summary

FireReach ek practical outreach automation tool hai jo research, signal detection, AI summary aur personalized email drafting ko ek single flow mein laata hai. Ye especially sales, outbound, lead research, aur founder-led outreach use cases ke liye useful ho sakta hai.

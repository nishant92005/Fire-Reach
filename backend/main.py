import os
import re
from typing import List, Optional, Dict, Any, Tuple

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Load .env file explicitly using python-dotenv
base_dir = os.path.dirname(__file__)
env_path = os.path.join(base_dir, ".env")
load_dotenv(dotenv_path=env_path, override=True)

from modules.signal_harvester import harvest_signals
from modules.research_analyst import generate_account_brief, generate_outreach_email
from modules.email_sender import send_email, test_email_config
from modules.signal_harvester import _newsapi as dbg_newsapi
from modules.signal_harvester import _serper as dbg_serper
from modules.signal_harvester import _serpapi as dbg_serpapi
import urllib.request
import urllib.parse
import json
from urllib.parse import urlparse


def _env_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}

def _load_env_from_file():
    """Fallback manual load if dotenv fails"""
    try:
        base_dir = os.path.dirname(__file__)
        env_path = os.path.join(base_dir, ".env")
        if os.path.exists(env_path):
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" in line:
                        k, v = line.split("=", 1)
                        os.environ.setdefault(k.strip(), v.strip())
    except Exception as e:
        print(f"Error loading .env manually: {e}")
        pass

_load_env_from_file()


def _debug_enabled() -> bool:
    return _env_flag("FIRE_REACH_ENABLE_DEBUG", default=False)


def _require_debug_enabled() -> None:
    if not _debug_enabled():
        raise HTTPException(status_code=404, detail="Debug endpoints are disabled")


def _extract_company_domain(signals: List[Dict[str, Any]], company: str) -> str:
    for signal in signals:
        url = signal.get("url")
        if url:
            try:
                host = urlparse(url).hostname or ""
                if host.startswith("www."):
                    host = host[4:]
                if "." in host:
                    return host
            except Exception:
                pass

    # fallback to a heuristic domain from company name
    normalized = company.lower().strip()
    normalized = normalized.replace(" ", "")
    normalized = normalized.replace(",", "").replace(".", "")
    return f"{normalized}.com"


def _extract_company_email_from_serpapi(company: str, domain: str) -> Optional[str]:
    api_key = os.getenv("SERPAPI_KEY")
    if not api_key:
        return None

    url = "https://serpapi.com/search.json"
    queries = []
    if domain:
        queries.extend([
            f"site:{domain} contact email",
            f"site:{domain} @{domain}",
            f"site:{domain} contact",
            f"site:{domain} email",
        ])
    queries.append(f"{company} contact email")
    queries.append(f"{company} contact")

    email_pattern = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")

    def collect_emails(data: Any) -> List[str]:
        candidates: List[str] = []

        def collect_from(obj: Any) -> None:
            if isinstance(obj, str):
                candidates.extend(email_pattern.findall(obj))
            elif isinstance(obj, dict):
                for value in obj.values():
                    collect_from(value)
            elif isinstance(obj, list):
                for item in obj:
                    collect_from(item)

        collect_from(data)
        return candidates

    found: List[str] = []
    for query in queries:
        try:
            params = {
                "engine": "google",
                "q": query,
                "hl": "en",
                "num": 10,
                "api_key": api_key,
            }
            request_url = f"{url}?{urllib.parse.urlencode(params)}"
            req = urllib.request.Request(request_url)
            with urllib.request.urlopen(req, timeout=20) as res:
                data = json.loads(res.read().decode())
        except Exception:
            continue

        found.extend(collect_emails(data))
        if found:
            break

    deduped = []
    for email in found:
        lower = email.lower()
        if lower not in deduped:
            deduped.append(lower)

    if domain:
        for email in deduped:
            if email.endswith(f"@{domain}"):
                return email

    return deduped[0] if deduped else None


def _guess_company_email(signals: List[Dict[str, Any]], company: str) -> str:
    domain = _extract_company_domain(signals, company)
    best_email = _extract_company_email_from_serpapi(company, domain)
    if best_email:
        return best_email

    common_aliases = ["contact", "hello", "info", "sales", "support", "team"]
    for alias in common_aliases:
        return f"{alias}@{domain}"
    return f"contact@{domain}"

class RunAgentRequest(BaseModel):
    icp: str
    company: str
    email: Optional[str] = None
    use_company_email: bool = False

class Signal(BaseModel):
    type: str
    title: str
    url: Optional[str] = None
    source: Optional[str] = None
    published_at: Optional[str] = None

class RunAgentResponse(BaseModel):
    signals: List[Signal]
    brief: str
    email: str
    email_delivery_status: str
    email_id: Optional[str] = None
    recipient: str
    company_email: Optional[str] = None

class SendEmailRequest(BaseModel):
    recipient: str
    subject: str
    email_content: str

app = FastAPI(title="FireReach - Autonomous Outreach Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://fire-reach-seven.vercel.app",
        "https://fire-reach.onrender.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/debug/status")
def debug_status():
    _require_debug_enabled()
    return {
        "GROQ_API_KEY": bool(os.getenv("GROQ_API_KEY")),
        "NEWS_API_KEY": bool(os.getenv("NEWS_API_KEY")),
        "SERPER_API_KEY": bool(os.getenv("SERPER_API_KEY")),
        "SERPAPI_KEY": bool(os.getenv("SERPAPI_KEY")),
        "SENDER_EMAIL": bool(os.getenv("SENDER_EMAIL")),
        "SENDER_PASSWORD": bool(os.getenv("SENDER_PASSWORD")),
        "FIRE_REACH_SEND": os.getenv("FIRE_REACH_SEND", "true"),
    }

@app.get("/debug/email-config")
def debug_email_config():
    """Test email configuration and Gmail connectivity"""
    _require_debug_enabled()
    return test_email_config()

@app.get("/debug/groq/models")
def debug_groq_models():
    _require_debug_enabled()
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Missing GROQ_API_KEY")
    try:
        req = urllib.request.Request(
            "https://api.groq.com/openai/v1/models",
            headers={"Authorization": f"Bearer {api_key}"},
            method="GET",
        )
        with urllib.request.urlopen(req, timeout=30) as res:
            data = json.loads(res.read().decode())
            return {"ok": True, "models": [m.get("id") for m in data.get("data", [])]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/debug/news")
def debug_news(company: str):
    _require_debug_enabled()
    try:
        return {"ok": True, "results": dbg_newsapi(company)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/debug/serper")
def debug_serper(company: str):
    _require_debug_enabled()
    try:
        return {"ok": True, "results": dbg_serper(company)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/debug/serpapi")
def debug_serpapi(company: str):
    _require_debug_enabled()
    try:
        return {"ok": True, "results": dbg_serpapi(company)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class BriefReq(BaseModel):
    icp: str
    company: str
    signals: List[Signal] = []

@app.post("/debug/groq/brief")
def debug_groq_brief(req: BriefReq):
    _require_debug_enabled()
    try:
        sigs = [dict(type=s.type, title=s.title, url=s.url, source=s.source, published_at=s.published_at) for s in req.signals]
        brief = generate_account_brief(icp=req.icp, company=req.company, signals=sigs)
        return {"ok": True, "brief": brief}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class EmailReq(BaseModel):
    icp: str
    company: str
    brief: str
    signals: List[Signal] = []

@app.post("/debug/groq/email")
def debug_groq_email(req: EmailReq):
    _require_debug_enabled()
    try:
        sigs = [dict(type=s.type, title=s.title, url=s.url, source=s.source, published_at=s.published_at) for s in req.signals]
        email_body = generate_outreach_email(icp=req.icp, company=req.company, signals=sigs, brief=req.brief)
        return {"ok": True, "email": email_body}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ResendReq(BaseModel):
    to: str
    subject: str
    text: str
    html: str

@app.post("/debug/resend")
def debug_resend(req: ResendReq):
    _require_debug_enabled()
    try:
        result = send_email(to=req.to, subject=req.subject, text=req.text, html=req.html)
        return {"ok": result.get("status") == "sent", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/debug/test-email")
def debug_test_email(to: str):
    """Send a test email to verify Gmail configuration"""
    _require_debug_enabled()
    test_subject = "FireReach Test Email"
    test_body = "This is a test email from FireReach. If you receive this, your Gmail setup is working correctly!"
    
    try:
        result = send_email(
            to=to,
            subject=test_subject,
            text=test_body,
            html=f"<p>{test_body}</p>"
        )
        return {"ok": result.get("status") == "sent", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/run-agent", response_model=RunAgentResponse)
def run_agent(req: RunAgentRequest):
    if not os.getenv("NEWS_API_KEY") and not (os.getenv("SERPER_API_KEY") or os.getenv("SERPAPI_KEY")):
        raise HTTPException(status_code=500, detail="Missing signal harvesting API keys")
    if not os.getenv("GROQ_API_KEY"):
        raise HTTPException(status_code=500, detail="Missing Groq API key")

    signals = harvest_signals(company=req.company)
    brief = generate_account_brief(icp=req.icp, company=req.company, signals=signals)
    email_body = generate_outreach_email(icp=req.icp, company=req.company, signals=signals, brief=brief)

    if req.use_company_email:
        company_email = _guess_company_email(signals, req.company)
        recipient = company_email
    else:
        if not req.email:
            raise HTTPException(status_code=400, detail="Email is required when not using company email")
        recipient = req.email
        company_email = None

    # Return without sending - user will edit and send via /send-email endpoint
    return RunAgentResponse(
        signals=[Signal(**s) for s in signals],
        brief=brief,
        email=email_body,
        email_delivery_status="pending",  # Mark as pending since not sent yet
        email_id=None,
        recipient=recipient,
        company_email=company_email,
    )

@app.post("/send-email")
def send_outreach_email(req: SendEmailRequest):
    """Send the outreach email (possibly edited by user)"""
    if not req.recipient or "@" not in req.recipient:
        raise HTTPException(status_code=400, detail="Invalid recipient email")
    
    if not req.email_content:
        raise HTTPException(status_code=400, detail="Email content cannot be empty")
    
    if not req.subject:
        raise HTTPException(status_code=400, detail="Email subject is required")
    
    # Send the email with exact content provided
    delivery = send_email(
        to=req.recipient,
        subject=req.subject,
        text=req.email_content,
        html=req.email_content.replace("\n", "<br/>"),
    )
    
    return {
        "status": delivery.get("status", "unknown"),
        "message": delivery.get("message", ""),
        "email_id": delivery.get("id"),
        "recipient": req.recipient,
    }

@app.get("/debug/run-agent-sample", response_model=RunAgentResponse)
def debug_run_agent_sample(icp: str, company: str, email: Optional[str] = None, use_company_email: bool = False):
    _require_debug_enabled()
    return run_agent(RunAgentRequest(icp=icp, company=company, email=email, use_company_email=use_company_email))

# Hunter.io Contact Extraction

class Contact(BaseModel):
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    full_name: Optional[str] = None
    title: Optional[str] = None
    department: Optional[str] = None
    seniority: Optional[str] = None
    linkedin_url: Optional[str] = None
    twitter_url: Optional[str] = None
    phone_number: Optional[str] = None
    score: Optional[float] = None

class ExtractContactsResponse(BaseModel):
    domain: str
    contacts: List[Contact]
    total_count: int
    company: str

def _extract_domain_from_company(company: str) -> str:
    """Extract domain from company name using simple heuristic"""
    normalized = company.lower().strip()
    # Remove common corporate suffixes
    normalized = re.sub(r'\s+(inc|llc|ltd|corp|co|corporation|company|group|holdings|ventures|labs|io)\.?$', '', normalized, flags=re.IGNORECASE)
    # Replace spaces and special chars with nothing (not dashes, to preserve word boundaries)
    normalized = re.sub(r'[^a-z0-9\-]', '', normalized)
    # Remove leading/trailing dashes
    normalized = normalized.strip('-')
    return f"{normalized}.com"

def _fetch_contacts_from_hunter(domain: str) -> Tuple[List[dict], int]:
    """Fetch contacts from Hunter.io API"""
    api_key = os.getenv("HUNTER_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Missing HUNTER_API_KEY environment variable")
    
    try:
        # Clean domain - remove www. if present
        if domain.startswith("www."):
            domain = domain[4:]
        
        # Ensure domain is lowercase
        domain = domain.lower().strip()
        
        # Validate domain format (should have at least one dot)
        if "." not in domain:
            raise HTTPException(status_code=400, detail=f"Invalid domain format: {domain}. Please provide a valid domain or company name.")
        
        url = "https://api.hunter.io/v2/domain-search"
        params = {
            "domain": domain,
            "api_key": api_key
        }
        
        request_url = f"{url}?{urllib.parse.urlencode(params)}"
        print(f"[Hunter.io] Requesting domain: {domain}")
        print(f"[Hunter.io] API URL: {url}")
        req = urllib.request.Request(request_url)
        
        with urllib.request.urlopen(req, timeout=30) as res:
            data = json.loads(res.read().decode())
            
            if data.get("errors"):
                error = data.get("errors")[0] if isinstance(data.get("errors"), list) else data.get("errors")
                raise HTTPException(status_code=400, detail=f"Hunter.io API error: {error}")
            
            contacts_data = data.get("data", {}).get("emails", [])
            total = data.get("data", {}).get("total", len(contacts_data))
            
            return contacts_data, total
    except urllib.error.HTTPError as e:
        error_response_text = ""
        try:
            error_data_bytes = e.read()
            error_response_text = error_data_bytes.decode()
            error_data = json.loads(error_response_text)
            if isinstance(error_data.get("errors"), list) and len(error_data.get("errors", [])) > 0:
                error_msg = error_data.get("errors")[0].get("message", str(error_data))
            else:
                error_msg = str(error_data)
        except:
            error_msg = error_response_text if error_response_text else f"HTTP {e.code}: {e.reason}"
        print(f"[Hunter.io] Error Response: {error_msg}")
        raise HTTPException(status_code=e.code, detail=f"Hunter.io API error: {error_msg}")
    except Exception as e:
        print(f"[Hunter.io] Exception: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching contacts from Hunter.io: {str(e)}")

@app.get("/extract-contacts")
def extract_contacts(company: str = Query(...)):
    """Extract contacts from a company using Hunter.io API"""
    if not company or not company.strip():
        raise HTTPException(status_code=400, detail="Company name is required")
    
    # Try to extract domain from signals first using company name
    domain = _extract_domain_from_company(company)
    
    # Fetch contacts from Hunter.io
    contacts_data, total = _fetch_contacts_from_hunter(domain)
    
    # Format contacts
    contacts = [
        Contact(
            email=c.get("value"),
            first_name=c.get("first_name"),
            last_name=c.get("last_name"),
            full_name=c.get("full_name"),
            title=c.get("position"),
            department=c.get("department"),
            seniority=c.get("seniority"),
            linkedin_url=c.get("linkedin_url"),
            twitter_url=c.get("twitter_url"),
            phone_number=c.get("phone_number"),
            score=c.get("score")
        )
        for c in contacts_data
    ]
    
    return ExtractContactsResponse(
        domain=domain,
        contacts=contacts,
        total_count=total,
        company=company
    )

@app.get("/debug/hunter-test")
def debug_hunter_test(company: str = Query(..., description="Company name to extract domain from")):
    """Debug endpoint to test Hunter.io API call"""
    _require_debug_enabled()
    try:
        domain = _extract_domain_from_company(company)
        return {
            "company": company,
            "extracted_domain": domain,
            "hunter_api_key_present": bool(os.getenv("HUNTER_API_KEY")),
            "api_endpoint": "https://api.hunter.io/v2/domain-search"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error in debug: {str(e)}")

import os
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .modules.signal_harvester import harvest_signals
from .modules.research_analyst import generate_account_brief, generate_outreach_email, generate_outreach_email_variant
from .modules.email_sender import send_email
from .modules.signal_harvester import _newsapi as dbg_newsapi
from .modules.signal_harvester import _serper as dbg_serper
from .modules.signal_harvester import _serpapi as dbg_serpapi
import urllib.request
import json

def _load_env_from_file():
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
    except Exception:
        pass

_load_env_from_file()

class RunAgentRequest(BaseModel):
    icp: str
    company: str
    email: str

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

app = FastAPI(title="FireReach – Autonomous Outreach Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/debug/status")
def debug_status():
    return {
        "GROQ_API_KEY": bool(os.getenv("GROQ_API_KEY")),
        "NEWS_API_KEY": bool(os.getenv("NEWS_API_KEY")),
        "SERPER_API_KEY": bool(os.getenv("SERPER_API_KEY")),
        "SERPAPI_KEY": bool(os.getenv("SERPAPI_KEY")),
        "RESEND_API_KEY": bool(os.getenv("RESEND_API_KEY")),
        "FIRE_REACH_SEND": os.getenv("FIRE_REACH_SEND", "true"),
    }

@app.get("/debug/groq/models")
def debug_groq_models():
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
    try:
        return {"ok": True, "results": dbg_newsapi(company)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/debug/serper")
def debug_serper(company: str):
    try:
        return {"ok": True, "results": dbg_serper(company)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/debug/serpapi")
def debug_serpapi(company: str):
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
    try:
        result = send_email(to=req.to, subject=req.subject, text=req.text, html=req.html)
        return {"ok": result.get("status") == "sent", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/run-agent", response_model=RunAgentResponse)
def run_agent(req: RunAgentRequest):
    if not os.getenv("NEWS_API_KEY") and not (os.getenv("SERPER_API_KEY") or os.getenv("SERPAPI_KEY")):
        raise HTTPException(status_code=500, detail="Missing signal harvesting API keys")
    if not os.getenv("GROQ_API_KEY"):
        raise HTTPException(status_code=500, detail="Missing Groq API key")
    send_enabled = os.getenv("FIRE_REACH_SEND", "true").lower() not in {"0", "false", "no"}
    if send_enabled and not os.getenv("RESEND_API_KEY"):
        raise HTTPException(status_code=500, detail="Missing Resend API key")

    signals = harvest_signals(company=req.company)
    brief = generate_account_brief(icp=req.icp, company=req.company, signals=signals)
    email_body = generate_outreach_email(icp=req.icp, company=req.company, signals=signals, brief=brief)
    email_to_send = generate_outreach_email_variant(icp=req.icp, company=req.company, signals=signals, brief=brief, base_email=email_body)
    delivery = send_email(
        to=req.email,
        subject=f"{req.company} <> FireReach",
        text=email_to_send,
        html=email_to_send.replace("\n", "<br/>"),
    )

    return RunAgentResponse(
        signals=[Signal(**s) for s in signals],
        brief=brief,
        email=email_body,
        email_delivery_status=delivery.get("status", "unknown"),
        email_id=delivery.get("id"),
    )

@app.get("/debug/run-agent-sample", response_model=RunAgentResponse)
def debug_run_agent_sample(icp: str, company: str, email: str):
    return run_agent(RunAgentRequest(icp=icp, company=company, email=email))

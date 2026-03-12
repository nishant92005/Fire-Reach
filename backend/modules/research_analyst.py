import os
from typing import List, Dict, Any
import json
import urllib.request

def _signals_to_bullets(signals: List[Dict[str, Any]]) -> str:
    bullets = []
    for s in signals[:8]:
        title = s.get("title", "")
        typ = s.get("type", "Signal")
        bullets.append(f"- [{typ}] {title}")
    return "\n".join(bullets) or "- No strong signals found."

def _chat_completion(messages: List[Dict[str, str]], model: str = None, temperature: float = 0.3) -> str:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("Missing GROQ_API_KEY")
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    body = {
        "model": model or os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"),
        "messages": messages,
        "temperature": temperature,
    }
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=60) as res:
        data = json.loads(res.read().decode())
        return data["choices"][0]["message"]["content"].strip()

def generate_account_brief(icp: str, company: str, signals: List[Dict[str, Any]]) -> str:
    prompt = (
        f"You are a B2B research analyst. Company: {company}.\n"
        f"ICP: {icp}\n"
        f"Detected signals:\n{_signals_to_bullets(signals)}\n\n"
        "Write a concise two-paragraph Account Brief (6-10 total sentences). "
        "Explain current growth stage, strategic direction, and potential pain points aligned to the ICP. "
        "Be specific and reference the signals when relevant."
    )
    try:
        return _chat_completion(
            messages=[{"role": "system", "content": "You analyze companies."}, {"role": "user", "content": prompt}],
            temperature=0.3,
        )
    except Exception:
        top = signals[:3]
        parts = []
        if top:
            refs = "; ".join([s.get("title", "") for s in top if s.get("title")])
        else:
            refs = "limited public signals available at this time"
        parts.append(f"{company} appears to be advancing through a growth phase aligned with your ICP. Initial indicators suggest {refs}. This likely reflects active initiatives across hiring, product, or capital planning.")
        parts.append(f"Based on the ICP, potential pain points include prioritization of the highest-impact opportunities, and consistent execution under resource constraints. A tailored approach focused on measurable outcomes and time-to-value would help de-risk adoption.")
        return "\n\n".join(parts)

def generate_outreach_email(icp: str, company: str, signals: List[Dict[str, Any]], brief: str) -> str:
    sig_lines = _signals_to_bullets(signals)
    prompt = (
        f"Craft a highly personalized outreach email to {company}.\n"
        f"ICP: {icp}\n"
        f"Account Brief:\n{brief}\n"
        f"Signals:\n{sig_lines}\n\n"
        "Requirements:\n"
        "- Reference at least two specific signals by paraphrasing their content.\n"
        "- Keep to ~150-220 words, 2-3 short paragraphs.\n"
        "- Focus on the company's growth stage and pains matching the ICP.\n"
        "- Include one clear call-to-action for a short intro call.\n"
        "- Use a friendly, professional tone.\n"
    )
    try:
        return _chat_completion(
            messages=[{"role": "system", "content": "You write personalized sales emails."}, {"role": "user", "content": prompt}],
            temperature=0.25,
        )
    except Exception:
        s_titles = [s.get("title", "") for s in signals[:3] if s.get("title")]
        mention = "; ".join(s_titles) if s_titles else "recent momentum"
        body = []
        body.append(f"Subject: Quick idea for {company}'s next quarter\n")
        body.append(f"Hi {company} team,\n\nI noticed {mention}. Given your current focus, I believe we can help align outreach with the most timely signals your buyers care about and compress the time to first meaningful conversation.\n")
        body.append("We specialize in building ICP-aligned messaging that references real-world triggers (funding, hiring, launches) to raise reply rates. If this resonates, could we schedule a 15-minute intro to walk through your pipeline and identify a pilot segment?\n\nBest,\nFireReach")
        return "\n".join(body)

def generate_outreach_email_variant(icp: str, company: str, signals: List[Dict[str, Any]], brief: str, base_email: str) -> str:
    sig_lines = _signals_to_bullets(signals)
    prompt = (
        f"Rewrite the following outreach email for {company} with a distinct structure, wording, and subject.\n"
        f"ICP: {icp}\n"
        f"Account Brief:\n{brief}\n"
        f"Signals:\n{sig_lines}\n\n"
        "Constraints:\n"
        "- Produce a different subject line.\n"
        "- Do not reuse any entire sentence from the original.\n"
        "- Keep length ~150-220 words; 2-3 short paragraphs.\n"
        "- Keep a single clear CTA.\n\n"
        "Original:\n"
        f"{base_email}\n"
    )
    try:
        return _chat_completion(
            messages=[{"role": "system", "content": "You write personalized sales emails."}, {"role": "user", "content": prompt}],
            temperature=0.35,
        )
    except Exception:
        lines = [l for l in base_email.splitlines() if l.strip()]
        subject = f"Subject: A new angle for {company}'s outreach"
        para1 = f"Hello {company} team,\n\nYour recent activity {(', '.join([s.get('title','') for s in signals[:2] if s.get('title')])) or 'across hiring and product updates'} suggests a window to resonate with buyers using timely context and compact messaging tuned to their priorities."
        para2 = "We focus on aligning ICP-specific pains with live triggers (new roles, launches, capital moves) to raise reply rates without bloating cadence or time-to-value. If useful, let's spend 15 minutes reviewing pipeline segments and carve out a lightweight pilot."
        return "\n\n".join([subject, para1, para2])

import os
from typing import List, Dict, Any
import json
import urllib.request
import urllib.parse
from datetime import datetime, timedelta
from urllib.parse import urlparse

def classify(text: str) -> str:
    t = text.lower()
    if any(k in t for k in ["raise", "raised", "funding", "series a", "series b", "seed", "investment"]):
        return "Funding"
    if any(k in t for k in ["hire", "hiring", "jobs", "recruit", "talent", "headcount"]):
        return "Hiring"
    if any(k in t for k in ["launch", "introduc", "release", "announc", "beta", "preview"]):
        return "Product Launch"
    if any(k in t for k in ["migrat", "adopt", "built on", "stack", "tech", "framework", "open-source"]):
        return "Technology Change"
    if any(k in t for k in ["twitter", "x.com", "linkedin", "social", "community", "reddit"]):
        return "Social Mention"
    return "General"

def _newsapi(company: str) -> List[Dict[str, Any]]:
    api_key = os.getenv("NEWS_API_KEY")
    if not api_key:
        return []
    url = "https://newsapi.org/v2/everything"
    params = {
        "q": company,
        "language": "en",
        "sortBy": "publishedAt",
        "searchIn": "title,description",
        "pageSize": 20,
        "apiKey": api_key,
    }
    try:
        params["from"] = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")
    except Exception:
        pass
    qs = urllib.parse.urlencode(params)
    req = urllib.request.Request(f"{url}?{qs}")
    with urllib.request.urlopen(req, timeout=20) as res:
        data = json.loads(res.read().decode())
    out: List[Dict[str, Any]] = []
    for a in data.get("articles", []):
        title = a.get("title") or ""
        out.append({
            "type": classify(title),
            "title": title,
            "url": a.get("url"),
            "source": a.get("source", {}).get("name"),
            "published_at": a.get("publishedAt"),
        })
    return out

def _serper(company: str) -> List[Dict[str, Any]]:
    api_key = os.getenv("SERPER_API_KEY")
    if not api_key:
        return []
    url = "https://google.serper.dev/search"
    headers = {"X-API-KEY": api_key, "Content-Type": "application/json"}
    q = f'("{company}" OR intitle:{company}) (funding OR raises OR hires OR jobs OR launch OR release OR platform OR stack OR technology)'
    payload = json.dumps({"q": q, "num": 20}).encode()
    req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=20) as res:
        data = json.loads(res.read().decode())
    out: List[Dict[str, Any]] = []
    for item in (data.get("news", []) + data.get("organic", [])):
        title = item.get("title") or ""
        out.append({
            "type": classify(title),
            "title": title,
            "url": item.get("link"),
            "source": item.get("source") or item.get("domain"),
            "published_at": item.get("date"),
        })
    return out

def _serpapi(company: str) -> List[Dict[str, Any]]:
    api_key = os.getenv("SERPAPI_KEY")
    if not api_key:
        return []
    url = "https://serpapi.com/search.json"
    params = urllib.parse.urlencode({"q": f"{company}", "hl": "en", "num": 10, "api_key": api_key})
    req = urllib.request.Request(f"{url}?{params}")
    with urllib.request.urlopen(req, timeout=20) as res:
        data = json.loads(res.read().decode())
    out: List[Dict[str, Any]] = []
    for item in data.get("news_results", []):
        title = item.get("title") or ""
        out.append({
            "type": classify(title),
            "title": title,
            "url": item.get("link"),
            "source": item.get("source"),
            "published_at": item.get("date"),
        })
    return out

def harvest_signals(company: str) -> List[Dict[str, Any]]:
    signals: List[Dict[str, Any]] = []
    try:
        signals.extend(_newsapi(company))
    except Exception:
        pass
    try:
        s = _serper(company)
        signals.extend(s)
    except Exception:
        pass
    if not signals:
        try:
            signals.extend(_serpapi(company))
        except Exception:
            pass
    # De-duplicate by title
    seen = set()
    unique: List[Dict[str, Any]] = []
    for s in signals:
        t = s.get("title")
        if t and t not in seen:
            seen.add(t)
            unique.append(s)
    # relevance filter: prefer items that clearly reference the company
    company_l = company.lower()
    brand_domain = f"{company_l}.com"
    filtered: List[Dict[str, Any]] = []
    for s in unique:
        title = (s.get("title") or "").lower()
        source = (s.get("source") or "").lower()
        url = (s.get("url") or "").lower()
        host = ""
        try:
            host = (urlparse(url).hostname or "").lower()
        except Exception:
            pass
        score = 0
        # prefer explicit word match in title
        if company_l in title.split():
            score += 2
        # exact brand domain match (e.g. stripe.com or *.stripe.com)
        if host.endswith(brand_domain) or source.endswith(brand_domain):
            score += 1
        if s.get("type") in {"Funding", "Hiring", "Product Launch", "Technology Change"}:
            score += 1
        if score >= 2:
            filtered.append(s)
    final = filtered if filtered else unique
    final = filtered if filtered else unique
    return final[:20]

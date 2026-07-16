"""
app/server.py — Heccker-OS FastAPI Backend
Powered by Google ADK Runner (the real swarm).

The ADK runner in agent.py defines all 5 agents, their tools, and the
before_tool_hook / after_tool_hook security layer. This server wires
those agents to the web frontend via SSE streaming.

Key fix: pass a CLEAN message to ADK. Let the agents call their own tools.
Don't pre-stuff the message — that's what made the model return empty.
CONTEXT.md is injected as a system-level prefix only, kept short.
"""

import json
import os
import asyncio
from typing import AsyncGenerator
import certifi
import ssl
import aiohttp

# Fix 404 for Gemini ADK - removed invalid global location which breaks AI Studio

# Fix SSL Verification for requests and urllib on Windows
os.environ["SSL_CERT_FILE"] = certifi.where()
os.environ["REQUESTS_CA_BUNDLE"] = certifi.where()
ssl._create_default_https_context = ssl._create_unverified_context

import json
import subprocess
import urllib.request
import urllib.parse
from dotenv import load_dotenv
load_dotenv()

import httpx
import requests
import warnings
from urllib3.exceptions import InsecureRequestWarning
warnings.simplefilter('ignore', InsecureRequestWarning)

_original_requests_session_request = requests.Session.request
def _patched_requests_session_request(self, method, url, **kwargs):
    kwargs['verify'] = False
    return _original_requests_session_request(self, method, url, **kwargs)
requests.Session.request = _patched_requests_session_request

_original_httpx_client_init = httpx.Client.__init__
def _patched_httpx_client_init(self, *args, **kwargs):
    kwargs['verify'] = False
    _original_httpx_client_init(self, *args, **kwargs)
httpx.Client.__init__ = _patched_httpx_client_init

_original_httpx_async_client_init = httpx.AsyncClient.__init__
def _patched_httpx_async_client_init(self, *args, **kwargs):
    kwargs['verify'] = False
    _original_httpx_async_client_init(self, *args, **kwargs)
httpx.AsyncClient.__init__ = _patched_httpx_async_client_init

# Global Monkey-patch for aiohttp SSL Verification (used by google-genai async)
import aiohttp
_original_tcp_connector_init = aiohttp.TCPConnector.__init__
def _patched_tcp_connector_init(self, *args, **kwargs):
    kwargs['ssl'] = False
    _original_tcp_connector_init(self, *args, **kwargs)
aiohttp.TCPConnector.__init__ = _patched_tcp_connector_init

# Global Monkey-patch for google-genai Client (used by ADK internally)
import google.genai as genai_patch
_original_client_init = genai_patch.Client.__init__
def _patched_client_init(self, *args, **kwargs):
    if 'http_options' not in kwargs or not kwargs['http_options']:
        kwargs['http_options'] = {}
    
    if isinstance(kwargs['http_options'], dict):
        kwargs['http_options']['client_args'] = {'verify': False}
        kwargs['http_options']['async_client_args'] = {'verify': False}
    
    _original_client_init(self, *args, **kwargs)
genai_patch.Client.__init__ = _patched_client_init

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel

# ADK
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types as genai_types
from google import genai

# The real ADK swarm — all 5 agents + hooks
from app.agent import (
    heccker_agent as root_agent,
    detect_prompt_injection,
    add_to_cart,
    view_cart,
    clear_cart,
    add_todo_item,
    get_schedule,
    add_calendar_event,
    _CART_FILE,
)

# ── google.genai client (for wellbeing + search + fallback) ──────────────────
os.environ["GOOGLE_CLOUD_LOCATION"] = "us-central1"
api_key = os.environ.get("GEMINI_API_KEY")
_client = genai.Client(http_options={'client_args': {'verify': False}}) if api_key else None

# ── CONTEXT.md memory (Hikari-style) ─────────────────────────────────────────
def _load_context(user_id: str) -> str:
    """Load a SHORT summary from CONTEXT.md — keep it under 500 chars for ADK."""
    if user_id.lower() != "shalom":
        return ""
    try:
        from app.storage import load_text
        full = load_text("heccker_context", "user_context", "CONTEXT.md", "")
        if not full: return ""
        # Extract just the essential lines — not the whole file
        lines = [l.strip() for l in full.splitlines() if l.strip() and not l.startswith("#")]
        summary = " | ".join(lines[:8])  # first 8 key facts
        return summary[:500]
    except Exception:
        pass
    return ""

# ── Real token tracking (approximate) ────────────────────────────────────────
# gemini-2.0-flash: ~$0.10/1M input, ~$0.40/1M output
_session_tokens: dict[str, dict] = {}

def _track_tokens(session_id: str, inp: str, out: str) -> dict:
    if session_id not in _session_tokens:
        _session_tokens[session_id] = {"input": 0, "output": 0}
    _session_tokens[session_id]["input"]  += max(1, len(inp) // 4)
    _session_tokens[session_id]["output"] += max(1, len(out) // 4)
    i = _session_tokens[session_id]["input"]
    o = _session_tokens[session_id]["output"]
    cost = round((i / 1_000_000 * 0.10) + (o / 1_000_000 * 0.40), 5)
    return {"input_tokens": i, "output_tokens": o, "cost_usd": cost}

# ── ADK Runner ────────────────────────────────────────────────────────────────
_session_service = InMemorySessionService()
_runner = Runner(
    agent=root_agent,
    app_name="heccker",
    session_service=_session_service,
    auto_create_session=True,
)

# ── Autonomous Background Triggers ───────────────────────────────────────────
_autonomous_queue: dict[str, list] = {}   # keyed by user_id — each user gets their own queue
_last_active_time = 0

async def _generate_with_fallback(contents: str) -> str:
    """Helper to generate content with automatic model rotation for rate limits/404s."""
    if not _client: return ""
    for model_name in ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite-preview-02-05", "gemini-1.5-flash", "gemini-1.5-flash-8b"]:
        try:
            resp = await asyncio.to_thread(
                _client.models.generate_content,
                model=model_name,
                contents=contents
            )
            return resp.text or ""
        except Exception as e:
            is_quota = "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e) or "404" in str(e) or "NOT_FOUND" in str(e)
            if is_quota:
                print(f"[Rotator] {model_name} exhausted or missing. Falling back to next model...")
            else:
                print(f"[Rotator] Error with {model_name}: {e}")
                break
    return ""

async def _autonomous_loop():
    """Wakes up every 10 minutes to generate an autonomous message for the creator only."""
    global _last_active_time
    import time
    _last_active_time = time.time()
    while True:
        await asyncio.sleep(600)  # 10 mins
        
        # Only trigger if inactive for at least 1 hour (3600 seconds)
        if time.time() - _last_active_time < 3600:
            continue
            
        if _client:
            try:
                context = _load_context("shalom")
                prompt = (
                    f"You are Heccker, the user's autonomous AI Orchestrator and bestie.\n"
                    f"Context: {context[:300] if context else 'Developer.'}\n\n"
                    f"Write a short, warm, proactive message checking up on the user. "
                    f"CRITICAL: DO NOT hallucinate fake emails, unread messages, or meetings. "
                    f"Just say something super friendly, check in on how their day is going, remind them to drink water or grab a snack if it's late, or offer to help. Keep it under 2 sentences. Sound natural and affectionate. Use words like bestie. No formatting."
                )
                text = await asyncio.wait_for(_generate_with_fallback(prompt), timeout=15.0)
                if text:
                    # Replace the queue rather than appending — this keeps at most
                    # ONE pending check-in so the user never gets spammed with
                    # stacked messages on next page load.
                    _autonomous_queue["shalom"] = [text.replace("**","").replace("*","")]
                    _last_active_time = time.time()
            except Exception as e:
                print("Autonomous loop error:", e)

# ── FastAPI ───────────────────────────────────────────────────────────────────
app = FastAPI(title="Heccker-OS API", version="5.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Models ────────────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []
    session_id: str = "default"
    user_id: str = "shalom"
    local_time: str = ""
    workspace_connect: bool = False
    access_token: str = ""

class CartItem(BaseModel):
    item_name: str
    price: str
    source_url: str
    image_url: str = ""

class CalendarEvent(BaseModel):
    title: str
    date_time: str

class TodoItem(BaseModel):
    task: str

class WellbeingRequest(BaseModel):
    moment: str
    local_time: str
    context: str = ""
    persona: str = "guest"

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(_autonomous_loop())

@app.get("/api/autonomous/poll")
def poll_autonomous(user_id: str = "guest"):
    uid = "".join(c for c in user_id if c.isalnum() or c in "-_") or "guest"
    queue = _autonomous_queue.get(uid, [])
    if queue:
        return {"message": _autonomous_queue[uid].pop(0)}
    return {"message": None}


# ── Email unread count (for Service Worker background polling) ────────────────
@app.get("/api/email/unread_count")
async def email_unread_count():
    """Returns the number of unread emails. Runs IMAP in a thread to avoid blocking the event loop."""
    import imaplib, asyncio
    user = os.environ.get("CLOUD_ID_EMAIL")
    password = os.environ.get("CLOUD_ID_APP_PASSWORD")
    if not user or not password:
        return {"count": 0, "error": "credentials_missing"}

    def _fetch():
        try:
            mail = imaplib.IMAP4_SSL("imap.gmail.com", timeout=10)
            mail.login(user, password)
            mail.select("inbox", readonly=True)
            status, data = mail.search(None, "UNSEEN")
            mail.logout()
            if status != "OK":
                return {"count": 0}
            return {"count": len(data[0].split())}
        except Exception as e:
            return {"count": 0, "error": str(e)[:80]}

    try:
        return await asyncio.wait_for(
            asyncio.get_event_loop().run_in_executor(None, _fetch),
            timeout=15
        )
    except asyncio.TimeoutError:
        return {"count": 0, "error": "timeout"}


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "service": "heccker-os", "engine": "adk-runner"}


# ── ADK SSE stream ────────────────────────────────────────────────────────────
async def _stream_adk(message: str, history: list, session_id: str, user_id: str, local_time: str = "") -> AsyncGenerator[str, None]:
    """
    Pass the message to the real ADK swarm. Agents call their own tools.
    Use a unique session per request to prevent state corruption.
    On ADK empty-output error, retry once then fall back to direct genai.
    """

    # 1. Fast security gate before ADK startup
    injection = detect_prompt_injection(message)
    if "SECURITY ALERT" in injection:
        yield f"data: {json.dumps({'type':'security_block','content':injection})}\n\n"
        yield "data: [DONE]\n\n"
        return

    yield f"data: {json.dumps({'type':'agent_action','agent':'security_agent','status':'cleared','detail':'No injection detected.'})}\n\n"
    await asyncio.sleep(0.01)

    # Generate session title if it is a new chat (no history)
    if not history and _client:
        try:
            text = await _generate_with_fallback(f"Summarize the user's intent in exactly 2-4 words. Do not use punctuation. User: {message}")
            if text:
                clean_title = text.strip().replace('"', '')
                yield f"data: {json.dumps({'type':'session_title','title':clean_title})}\n\n"
        except Exception as e:
            print(f"Title generation error: {e}")

    # 2. Build a CLEAN, FOCUSED message — no massive blobs
    context = _load_context(user_id)
    context_line = f"[Context: {context}]\n" if context else ""
    
    # Render servers wipe local ADK memory on restart. Pass the last 4 messages of history to guarantee context survival.
    recent_history = ""
    if history:
        recent_history = "[Recent Conversation Context]\n"
        for h in history[-4:]:
            role = h.get('role', 'user')
            parts = h.get('parts', [{}])
            text = parts[0].get('text', '') if parts else ''
            recent_history += f"{'Heccker' if role == 'agent' else 'User'}: {text}\n"
        recent_history += "\n"

    persona_line = f"[User Identity: {'Shalom (Creator/Admin)' if user_id.lower() == 'shalom' else f'Guest (Name: {user_id.title()})'}]\n"
    time_line = f"SYSTEM FACT - The exact current local date and time is: {local_time}\n" if local_time else ""
    
    clean_message = time_line + persona_line + context_line + recent_history + message  # short prefix only

    # 3. Use real session ID so ADK retains conversation history
    unique_session = session_id

    new_message = genai_types.Content(
        role="user",
        parts=[genai_types.Part(text=clean_message)]
    )

    streamed_text = ""
    final_text = ""

    # Inject user_id so cart/todo tools read the correct per-user Firestore path
    try:
        from app import agent as _agent_mod
        _agent_mod._current_user_id = user_id
    except Exception:
        pass

    async def _run_adk():
        nonlocal final_text, streamed_text
        try:
            async for event in _runner.run_async(
                user_id=user_id,
                session_id=unique_session,
                new_message=new_message,
            ):
                # Tool call events and internal thoughts — stream as they fire
                if not event.is_final_response() and hasattr(event, 'author') and event.author:
                    if event.content and event.content.parts:
                        for part in event.content.parts:
                            # 1. Stream intermediate text (Heccker's thoughts/filler)
                            if hasattr(part, 'text') and part.text:
                                chunk = part.text + "\n\n"
                                final_text += chunk
                                streamed_text += chunk
                                yield f"data: {json.dumps({'content': chunk})}\n\n"
    
                            # 2. Stream tool execution bubble
                            if hasattr(part, 'function_call') and part.function_call:
                                fn = part.function_call
    
                                if fn.name == "lock_screen":
                                    args = dict(fn.args) if fn.args else {}
                                    yield f"data: {json.dumps({'type': 'system_lock', 'reason': args.get('reason', 'stress')})}\n\n"
                                    
                                if fn.name == "set_timer":
                                    args = dict(fn.args) if fn.args else {}
                                    yield f"data: {json.dumps({'type': 'set_timer', 'minutes': args.get('minutes', '05'), 'seconds': args.get('seconds', '00')})}\n\n"
                                
                                agent_name = getattr(event.author, 'name', str(event.author)) if event.author else 'system'
                                args_str = ", ".join([f"{k}: {v}" for k, v in dict(fn.args).items()]) if fn.args else "no arguments"
                                yield f"data: {json.dumps({'type':'agent_action','agent':agent_name,'tool':fn.name,'status':'executing','detail': f'Executing with {args_str}'})}\n\n"
                                if fn.name == "add_to_cart":
                                    args = dict(fn.args) if fn.args else {}
                                    yield f"data: {json.dumps({'type':'cart_add','item':args.get('item_name',''),'price':args.get('price',''),'url':args.get('source_url','')})}\n\n"
                                elif fn.name == "add_calendar_event":
                                    args = dict(fn.args) if fn.args else {}
                                    yield f"data: {json.dumps({'type':'calendar_add','title':args.get('title',''),'date_time':args.get('date_time','')})}\n\n"
                                elif fn.name == "add_todo_item":
                                    args = dict(fn.args) if fn.args else {}
                                    yield f"data: {json.dumps({'type':'todo_add','task':args.get('task','')})}\n\n"
                                elif fn.name == "launch_application":
                                    args = dict(fn.args) if fn.args else {}
                                    yield f"data: {json.dumps({'type':'launch_app','app':args.get('app_name','')})}\n\n"
    
                            # 3. Stream tool completion
                            if hasattr(part, 'function_response') and part.function_response:
                                fn_resp = part.function_response
                                agent_name = getattr(event.author, 'name', str(event.author)) if event.author else 'system'
                                try:
                                    resp_data = dict(fn_resp.response) if hasattr(fn_resp, 'response') and fn_resp.response else {}
                                    result_str = str(resp_data.get('result', resp_data)) if resp_data else f"{fn_resp.name} completed"
                                    if len(result_str) > 1000: result_str = result_str[:997] + "..."
                                except Exception:
                                    result_str = f"{fn_resp.name} completed"
                                yield f"data: {json.dumps({'type':'agent_action','agent':agent_name,'tool':fn_resp.name,'status':'cleared','detail':result_str})}\n\n"
                                if fn_resp.name == "write_workspace_file" and result_str.startswith("Success:"):
                                    import re
                                    path_match = re.search(r"Success: Content written to '([^']+)'", result_str)
                                    if path_match:
                                        full = path_match.group(1).replace("\\", "/")
                                        rel = os.path.basename(full)
                                        yield f"data: {json.dumps({'type':'artifact_add','path':rel})}\n\n"
    
                # Final response
                if event.is_final_response():
                    if event.content and event.content.parts:
                        for part in event.content.parts:
                            if hasattr(part, 'text') and part.text:
                                final_text += part.text

        except Exception as e:
            err_msg = f"\n\n**[System Error: ADK Loop Crashed]** {str(e)}\n"
            final_text += err_msg
            yield f"data: {json.dumps({'content': err_msg})}\n\n"

    # 4. Run ADK — collect SSE events, handle empty-output gracefully
    max_retries = 3
    for attempt in range(max_retries):
        try:
            async for sse in _run_adk():
                yield sse
            break # Success
        except Exception as e:
            err = str(e)
            print(f"ADK error (attempt {attempt+1}): {err}")
            if attempt < max_retries - 1:
                yield f"data: {json.dumps({'type':'agent_action','agent':'root_agent','status':'executing','detail':f'Network error, recovering...'})}\n\n"
                await asyncio.sleep(2)
                continue
            
            # Known ADK empty-output error — fall back to direct genai
            if not final_text:
                pass  # fall through to fallback below
            else:
                yield f"data: {json.dumps({'type':'error','content':err[:100]})}\n\n"
                yield "data: [DONE]\n\n"
                return

    # 5. Fallback if ADK returned nothing
    if not final_text and _client:
        print("ADK empty -> direct genai fallback")
        yield f"data: {json.dumps({'type':'agent_action','agent':'root_agent','status':'cleared','detail':'Responding directly (ADK fallback).'})}\n\n"
        try:
            text = await asyncio.wait_for(_generate_with_fallback(clean_message), timeout=25.0)
            final_text = text or ""
        except Exception as fe:
            print(f"Fallback error: {fe}")
            yield f"data: {json.dumps({'type':'text','content':'Heccker is offline — try again in a moment.'})}\n\n"
            yield "data: [DONE]\n\n"
            return

    # 6. Stream final text + real token update
    if final_text:
        token_info = _track_tokens(session_id, clean_message, final_text)
        
        new_text = final_text[len(streamed_text):]
        if new_text:
            clean = new_text.replace("**","").replace("### ","").replace("## ","")
            yield f"data: {json.dumps({'type':'text','content':clean})}\n\n"
                
        yield f"data: {json.dumps({'type':'token_update',**token_info})}\n\n"
    else:
        yield f"data: {json.dumps({'type':'text','content':'Heccker is offline. Send a message.'})}\n\n"

    yield "data: [DONE]\n\n"


@app.post("/api/chat")
async def chat(req: ChatRequest):
    global _last_active_time
    import time
    _last_active_time = time.time()
    
    # Inject flags for agent tools to read during this request
    os.environ["WORKSPACE_CONNECT"] = str(req.workspace_connect)
    os.environ["GOOGLE_ACCESS_TOKEN"] = req.access_token or ""

    return StreamingResponse(
        _stream_adk(req.message, req.history, req.session_id, req.user_id, req.local_time),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── Real product search ───────────────────────────────────────────────────────
async def _search_products(query: str) -> list[dict]:
    if not _client:
        return []
    for model_id in ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite-preview-02-05", "gemini-1.5-flash", "gemini-1.5-flash-8b"]:
        try:
            resp = await asyncio.wait_for(
                asyncio.to_thread(
                    _client.models.generate_content,
                    model=model_id,
                    contents=f"Search Google Shopping for: {query}. The user is located in Owerri, Nigeria. Prioritize stores that ship to Nigeria. Return prices in USD. Return top 3 as JSON array: name, price, url (real store URL), store, image_url. ONLY the JSON array.",
                    config=genai_types.GenerateContentConfig(
                        tools=[genai_types.Tool(google_search=genai_types.GoogleSearch())]
                    ),
                ),
                timeout=15.0,
            )
            raw = resp.text.strip().replace("```json","").replace("```","").strip()
            s, e = raw.find("["), raw.rfind("]") + 1
            if s >= 0 and e > s:
                results = json.loads(raw[s:e])
                if isinstance(results, list) and results:
                    return results
        except Exception as ex:
            print(f"Search [{model_id}]: {ex}")
    return []


@app.get("/api/shop/search")
async def shop_search(query: str):
    return {"results": await _search_products(query)}


# ── Cart ──────────────────────────────────────────────────────────────────────
@app.get("/api/cart")
def get_cart():
    cart = []
    if os.path.exists(_CART_FILE):
        with open(_CART_FILE) as f:
            cart = json.load(f)
    return {"items": cart}

@app.post("/api/cart")
def post_cart(item: CartItem):
    return {"message": add_to_cart(item.item_name, item.price, item.source_url, item.image_url)}

@app.delete("/api/cart")
def delete_cart():
    return {"message": clear_cart()}


# ── Calendar ──────────────────────────────────────────────────────────────────
@app.get("/api/calendar")
def get_calendar(access_token: str = None):
    from app.calendar_sync import fetch_all_events
    events = fetch_all_events(access_token=access_token)
    return {"events": events}

@app.post("/api/calendar")
def post_calendar(event: CalendarEvent):
    return {"message": add_calendar_event(event.title, event.date_time)}


# ── Todos ─────────────────────────────────────────────────────────────────────
@app.get("/api/todos")
def get_todos():
    from app.storage import load_json
    todos = load_json("heccker_todos", "user_todos", "todo.json", [])
    return {"todos": todos}

@app.post("/api/todos")
def post_todo(item: TodoItem):
    return {"message": add_todo_item(item.task)}


# ── Logs ──────────────────────────────────────────────────────────────────────
class LogEntry(BaseModel):
    tag: str
    msg: str
    time: str
    id: str
    user_id: str = "guest"

@app.get("/api/logs")
def get_logs(user_id: str = "guest"):
    from app.storage import load_json
    # Sanitize user_id to prevent directory traversal
    uid = "".join(c for c in user_id if c.isalnum() or c in "-_") or "guest"
    logs = load_json("heccker_logs", f"logs_{uid}", f"{uid}_logs.json", [])
    return {"logs": logs}

@app.post("/api/logs")
def post_log(entry: LogEntry):
    from app.storage import load_json, save_json
    uid = "".join(c for c in entry.user_id if c.isalnum() or c in "-_") or "guest"
    logs = load_json("heccker_logs", f"logs_{uid}", f"{uid}_logs.json", [])
    logs.insert(0, entry.model_dump())
    logs = logs[:100]  # Keep only latest 100
    save_json("heccker_logs", f"logs_{uid}", logs, f"{uid}_logs.json")
    return {"status": "ok"}

# ── Cloud Sync State ────────────────────────────────────────────────────────
@app.get("/api/state/{key}")
def get_state(key: str, user_id: str = "guest"):
    from app.storage import load_json
    uid = "".join(c for c in user_id if c.isalnum() or c in "-_") or "guest"
    safe_key = "".join(c for c in key if c.isalnum() or c in "-_")
    data = load_json("heccker_state", f"{uid}_{safe_key}", f"{uid}_{safe_key}.json", None)
    return {"data": data}

@app.post("/api/state/{key}")
def post_state(key: str, payload: dict, user_id: str = "guest"):
    from app.storage import save_json
    uid = "".join(c for c in user_id if c.isalnum() or c in "-_") or "guest"
    safe_key = "".join(c for c in key if c.isalnum() or c in "-_")
    data = payload.get("data")
    save_json("heccker_state", f"{uid}_{safe_key}", data, f"{uid}_{safe_key}.json")

    return {"status": "ok"}


# ── Artifacts ─────────────────────────────────────────────────────────────────

def _artifact_basename(path: str) -> str:
    """Always use filename only — avoids Windows absolute paths breaking on Render."""
    if not path:
        return ""
    normalized = path.replace("\\", "/").strip()
    return os.path.basename(normalized)


def _resolve_artifact_path(path: str) -> str:
    """Resolve artifact to ~/Downloads/<filename> on the server."""
    name = _artifact_basename(path)
    if not name:
        return ""
    return os.path.join(os.path.expanduser("~/Downloads"), name)


def _restore_artifact_from_firebase(name: str, local_path: str) -> bool:
    """Try to restore a missing artifact from Firestore. Returns True if restored."""
    try:
        import base64
        from app.storage import load_json
        doc = load_json("heccker_artifact_files", name, "", None)
        if not doc or "data" not in doc:
            return False
        os.makedirs(os.path.dirname(local_path) or ".", exist_ok=True)
        if doc.get("encoding") == "base64":
            with open(local_path, "wb") as f:
                f.write(base64.b64decode(doc["data"]))
        else:
            with open(local_path, "w", encoding="utf-8") as f:
                f.write(doc["data"])
        return os.path.exists(local_path)
    except Exception:
        return False


@app.get("/api/download_artifact")
def download_artifact(path: str):
    safe_path = _resolve_artifact_path(path)
    if safe_path and not os.path.exists(safe_path):
        _restore_artifact_from_firebase(_artifact_basename(path), safe_path)
    if not safe_path or not os.path.exists(safe_path):
        raise HTTPException(status_code=404, detail="File not found on server — regenerate the document.")
    if os.path.getsize(safe_path) == 0:
        raise HTTPException(status_code=404, detail="File is empty")
    ext = os.path.splitext(safe_path)[1].lower()
    media_types = {
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".pdf": "application/pdf",
        ".csv": "text/csv",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
    }
    return FileResponse(
        safe_path,
        filename=os.path.basename(safe_path),
        media_type=media_types.get(ext, "application/octet-stream"),
    )


@app.get("/api/artifact")
def get_artifact(path: str):
    try:
        safe_path = _resolve_artifact_path(path)

        if safe_path and not os.path.exists(safe_path):
            _restore_artifact_from_firebase(_artifact_basename(path), safe_path)

        if not safe_path or not os.path.exists(safe_path):
            return {"content": "File not found on server."}

        if safe_path.lower().endswith(".pptx"):
            try:
                from app.file_builder import extract_pptx_slides
                import json
                return {"content": json.dumps(extract_pptx_slides(safe_path))}
            except Exception as e:
                return {"content": f"Error reading PPTX: {e}"}

        if safe_path.endswith((".docx", ".xlsx", ".pdf", ".png", ".jpg", ".zip", ".jar")):
            return {"content": "# Binary File\n\nUse the preview panel or download button."}
        with open(safe_path, "r", encoding="utf-8", errors="replace") as f:
            return {"content": f.read()}
    except Exception as e:
        return {"content": f"Error: {str(e)}"}


def _get_client_ip(request: Request) -> str:
    """Get real client IP, respecting X-Forwarded-For from Render/proxies."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@app.get("/api/check_user")
def check_user(name: str, request: Request):
    """Check if a username exists and whether this IP owns it.
    Returns: taken=False (new), taken=True + yours=True (returning), taken=True + yours=False (stolen)."""
    uid = "".join(c for c in name if c.isalnum() or c in "-_").lower()
    if not uid:
        return {"taken": False, "yours": False}
    ip = _get_client_ip(request)
    from storage import init_firebase
    db = init_firebase()
    if db:
        try:
            doc = db.collection("users").document(uid).get()
            if not doc.exists:
                return {"taken": False, "yours": False}
            owner_ip = doc.to_dict().get("ip", "")
            return {"taken": True, "yours": owner_ip == ip}
        except Exception as e:
            print(f"Firestore check_user error: {e}")
    # Fallback: local file check (no IP verification possible)
    path = os.path.join("heccker_logs", "users", f"{uid}_logs.json")
    mem_path = os.path.join(os.getcwd(), f"memory_{uid}.md")
    taken = os.path.exists(path) or os.path.exists(mem_path)
    return {"taken": taken, "yours": taken}  # assume yours on fallback


@app.post("/api/register_user")
def register_user(payload: dict, request: Request):
    """Register a new username in Firestore, bound to the caller's IP."""
    name = payload.get("name", "").strip()
    uid = "".join(c for c in name if c.isalnum() or c in "-_").lower()
    if not uid:
        return {"ok": False, "error": "Invalid name"}
    ip = _get_client_ip(request)
    from storage import init_firebase
    import time
    db = init_firebase()
    if db:
        try:
            ref = db.collection("users").document(uid)
            if not ref.get().exists:
                ref.set({"name": name, "ip": ip, "created_at": int(time.time())})
            return {"ok": True}
        except Exception as e:
            print(f"Firestore register_user error: {e}")
            return {"ok": False, "error": str(e)}
    return {"ok": False, "error": "Firebase unavailable"}

# ── Security ──────────────────────────────────────────────────────────────────
@app.post("/api/security/check")
def security_check(payload: dict):
    text = payload.get("text", "")
    result = detect_prompt_injection(text)
    return {"result": result, "safe": "SECURITY ALERT" not in result}


# ── Wellbeing (LLM-generated, context-aware) ──────────────────────────────────
@app.post("/api/wellbeing/suggest")
async def wellbeing_suggest(req: WellbeingRequest):
    if not _client:
        return {"suggestion": f"Time for your {req.moment}, {req.persona}."}
    
    if req.persona.lower() == "shalom":
        context_str = _load_context("shalom")
        persona_context = f"Shalom context: {context_str[:300] if context_str else 'Developer, prone to hyperfocus.'}\n"
    else:
        persona_context = f"Context: This is a guest named {req.persona}. Use general human intuition and life patterns for healthy routines.\n"

    prompt = (
        f"You are Heccker, {req.persona}'s autonomous AI assistant and Orchestrator.\n"
        f"Time: {req.local_time}. Moment: {req.moment}.\n"
        f"{persona_context}\n"
        f"Write ONE warm nudge (max 2 sentences):\n"
        f"- breakfast/lunch/dinner: suggest a specific meal.\n"
        f"- stretch: suggest a 2-minute exercise.\n"
        f"- evening/hard_stop: firmly encourage stopping.\n"
        f"No markdown, no asterisks. Just the message."
    )
    for model_id in ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite-preview-02-05", "gemini-1.5-flash", "gemini-1.5-flash-8b"]:
        try:
            resp = await asyncio.wait_for(
                asyncio.to_thread(_client.models.generate_content, model=model_id, contents=prompt),
                timeout=12.0
            )
            return {"suggestion": resp.text.strip().replace("**","").replace("*","").replace("##","")}
        except Exception as e:
            print(f"Wellbeing [{model_id}]: {e}")
    return {"suggestion": f"Hey Shalom — {req.moment} time. Step away and recharge."}


# ── Dynamic Suggestions (LLM-generated) ───────────────────────────────────────
@app.get("/api/suggestions")
async def get_suggestions():
    if not _client:
        return {"suggestions": []}

    context = _load_context("shalom")
    prompt = (
        f"You are Athena, an autonomous AI assistant Orchestrator for Shalom.\n"
        f"Context about Shalom:\n{context[:400] if context else 'Developer.'}\n\n"
        f"Generate 4 diverse, highly contextual, and deeply useful prompts Shalom could ask you right now to speed up their work or manage their life.\n"
        f"Since you are a swarm of autonomous agents, you can do almost anything — from coding, to researching, to system ops, to life management.\n"
        f"Return ONLY a JSON array of 4 objects with fields: 'text' (the prompt), and 'tag' (a single descriptive word for the icon, e.g., 'code', 'research', 'system', 'life', 'shopping', 'security')."
    )

    for model_id in ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite-preview-02-05", "gemini-1.5-flash", "gemini-1.5-flash-8b"]:
        try:
            resp = await asyncio.wait_for(
                asyncio.to_thread(_client.models.generate_content, model=model_id, contents=prompt),
                timeout=15.0
            )
            raw = resp.text.strip().replace("```json", "").replace("```", "").strip()
            s, e = raw.find("["), raw.rfind("]") + 1
            if s >= 0 and e > s:
                data = json.loads(raw[s:e])
                if isinstance(data, list) and len(data) > 0:
                    return {"suggestions": data}
        except Exception as ex:
            print(f"Suggestions [{model_id}]: {ex}")
    
    return {"suggestions": []}

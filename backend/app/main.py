from __future__ import annotations

import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .config import Settings, settings
from .names import normalize_local_part, random_local_part, validate_local_part
from .security import SlidingWindowLimiter, client_ip, hash_ip, hash_token, new_token, token_matches
from .store import AddressTaken, MemoryStore, Store, SupabaseStore

UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
DEV_MODE = os.getenv("DEV_MODE") == "1"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def as_dt(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


def snippet(text: str | None, n: int = 140) -> str:
    if not text:
        return ""
    flat = re.sub(r"\s+", " ", text).strip()
    return flat[:n] + ("…" if len(flat) > n else "")


# ------------------------------------------------------------------ schemas
class CreateInbox(BaseModel):
    username: str | None = Field(default=None, max_length=40)
    domain: str | None = Field(default=None, max_length=100)
    ttl_minutes: int | None = None


class ExtendInbox(BaseModel):
    ttl_minutes: int


def create_app(store: Store | None = None, cfg: Settings = settings) -> FastAPI:
    if store is None:
        if cfg.supabase_url and cfg.supabase_service_key:
            store = SupabaseStore(cfg.supabase_url, cfg.supabase_service_key)
        elif DEV_MODE:
            store = MemoryStore(["wpbmail.test"])
        else:
            raise RuntimeError("Set SUPABASE_URL and SUPABASE_SERVICE_KEY (or DEV_MODE=1 for local testing).")
    if not cfg.ip_salt and not DEV_MODE and isinstance(store, SupabaseStore):
        raise RuntimeError("Set IP_SALT to a long random string.")

    app = FastAPI(title="WinPlayBox Temp Mail API", version="1.0.0", docs_url="/api/docs", openapi_url="/api/openapi.json")
    app.state.store = store
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cfg.allowed_origins,
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["Content-Type", "X-Inbox-Token"],
        max_age=86400,
    )

    create_limiter = SlidingWindowLimiter(cfg.create_per_hour, 3600)
    read_limiter = SlidingWindowLimiter(cfg.reads_per_minute, 60)

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Cache-Control"] = "no-store"
        return response

    def get_store() -> Store:
        return app.state.store

    def ip_key(request: Request) -> str:
        return hash_ip(client_ip(request), cfg.ip_salt or "dev")

    def limit_reads(request: Request) -> None:
        if not read_limiter.allow(ip_key(request)):
            raise HTTPException(429, "Too many requests. Wait a minute and try again.")

    async def authorized_inbox(
        inbox_id: str,
        x_inbox_token: str | None = Header(default=None),
        db: Store = Depends(get_store),
    ) -> dict:
        if not UUID_RE.match(inbox_id):
            raise HTTPException(404, "Inbox not found.")
        inbox = await db.get_inbox(inbox_id)
        if not inbox or not token_matches(x_inbox_token, inbox["token_hash"]):
            raise HTTPException(404, "Inbox not found.")
        if as_dt(inbox["expires_at"]) < utcnow():
            raise HTTPException(410, "This address has expired. Create a new one.")
        return inbox

    def inbox_public(inbox: dict, token: str | None = None) -> dict:
        out = {
            "id": inbox["id"],
            "address": inbox.get("address") or f"{inbox['local_part']}@{inbox['domain']}",
            "domain": inbox["domain"],
            "is_custom": inbox.get("is_custom", False),
            "created_at": as_dt(inbox["created_at"]).isoformat(),
            "expires_at": as_dt(inbox["expires_at"]).isoformat(),
        }
        if token:
            out["token"] = token
        return out

    # -------------------------------------------------------------- routes
    @app.get("/api/health")
    async def health():
        return {"ok": True, "time": utcnow().isoformat()}

    @app.get("/api/domains")
    async def domains(db: Store = Depends(get_store)):
        rows = await db.list_domains()
        return {"domains": [r["domain"] for r in rows], "ttl_choices": list(cfg.ttl_choices), "default_ttl": cfg.default_ttl}

    @app.post("/api/inboxes", status_code=201)
    async def create_inbox(body: CreateInbox, request: Request, db: Store = Depends(get_store)):
        key = ip_key(request)
        if not create_limiter.allow(key):
            raise HTTPException(429, "You created a lot of addresses. Try again in an hour.")
        if await db.count_recent_creates(key, utcnow() - timedelta(hours=1)) >= cfg.create_per_hour:
            raise HTTPException(429, "You created a lot of addresses. Try again in an hour.")

        domain_rows = await db.list_domains()
        available = [r["domain"] for r in domain_rows]
        if not available:
            raise HTTPException(503, "No email domain is configured yet.")
        domain = (body.domain or "").lower() or next((r["domain"] for r in domain_rows if r.get("is_default")), available[0])
        if domain not in available:
            raise HTTPException(400, "That domain isn't available. Pick one from the list.")

        ttl = body.ttl_minutes or cfg.default_ttl
        if ttl not in cfg.ttl_choices:
            raise HTTPException(400, f"Pick a lifetime from {list(cfg.ttl_choices)} minutes.")

        is_custom = bool(body.username)
        if is_custom:
            local = normalize_local_part(body.username or "")
            err = validate_local_part(local)
            if err:
                raise HTTPException(400, err)
        else:
            local = random_local_part()

        token = new_token()
        for attempt in range(5):
            try:
                inbox = await db.insert_inbox(
                    {
                        "local_part": local,
                        "domain": domain,
                        "token_hash": hash_token(token),
                        "is_custom": is_custom,
                        "ip_hash": key,
                        "expires_at": (utcnow() + timedelta(minutes=ttl)).isoformat(),
                    }
                )
                return inbox_public(inbox, token)
            except AddressTaken:
                if is_custom:
                    raise HTTPException(409, "This address is already in use. Try a different name.")
                local = f"{random_local_part()}{secrets.randbelow(10)}"
        raise HTTPException(503, "Couldn't create an address. Try again.")

    @app.get("/api/inboxes/{inbox_id}", dependencies=[Depends(limit_reads)])
    async def get_inbox(inbox: dict = Depends(authorized_inbox)):
        return inbox_public(inbox)

    @app.post("/api/inboxes/{inbox_id}/extend")
    async def extend_inbox(body: ExtendInbox, inbox: dict = Depends(authorized_inbox), db: Store = Depends(get_store)):
        if body.ttl_minutes not in cfg.ttl_choices:
            raise HTTPException(400, f"Pick a lifetime from {list(cfg.ttl_choices)} minutes.")
        cap = as_dt(inbox["created_at"]) + timedelta(minutes=cfg.max_lifetime_minutes)
        new_exp = min(max(as_dt(inbox["expires_at"]), utcnow()) + timedelta(minutes=body.ttl_minutes), cap)
        await db.update_inbox(inbox["id"], {"expires_at": new_exp.isoformat()})
        return inbox_public({**inbox, "expires_at": new_exp})

    @app.delete("/api/inboxes/{inbox_id}", status_code=204)
    async def delete_inbox(inbox: dict = Depends(authorized_inbox), db: Store = Depends(get_store)):
        paths = await db.attachment_paths_for_inbox(inbox["id"])
        if paths:
            await db.delete_objects(paths)
        await db.delete_inbox(inbox["id"])

    @app.get("/api/inboxes/{inbox_id}/messages", dependencies=[Depends(limit_reads)])
    async def list_messages(inbox: dict = Depends(authorized_inbox), db: Store = Depends(get_store)):
        rows = await db.list_messages(inbox["id"])
        return {
            "messages": [
                {
                    "id": m["id"],
                    "from_address": m.get("from_address"),
                    "from_name": m.get("from_name"),
                    "subject": m.get("subject") or "(no subject)",
                    "preview": snippet(m.get("text_body")),
                    "otp": m.get("otp"),
                    "has_attachments": m.get("has_attachments", False),
                    "received_at": as_dt(m["received_at"]).isoformat(),
                    "read": m.get("read_at") is not None,
                }
                for m in rows
            ],
            "expires_at": as_dt(inbox["expires_at"]).isoformat(),
        }

    @app.get("/api/inboxes/{inbox_id}/messages/{message_id}", dependencies=[Depends(limit_reads)])
    async def get_message(message_id: str, inbox: dict = Depends(authorized_inbox), db: Store = Depends(get_store)):
        if not UUID_RE.match(message_id):
            raise HTTPException(404, "Message not found.")
        m = await db.get_message(inbox["id"], message_id)
        if not m:
            raise HTTPException(404, "Message not found.")
        if not m.get("read_at"):
            await db.update_message(message_id, {"read_at": utcnow().isoformat()})
        attachments = await db.list_attachments(message_id) if m.get("has_attachments") else []
        return {
            "id": m["id"],
            "from_address": m.get("from_address"),
            "from_name": m.get("from_name"),
            "subject": m.get("subject") or "(no subject)",
            "text": m.get("text_body"),
            "html": m.get("html_body"),
            "otp": m.get("otp"),
            "size_bytes": m.get("size_bytes", 0),
            "received_at": as_dt(m["received_at"]).isoformat(),
            "attachments": attachments,
        }

    @app.delete("/api/inboxes/{inbox_id}/messages/{message_id}", status_code=204)
    async def delete_message(message_id: str, inbox: dict = Depends(authorized_inbox), db: Store = Depends(get_store)):
        if not UUID_RE.match(message_id):
            raise HTTPException(404, "Message not found.")
        paths = await db.attachment_paths_for_message(message_id)
        if paths:
            await db.delete_objects(paths)
        await db.delete_message(inbox["id"], message_id)

    @app.get("/api/inboxes/{inbox_id}/attachments/{attachment_id}", dependencies=[Depends(limit_reads)])
    async def attachment_url(attachment_id: str, inbox: dict = Depends(authorized_inbox), db: Store = Depends(get_store)):
        if not UUID_RE.match(attachment_id):
            raise HTTPException(404, "Attachment not found.")
        att = await db.get_attachment(inbox["id"], attachment_id)
        if not att:
            raise HTTPException(404, "Attachment not found.")
        return {"url": await db.sign_attachment(att["storage_path"], att["filename"])}

    # -------------------------------------------------------------- internal (GitHub Actions cron)
    @app.post("/internal/cleanup")
    async def cleanup(x_cron_secret: str | None = Header(default=None), db: Store = Depends(get_store)):
        if not cfg.cron_secret or not x_cron_secret or not secrets.compare_digest(x_cron_secret, cfg.cron_secret):
            raise HTTPException(404)
        removed = 0
        for inbox_id in await db.expired_inbox_ids():
            paths = await db.attachment_paths_for_inbox(inbox_id)
            if paths:
                await db.delete_objects(paths)
            await db.delete_inbox(inbox_id)
            removed += 1
        return {"removed": removed, "stats": await db.stats()}

    # -------------------------------------------------------------- local dev helper
    if DEV_MODE and isinstance(store, MemoryStore):

        @app.post("/api/dev/inboxes/{inbox_id}/simulate")
        async def simulate(inbox: dict = Depends(authorized_inbox)):
            code = f"{secrets.randbelow(900000) + 100000}"
            row = store.add_message(
                inbox["id"],
                from_address="no-reply@instagram.com",
                from_name="Instagram",
                subject=f"{code} is your Instagram code",
                text_body=f"Hi,\n\nSomeone tried to sign up for an Instagram account with {inbox['address']}. "
                f"If it was you, enter this confirmation code in the app:\n\n{code}\n\nThanks,\nThe Instagram team",
                html_body=f"<div style='font-family:Arial;padding:24px'><h2>Confirm your email</h2>"
                f"<p>Enter this confirmation code in the app:</p><p style='font-size:28px;letter-spacing:4px'><b>{code}</b></p>"
                f"<img src='https://example.com/pixel.gif' width='1' height='1'></div>",
                otp=code,
            )
            return {"id": row["id"]}

    @app.exception_handler(HTTPException)
    async def http_error(_: Request, exc: HTTPException):
        return JSONResponse({"error": exc.detail or "Not found."}, status_code=exc.status_code)

    return app


app = create_app() if os.getenv("TEMPMAIL_NO_AUTOAPP") != "1" else None

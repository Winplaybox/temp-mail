"""Maintenance jobs for WinPlayBox Temp Mail.

* cleanup   – delete expired inboxes (mail + attachments cascade) through the tm_cleanup RPC
* stats     – usage numbers from tm_stats
* health    – the live site's /api/health answers and sees the database
* selftest  – full path: create inbox on the site → post a mail to the ingest webhook →
              read it back with the code detected → delete the inbox
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

import httpx


@dataclass
class Settings:
    supabase_url: str
    anon_key: str
    server_secret: str
    site_url: str = "https://temp-mail.winplaybox.in"
    ingest_secret: str = ""
    timeout: float = 30.0


@dataclass
class Report:
    ok: bool = True
    lines: list[str] = field(default_factory=list)

    def add(self, ok: bool, text: str) -> None:
        self.ok = self.ok and ok
        self.lines.append(f"{'✅' if ok else '❌'} {text}")

    def markdown(self) -> str:
        head = "## Temp Mail maintenance — " + ("all good" if self.ok else "needs attention")
        return "\n".join([head, "", *[f"- {line}" for line in self.lines], ""])


class Rpc:
    def __init__(self, s: Settings, client: httpx.Client):
        self.s = s
        self.http = client

    def call(self, fn: str, **args: Any) -> Any:
        r = self.http.post(
            f"{self.s.supabase_url.rstrip('/')}/rest/v1/rpc/{fn}",
            json={"p_secret": self.s.server_secret, **args},
            headers={"apikey": self.s.anon_key, "Authorization": f"Bearer {self.s.anon_key}"},
        )
        if r.status_code >= 400:
            raise RuntimeError(f"{fn} failed: {r.status_code} {r.text[:200]}")
        return r.json() if r.content else None


def cleanup(rpc: Rpc, report: Report) -> None:
    try:
        n = rpc.call("tm_cleanup")
        report.add(True, f"Cleanup removed {n} expired inbox(es)")
    except Exception as e:  # noqa: BLE001
        report.add(False, f"Cleanup failed: {e}")


def stats(rpc: Rpc, report: Report) -> dict:
    try:
        data = rpc.call("tm_stats") or {}
        report.add(
            True,
            "Stats: {active_inboxes} active inboxes, {inboxes_24h} created and {messages_24h} mails in 24h, {stored_mb} MB stored".format(
                **{k: data.get(k, "?") for k in ("active_inboxes", "inboxes_24h", "messages_24h", "stored_mb")}
            ),
        )
        return data
    except Exception as e:  # noqa: BLE001
        report.add(False, f"Stats failed: {e}")
        return {}


def health(s: Settings, http: httpx.Client, report: Report) -> None:
    try:
        r = http.get(f"{s.site_url}/api/health")
        ok = r.status_code == 200 and r.json().get("ok") is True
        report.add(ok, f"Site health {r.status_code}")
    except Exception as e:  # noqa: BLE001
        report.add(False, f"Site unreachable: {e}")


def public_check(s: Settings, http: httpx.Client, report: Report) -> None:
    """Create and delete an address through the public API (no secrets needed)."""
    try:
        r = http.post(f"{s.site_url}/api/inboxes", json={"ttl_minutes": 10})
        r.raise_for_status()
        inbox = r.json()
        d = http.delete(f"{s.site_url}/api/inboxes/{inbox['id']}", headers={"X-Inbox-Token": inbox["token"]})
        report.add(d.status_code == 204, f"Address create/delete works ({inbox['address'].split('@')[1]})")
    except Exception as e:  # noqa: BLE001
        report.add(False, f"Address create failed: {e}")


def selftest(s: Settings, http: httpx.Client, report: Report) -> None:
    if not s.ingest_secret:
        public_check(s, http, report)
        return
    inbox = None
    try:
        r = http.post(f"{s.site_url}/api/inboxes", json={"ttl_minutes": 10})
        r.raise_for_status()
        inbox = r.json()
        code = str(100000 + int(time.time()) % 900000)
        payload = {
            "recipients": [inbox["address"]],
            "from": {"value": [{"address": "selftest@winplaybox.in", "name": "Temp Mail self-test"}]},
            "subject": "Self-test",
            "text": f"Your verification code is {code}",
        }
        hook = http.post(f"{s.site_url}/api/ingest/{s.ingest_secret}", json=payload)
        hook.raise_for_status()
        msgs = http.get(
            f"{s.site_url}/api/inboxes/{inbox['id']}/messages", headers={"X-Inbox-Token": inbox["token"]}
        ).json()["messages"]
        ok = bool(msgs) and msgs[0].get("otp") == code
        report.add(ok, "Self-test: create → receive → code detected" if ok else f"Self-test mismatch: {msgs[:1]}")
    except Exception as e:  # noqa: BLE001
        report.add(False, f"Self-test failed: {e}")
    finally:
        if inbox:
            http.delete(f"{s.site_url}/api/inboxes/{inbox['id']}", headers={"X-Inbox-Token": inbox["token"]})


def run_all(s: Settings, client: httpx.Client | None = None) -> Report:
    report = Report()
    with client or httpx.Client(timeout=s.timeout, headers={"User-Agent": "wpb-tempmail-worker/1.0"}) as http:
        if s.supabase_url and s.anon_key and s.server_secret:
            rpc = Rpc(s, http)
            cleanup(rpc, report)
            stats(rpc, report)
        else:
            report.add(True, "Cleanup/stats skipped (no DB secrets) — Supabase pg_cron cleans up every 10 min")
        health(s, http, report)
        selftest(s, http, report)
    return report

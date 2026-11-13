import asyncio
from datetime import datetime, timezone

import httpx
import pytest

from app.store import AddressTaken, SupabaseStore


def run(coro):
    return asyncio.run(coro)


def store_with(handler):
    return SupabaseStore("https://x.supabase.co", "svc", httpx.AsyncClient(transport=httpx.MockTransport(handler)))


def test_count_reads_content_range():
    def handler(req: httpx.Request):
        assert req.headers["Prefer"] == "count=exact"
        assert req.url.params["ip_hash"] == "eq.abc"
        return httpx.Response(200, json=[], headers={"content-range": "0-0/7"})

    assert run(store_with(handler).count_recent_creates("abc", datetime.now(timezone.utc))) == 7


def test_insert_conflict_raises():
    store = store_with(lambda req: httpx.Response(409, json={"code": "23505"}))
    with pytest.raises(AddressTaken):
        run(store.insert_inbox({"local_part": "a", "domain": "b"}))


def test_sign_attachment_builds_full_url():
    def handler(req: httpx.Request):
        assert req.url.path == "/storage/v1/object/sign/attachments/i/m/f.pdf"
        return httpx.Response(200, json={"signedURL": "/object/sign/attachments/i/m/f.pdf?token=t"})

    url = run(store_with(handler).sign_attachment("i/m/f.pdf", "f.pdf"))
    assert url == "https://x.supabase.co/storage/v1/object/sign/attachments/i/m/f.pdf?token=t&download=f.pdf"


def test_service_key_sent():
    def handler(req: httpx.Request):
        assert req.headers["apikey"] == "svc" and req.headers["Authorization"] == "Bearer svc"
        return httpx.Response(200, json=[{"domain": "wpbmail.xyz", "is_default": True}])

    assert run(store_with(handler).list_domains())[0]["domain"] == "wpbmail.xyz"

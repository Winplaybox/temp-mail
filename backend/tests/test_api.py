import os
from datetime import datetime, timedelta, timezone

os.environ["TEMPMAIL_NO_AUTOAPP"] = "1"

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.names import validate_local_part
from app.store import MemoryStore


@pytest.fixture()
def ctx():
    store = MemoryStore(["wpbmail.test", "second.test"])
    cfg = Settings(cron_secret="cron123", ip_salt="salt", create_per_hour=3)
    client = TestClient(create_app(store, cfg))
    return client, store


def make(client, **body):
    r = client.post("/api/inboxes", json=body)
    assert r.status_code == 201, r.text
    return r.json()


def test_create_random_inbox(ctx):
    client, _ = ctx
    inbox = make(client)
    assert inbox["address"].endswith("@wpbmail.test")
    assert len(inbox["token"]) > 30


def test_custom_name_and_conflict(ctx):
    client, _ = ctx
    make(client, username="Sagar.Test", domain="second.test")
    r = client.post("/api/inboxes", json={"username": "sagar.test", "domain": "second.test"})
    assert r.status_code == 409


def test_reserved_and_invalid_names():
    assert validate_local_part("admin")
    assert validate_local_part("a")
    assert validate_local_part("ok..no")
    assert validate_local_part("good.name42") is None


def test_unknown_domain_rejected(ctx):
    client, _ = ctx
    r = client.post("/api/inboxes", json={"domain": "gmail.com"})
    assert r.status_code == 400


def test_token_required(ctx):
    client, _ = ctx
    inbox = make(client)
    assert client.get(f"/api/inboxes/{inbox['id']}/messages").status_code == 404
    assert client.get(f"/api/inboxes/{inbox['id']}/messages", headers={"X-Inbox-Token": "wrong"}).status_code == 404


def test_messages_flow_and_read_flag(ctx):
    client, store = ctx
    inbox = make(client)
    h = {"X-Inbox-Token": inbox["token"]}
    msg = store.add_message(inbox["id"], subject="Code", text_body="Your code is 123456", otp="123456")
    lst = client.get(f"/api/inboxes/{inbox['id']}/messages", headers=h).json()["messages"]
    assert lst[0]["otp"] == "123456" and lst[0]["read"] is False
    full = client.get(f"/api/inboxes/{inbox['id']}/messages/{msg['id']}", headers=h).json()
    assert full["text"] == "Your code is 123456"
    lst = client.get(f"/api/inboxes/{inbox['id']}/messages", headers=h).json()["messages"]
    assert lst[0]["read"] is True
    assert client.delete(f"/api/inboxes/{inbox['id']}/messages/{msg['id']}", headers=h).status_code == 204
    assert client.get(f"/api/inboxes/{inbox['id']}/messages", headers=h).json()["messages"] == []


def test_other_inbox_cannot_read_message(ctx):
    client, store = ctx
    a, b = make(client), make(client)
    msg = store.add_message(a["id"], subject="secret", text_body="x")
    r = client.get(f"/api/inboxes/{b['id']}/messages/{msg['id']}", headers={"X-Inbox-Token": b["token"]})
    assert r.status_code == 404


def test_expired_inbox_and_cleanup(ctx):
    client, store = ctx
    inbox = make(client, ttl_minutes=10)
    store.inboxes[inbox["id"]]["expires_at"] = datetime.now(timezone.utc) - timedelta(minutes=1)
    r = client.get(f"/api/inboxes/{inbox['id']}", headers={"X-Inbox-Token": inbox["token"]})
    assert r.status_code == 410
    assert client.post("/internal/cleanup").status_code == 404
    r = client.post("/internal/cleanup", headers={"X-Cron-Secret": "cron123"})
    assert r.json()["removed"] == 1 and inbox["id"] not in store.inboxes


def test_extend_respects_cap(ctx):
    client, _ = ctx
    inbox = make(client, ttl_minutes=10)
    r = client.post(f"/api/inboxes/{inbox['id']}/extend", json={"ttl_minutes": 1440}, headers={"X-Inbox-Token": inbox["token"]})
    assert r.status_code == 200
    assert r.json()["expires_at"] > inbox["expires_at"]


def test_rate_limit(ctx):
    client, _ = ctx
    for _ in range(3):
        make(client)
    assert client.post("/api/inboxes", json={}).status_code == 429


def test_bad_ttl(ctx):
    client, _ = ctx
    assert client.post("/api/inboxes", json={"ttl_minutes": 99999}).status_code == 400

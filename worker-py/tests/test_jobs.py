import json

import httpx

from tempmail_worker.jobs import Settings, run_all

S = Settings(
    supabase_url="https://db.test",
    anon_key="anon",
    server_secret="srv",
    site_url="https://site.test",
    ingest_secret="hook",
)


def make_handler(state):
    def handler(req: httpx.Request) -> httpx.Response:
        url = str(req.url)
        if url.startswith("https://db.test/rest/v1/rpc/"):
            assert json.loads(req.content)["p_secret"] == "srv"
            assert req.headers["apikey"] == "anon"
            fn = url.rsplit("/", 1)[-1]
            if fn == "tm_cleanup":
                return httpx.Response(200, json=3)
            if fn == "tm_stats":
                return httpx.Response(200, json={"active_inboxes": 2, "inboxes_24h": 5, "messages_24h": 9, "stored_mb": 0.4})
        if url == "https://site.test/api/health":
            return httpx.Response(200, json={"ok": state.get("healthy", True)})
        if url == "https://site.test/api/inboxes" and req.method == "POST":
            return httpx.Response(201, json={"id": "i1", "token": "t1", "address": "x@temp-mail.winplaybox.in"})
        if url == "https://site.test/api/ingest/hook":
            state["code"] = json.loads(req.content)["text"].split()[-1]
            return httpx.Response(200, json={"ok": True, "stored": 1})
        if url == "https://site.test/api/inboxes/i1/messages":
            assert req.headers["x-inbox-token"] == "t1"
            return httpx.Response(200, json={"messages": [{"otp": state["code"]}]})
        if url == "https://site.test/api/inboxes/i1" and req.method == "DELETE":
            state["deleted"] = True
            return httpx.Response(204)
        return httpx.Response(404)

    return handler


def test_all_green():
    state = {}
    report = run_all(S, httpx.Client(transport=httpx.MockTransport(make_handler(state))))
    assert report.ok, report.lines
    assert "removed 3" in report.lines[0]
    assert "2 active inboxes" in report.lines[1]
    assert state["deleted"] is True


def test_unhealthy_site_fails():
    state = {"healthy": False}
    report = run_all(S, httpx.Client(transport=httpx.MockTransport(make_handler(state))))
    assert not report.ok
    assert any("Site health" in line and "❌" in line for line in report.lines)

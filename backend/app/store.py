"""Data access. SupabaseStore talks to PostgREST + Storage over HTTP;
MemoryStore is used by tests and by local dev (DEV_MODE=1)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Protocol
from urllib.parse import quote

import httpx

Row = dict[str, Any]

MESSAGE_SUMMARY_FIELDS = (
    "id,from_address,from_name,subject,otp,has_attachments,received_at,read_at,size_bytes,text_body"
)


class AddressTaken(Exception):
    pass


class Store(Protocol):
    async def list_domains(self) -> list[Row]: ...
    async def count_recent_creates(self, ip_hash: str, since: datetime) -> int: ...
    async def insert_inbox(self, row: Row) -> Row: ...
    async def get_inbox(self, inbox_id: str) -> Row | None: ...
    async def address_exists(self, local_part: str, domain: str) -> bool: ...
    async def update_inbox(self, inbox_id: str, patch: Row) -> None: ...
    async def delete_inbox(self, inbox_id: str) -> None: ...
    async def list_messages(self, inbox_id: str, limit: int = 100) -> list[Row]: ...
    async def get_message(self, inbox_id: str, message_id: str) -> Row | None: ...
    async def update_message(self, message_id: str, patch: Row) -> None: ...
    async def delete_message(self, inbox_id: str, message_id: str) -> None: ...
    async def list_attachments(self, message_id: str) -> list[Row]: ...
    async def get_attachment(self, inbox_id: str, attachment_id: str) -> Row | None: ...
    async def attachment_paths_for_inbox(self, inbox_id: str) -> list[str]: ...
    async def attachment_paths_for_message(self, message_id: str) -> list[str]: ...
    async def sign_attachment(self, path: str, filename: str) -> str: ...
    async def delete_objects(self, paths: list[str]) -> None: ...
    async def expired_inbox_ids(self, limit: int = 500) -> list[str]: ...
    async def stats(self) -> Row: ...


class SupabaseStore:
    def __init__(self, url: str, service_key: str, client: httpx.AsyncClient | None = None):
        self.url = url
        self.rest = f"{url}/rest/v1"
        self.storage = f"{url}/storage/v1"
        self.headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
        }
        self.http = client or httpx.AsyncClient(timeout=15)

    async def _get(self, path: str, params: dict[str, str]) -> list[Row]:
        r = await self.http.get(f"{self.rest}/{path}", params=params, headers=self.headers)
        r.raise_for_status()
        return r.json()

    async def list_domains(self) -> list[Row]:
        return await self._get(
            "domains", {"select": "domain,is_default", "is_active": "eq.true", "order": "is_default.desc,domain"}
        )

    async def count_recent_creates(self, ip_hash: str, since: datetime) -> int:
        r = await self.http.get(
            f"{self.rest}/inboxes",
            params={"select": "id", "ip_hash": f"eq.{ip_hash}", "created_at": f"gte.{since.isoformat()}"},
            headers={**self.headers, "Prefer": "count=exact", "Range": "0-0"},
        )
        r.raise_for_status()
        total = r.headers.get("content-range", "*/0").split("/")[-1]
        return int(total) if total.isdigit() else 0

    async def insert_inbox(self, row: Row) -> Row:
        r = await self.http.post(
            f"{self.rest}/inboxes", json=row, headers={**self.headers, "Prefer": "return=representation"}
        )
        if r.status_code == 409:
            raise AddressTaken()
        r.raise_for_status()
        return r.json()[0]

    async def get_inbox(self, inbox_id: str) -> Row | None:
        rows = await self._get("inboxes", {"select": "*", "id": f"eq.{inbox_id}"})
        return rows[0] if rows else None

    async def address_exists(self, local_part: str, domain: str) -> bool:
        rows = await self._get(
            "inboxes", {"select": "id", "local_part": f"eq.{local_part}", "domain": f"eq.{domain}"}
        )
        return bool(rows)

    async def update_inbox(self, inbox_id: str, patch: Row) -> None:
        r = await self.http.patch(f"{self.rest}/inboxes", params={"id": f"eq.{inbox_id}"}, json=patch, headers=self.headers)
        r.raise_for_status()

    async def delete_inbox(self, inbox_id: str) -> None:
        r = await self.http.delete(f"{self.rest}/inboxes", params={"id": f"eq.{inbox_id}"}, headers=self.headers)
        r.raise_for_status()

    async def list_messages(self, inbox_id: str, limit: int = 100) -> list[Row]:
        return await self._get(
            "messages",
            {
                "select": MESSAGE_SUMMARY_FIELDS,
                "inbox_id": f"eq.{inbox_id}",
                "order": "received_at.desc",
                "limit": str(limit),
            },
        )

    async def get_message(self, inbox_id: str, message_id: str) -> Row | None:
        rows = await self._get("messages", {"select": "*", "id": f"eq.{message_id}", "inbox_id": f"eq.{inbox_id}"})
        return rows[0] if rows else None

    async def update_message(self, message_id: str, patch: Row) -> None:
        r = await self.http.patch(f"{self.rest}/messages", params={"id": f"eq.{message_id}"}, json=patch, headers=self.headers)
        r.raise_for_status()

    async def delete_message(self, inbox_id: str, message_id: str) -> None:
        r = await self.http.delete(
            f"{self.rest}/messages", params={"id": f"eq.{message_id}", "inbox_id": f"eq.{inbox_id}"}, headers=self.headers
        )
        r.raise_for_status()

    async def list_attachments(self, message_id: str) -> list[Row]:
        return await self._get(
            "attachments", {"select": "id,filename,content_type,size_bytes", "message_id": f"eq.{message_id}"}
        )

    async def get_attachment(self, inbox_id: str, attachment_id: str) -> Row | None:
        rows = await self._get("attachments", {"select": "*", "id": f"eq.{attachment_id}", "inbox_id": f"eq.{inbox_id}"})
        return rows[0] if rows else None

    async def attachment_paths_for_inbox(self, inbox_id: str) -> list[str]:
        rows = await self._get("attachments", {"select": "storage_path", "inbox_id": f"eq.{inbox_id}"})
        return [r["storage_path"] for r in rows]

    async def attachment_paths_for_message(self, message_id: str) -> list[str]:
        rows = await self._get("attachments", {"select": "storage_path", "message_id": f"eq.{message_id}"})
        return [r["storage_path"] for r in rows]

    async def sign_attachment(self, path: str, filename: str) -> str:
        r = await self.http.post(
            f"{self.storage}/object/sign/attachments/{quote(path)}", json={"expiresIn": 120}, headers=self.headers
        )
        r.raise_for_status()
        signed = r.json()["signedURL"]
        return f"{self.storage}{signed}&download={quote(filename)}"

    async def delete_objects(self, paths: list[str]) -> None:
        for i in range(0, len(paths), 500):
            r = await self.http.request(
                "DELETE", f"{self.storage}/object/attachments", json={"prefixes": paths[i : i + 500]}, headers=self.headers
            )
            r.raise_for_status()

    async def expired_inbox_ids(self, limit: int = 500) -> list[str]:
        now = datetime.now(timezone.utc).isoformat()
        rows = await self._get("inboxes", {"select": "id", "expires_at": f"lt.{now}", "limit": str(limit)})
        return [r["id"] for r in rows]

    async def stats(self) -> Row:
        rows = await self._get("stats_today", {"select": "*"})
        return rows[0] if rows else {}


class MemoryStore:
    def __init__(self, domains: list[str] | None = None):
        self.domains = [{"domain": d, "is_default": i == 0} for i, d in enumerate(domains or ["example.test"])]
        self.inboxes: dict[str, Row] = {}
        self.messages: dict[str, Row] = {}
        self.attachments: dict[str, Row] = {}
        self.objects: set[str] = set()

    async def list_domains(self) -> list[Row]:
        return list(self.domains)

    async def count_recent_creates(self, ip_hash: str, since: datetime) -> int:
        return sum(1 for i in self.inboxes.values() if i.get("ip_hash") == ip_hash and i["created_at"] >= since)

    async def insert_inbox(self, row: Row) -> Row:
        if await self.address_exists(row["local_part"], row["domain"]):
            raise AddressTaken()
        full = {
            "id": str(uuid.uuid4()),
            "created_at": datetime.now(timezone.utc),
            "address": f"{row['local_part']}@{row['domain']}",
            **row,
        }
        if isinstance(full["expires_at"], str):
            full["expires_at"] = datetime.fromisoformat(full["expires_at"])
        self.inboxes[full["id"]] = full
        return full

    async def get_inbox(self, inbox_id: str) -> Row | None:
        return self.inboxes.get(inbox_id)

    async def address_exists(self, local_part: str, domain: str) -> bool:
        return any(i["local_part"] == local_part and i["domain"] == domain for i in self.inboxes.values())

    async def update_inbox(self, inbox_id: str, patch: Row) -> None:
        if "expires_at" in patch and isinstance(patch["expires_at"], str):
            patch = {**patch, "expires_at": datetime.fromisoformat(patch["expires_at"])}
        self.inboxes[inbox_id].update(patch)

    async def delete_inbox(self, inbox_id: str) -> None:
        self.inboxes.pop(inbox_id, None)
        for mid in [m for m, v in self.messages.items() if v["inbox_id"] == inbox_id]:
            self.messages.pop(mid)
        for aid in [a for a, v in self.attachments.items() if v["inbox_id"] == inbox_id]:
            self.attachments.pop(aid)

    async def list_messages(self, inbox_id: str, limit: int = 100) -> list[Row]:
        rows = [m for m in self.messages.values() if m["inbox_id"] == inbox_id]
        return sorted(rows, key=lambda m: m["received_at"], reverse=True)[:limit]

    async def get_message(self, inbox_id: str, message_id: str) -> Row | None:
        m = self.messages.get(message_id)
        return m if m and m["inbox_id"] == inbox_id else None

    async def update_message(self, message_id: str, patch: Row) -> None:
        self.messages[message_id].update(patch)

    async def delete_message(self, inbox_id: str, message_id: str) -> None:
        if (await self.get_message(inbox_id, message_id)) is not None:
            self.messages.pop(message_id)
            for aid in [a for a, v in self.attachments.items() if v["message_id"] == message_id]:
                self.attachments.pop(aid)

    async def list_attachments(self, message_id: str) -> list[Row]:
        return [
            {k: a[k] for k in ("id", "filename", "content_type", "size_bytes")}
            for a in self.attachments.values()
            if a["message_id"] == message_id
        ]

    async def get_attachment(self, inbox_id: str, attachment_id: str) -> Row | None:
        a = self.attachments.get(attachment_id)
        return a if a and a["inbox_id"] == inbox_id else None

    async def attachment_paths_for_inbox(self, inbox_id: str) -> list[str]:
        return [a["storage_path"] for a in self.attachments.values() if a["inbox_id"] == inbox_id]

    async def attachment_paths_for_message(self, message_id: str) -> list[str]:
        return [a["storage_path"] for a in self.attachments.values() if a["message_id"] == message_id]

    async def sign_attachment(self, path: str, filename: str) -> str:
        return f"memory://attachments/{path}?download={quote(filename)}"

    async def delete_objects(self, paths: list[str]) -> None:
        self.objects.difference_update(paths)

    async def expired_inbox_ids(self, limit: int = 500) -> list[str]:
        now = datetime.now(timezone.utc)
        return [i for i, v in self.inboxes.items() if v["expires_at"] < now][:limit]

    async def stats(self) -> Row:
        return {"active_inboxes": len(self.inboxes), "messages_24h": len(self.messages)}

    # dev helper: simulate an incoming email
    def add_message(self, inbox_id: str, **fields: Any) -> Row:
        row = {
            "id": str(uuid.uuid4()),
            "inbox_id": inbox_id,
            "received_at": datetime.now(timezone.utc),
            "read_at": None,
            "has_attachments": False,
            "size_bytes": len(str(fields)),
            "otp": None,
            "html_body": None,
            **fields,
        }
        self.messages[row["id"]] = row
        return row

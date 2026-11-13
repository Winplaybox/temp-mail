"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { api, ApiError, type Inbox, type MessageSummary } from "./api";

const STORE_KEY = "wpb.tm.inboxes";
const ACTIVE_KEY = "wpb.tm.active";
const POLL_MS = 10_000;

export type Status = "loading" | "waking" | "ready" | "expired" | "error";

function loadSaved(): Inbox[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "[]") as Inbox[];
    return raw.filter((i) => i && i.id && i.token && new Date(i.expires_at).getTime() > Date.now());
  } catch {
    return [];
  }
}

function persist(list: Inbox[], activeId: string | null) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(list.slice(0, 10)));
    if (activeId) localStorage.setItem(ACTIVE_KEY, activeId);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {}
}

let supabase: SupabaseClient | null | undefined;
async function realtimeClient(): Promise<SupabaseClient | null> {
  if (supabase !== undefined) return supabase;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return (supabase = null);
  const { createClient } = await import("@supabase/supabase-js");
  supabase = createClient(url, key, { auth: { persistSession: false } });
  return supabase;
}

export function useTempMail(onNewMail?: (count: number, latest: MessageSummary) => void, initialTtl?: number) {
  const [inboxes, setInboxes] = useState<Inbox[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageSummary[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<ApiError | null>(null);
  const [domains, setDomains] = useState<string[]>([]);
  const [ttlChoices, setTtlChoices] = useState<number[]>([10, 60, 1440]);
  const [live, setLive] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [refreshing, setRefreshing] = useState(false);

  const active = inboxes.find((i) => i.id === activeId) ?? null;
  const knownIds = useRef<Set<string> | null>(null);
  const onNewMailRef = useRef(onNewMail);
  onNewMailRef.current = onNewMail;

  // one clock for countdowns
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const save = useCallback((list: Inbox[], id: string | null) => {
    setInboxes(list);
    setActiveId(id);
    persist(list, id);
  }, []);

  const create = useCallback(
    async (opts: { username?: string; domain?: string; ttl_minutes?: number } = {}) => {
      const slow = setTimeout(() => setStatus((s) => (s === "loading" ? "waking" : s)), 3500);
      setStatus("loading");
      setError(null);
      try {
        const inbox = await api.create(opts);
        const list = [inbox, ...loadSaved().filter((i) => i.id !== inbox.id)];
        knownIds.current = new Set();
        setMessages([]);
        save(list, inbox.id);
        setStatus("ready");
        return inbox;
      } catch (e) {
        const err = e instanceof ApiError ? e : new ApiError(0, "network");
        setError(err);
        setStatus(loadSaved().length ? "ready" : "error");
        throw err;
      } finally {
        clearTimeout(slow);
      }
    },
    [save],
  );

  const fetchMessages = useCallback(
    async (inbox: Inbox, silent = true) => {
      if (!silent) setRefreshing(true);
      try {
        const data = await api.messages(inbox);
        const ids = new Set(data.messages.map((m) => m.id));
        const fresh = knownIds.current ? data.messages.filter((m) => !knownIds.current!.has(m.id)) : [];
        knownIds.current = ids;
        setMessages(data.messages);
        if (fresh.length) onNewMailRef.current?.(fresh.length, fresh[0]);
        if (data.expires_at !== inbox.expires_at) {
          setInboxes((list) => {
            const next = list.map((i) => (i.id === inbox.id ? { ...i, expires_at: data.expires_at } : i));
            persist(next, inbox.id);
            return next;
          });
        }
      } catch (e) {
        if (e instanceof ApiError && (e.status === 410 || e.status === 404)) setStatus("expired");
      } finally {
        if (!silent) setRefreshing(false);
      }
    },
    [],
  );

  // boot
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let active: string[] | null = null;
      try {
        const d = await api.domains();
        active = d.domains;
        if (!cancelled) {
          setDomains(d.domains);
          setTtlChoices(d.ttl_choices);
        }
      } catch {
        /* keep saved inboxes if the list can't be loaded */
      }
      if (cancelled) return;

      // Drop saved addresses on domains that no longer receive mail.
      let saved = loadSaved();
      if (active) {
        const keep = saved.filter((i) => active!.includes(i.domain));
        if (keep.length !== saved.length) persist(keep, keep[0]?.id ?? null);
        saved = keep;
      }
      boot(saved);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function boot(saved: Inbox[]) {
    const wanted = (() => {
      try {
        return localStorage.getItem(ACTIVE_KEY);
      } catch {
        return null;
      }
    })();
    const pick = saved.find((i) => i.id === wanted) ?? saved[0];
    if (pick) {
      save(saved, pick.id);
      setStatus("ready");
    } else {
      create(initialTtl ? { ttl_minutes: initialTtl } : {}).catch(() => undefined);
    }
  }

  // polling + realtime for the active inbox
  useEffect(() => {
    if (!active || status === "expired") return;
    knownIds.current = null;
    fetchMessages(active);
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") fetchMessages(active);
    }, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && fetchMessages(active);
    document.addEventListener("visibilitychange", onVisible);

    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    realtimeClient().then((client) => {
      if (!client || cancelled) return;
      channel = client
        .channel(`inbox:${active.id}`)
        .on("broadcast", { event: "new_mail" }, () => fetchMessages(active))
        .subscribe((s) => setLive(s === "SUBSCRIBED"));
    });

    return () => {
      cancelled = true;
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) channel.unsubscribe();
      setLive(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, status === "expired"]);

  // expiry watch
  useEffect(() => {
    if (active && status === "ready" && new Date(active.expires_at).getTime() <= now) setStatus("expired");
  }, [active, now, status]);

  const switchTo = useCallback(
    (id: string) => {
      const list = loadSaved();
      if (!list.some((i) => i.id === id)) return;
      setMessages([]);
      save(list, id);
      setStatus("ready");
    },
    [save],
  );

  const removeActive = useCallback(async () => {
    if (!active) return;
    await api.remove(active).catch((e) => {
      if (!(e instanceof ApiError && (e.status === 404 || e.status === 410))) throw e;
    });
    const rest = loadSaved().filter((i) => i.id !== active.id);
    if (rest.length) {
      setMessages([]);
      save(rest, rest[0].id);
      setStatus("ready");
    } else {
      save([], null);
      await create();
    }
  }, [active, create, save]);

  const extend = useCallback(
    async (ttl: number) => {
      if (!active) return;
      const updated = await api.extend(active, ttl);
      const list = inboxes.map((i) => (i.id === active.id ? { ...i, expires_at: updated.expires_at } : i));
      save(list, active.id);
    },
    [active, inboxes, save],
  );

  const removeMessage = useCallback(
    async (mid: string) => {
      if (!active) return;
      await api.removeMessage(active, mid);
      setMessages((all) => all.filter((m) => m.id !== mid));
    },
    [active],
  );

  const markRead = useCallback((mid: string) => {
    setMessages((all) => all.map((m) => (m.id === mid ? { ...m, read: true } : m)));
  }, []);

  const refresh = useCallback(() => (active ? fetchMessages(active, false) : Promise.resolve()), [active, fetchMessages]);

  return {
    active,
    inboxes,
    messages,
    status,
    error,
    domains,
    ttlChoices,
    live,
    now,
    refreshing,
    create,
    switchTo,
    removeActive,
    extend,
    refresh,
    removeMessage,
    markRead,
  };
}

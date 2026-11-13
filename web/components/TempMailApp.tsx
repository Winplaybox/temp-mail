"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, type MessageSummary } from "@/lib/api";
import { clock, msLeft } from "@/lib/format";
import { useTempMail } from "@/lib/useTempMail";
import { AddressCard } from "./AddressCard";
import { NewAddressDialog, QrDialog } from "./Dialogs";
import { InboxPanel } from "./InboxPanel";
import { Icon } from "./Icon";
import { useApp } from "./Providers";
import { AdSlot } from "./AdSlot";

const DEV = process.env.NEXT_PUBLIC_DEV === "1";

export function TempMailApp() {
  const { t, toast } = useApp();
  const [unseen, setUnseen] = useState(0);
  const [notify, setNotify] = useState(false);
  const baseTitle = useRef("");

  const onNewMail = useCallback(
    (count: number, latest: MessageSummary) => {
      if (document.visibilityState !== "visible") setUnseen((n) => n + count);
      if (notify && document.visibilityState !== "visible" && "Notification" in window) {
        new Notification(latest.from_name || latest.from_address || t.brand, {
          body: latest.otp ? `${t.code}: ${latest.otp}` : latest.subject,
          tag: latest.id,
        });
      }
    },
    [notify, t],
  );

  const tm = useTempMail(onNewMail);
  const [qrOpen, setQrOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);

  useEffect(() => {
    baseTitle.current = document.title;
    const onVisible = () => document.visibilityState === "visible" && setUnseen(0);
    document.addEventListener("visibilitychange", onVisible);
    try {
      setNotify(localStorage.getItem("wpb.tm.notify") === "1" && Notification.permission === "granted");
    } catch {}
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  useEffect(() => {
    if (!baseTitle.current) return;
    document.title = unseen > 0 ? `(${unseen}) ${t.newMailTitle(unseen)} · ${baseTitle.current}` : baseTitle.current;
  }, [unseen, t]);

  const fail = (e: unknown) =>
    toast(e instanceof ApiError ? (e.status === 0 ? t.networkError : e.message) : t.genericError, "error");

  const copy = async () => {
    if (!tm.active) return;
    try {
      await navigator.clipboard.writeText(tm.active.address);
      toast(t.addressCopied);
    } catch {
      fail(null);
    }
  };

  const toggleNotify = async () => {
    if (!("Notification" in window)) return;
    if (notify) {
      setNotify(false);
      localStorage.setItem("wpb.tm.notify", "0");
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      setNotify(true);
      localStorage.setItem("wpb.tm.notify", "1");
      toast(t.notifyOn);
    } else {
      toast(t.notifyBlocked, "error");
    }
  };

  const others = tm.inboxes.filter((i) => i.id !== tm.active?.id && msLeft(i.expires_at, tm.now) > 0);

  return (
    <>
      <AddressCard
        inbox={tm.active}
        status={tm.status}
        now={tm.now}
        ttlChoices={tm.ttlChoices}
        onCopy={copy}
        onQr={() => setQrOpen(true)}
        onNew={() => tm.create().then(() => toast(t.newAddress)).catch(fail)}
        onCustom={() => setNewOpen(true)}
        onDelete={() => tm.removeActive().then(() => toast(t.addressDeleted)).catch(fail)}
        onExtend={(m) => tm.extend(m).then(() => toast(t.extended)).catch(fail)}
      />

      {tm.status === "error" && (
        <div className="banner banner-error" role="alert">
          <p>{tm.error?.status === 0 ? t.networkError : tm.error?.message || t.genericError}</p>
          <button type="button" className="btn btn-primary" onClick={() => tm.create().catch(() => undefined)}>
            {t.createFresh}
          </button>
        </div>
      )}

      {tm.status === "expired" && (
        <div className="banner" role="alert">
          <div>
            <strong>{t.expiredTitle}</strong>
            <p>{t.expiredBody}</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => tm.create().catch(fail)}>
            {t.createFresh}
          </button>
        </div>
      )}

      <div className="toolbar">
        {others.length > 0 && (
          <nav className="saved" aria-label={t.savedAddresses}>
            <span className="saved-label">{t.savedAddresses}</span>
            {others.map((i) => (
              <button
                key={i.id}
                type="button"
                className="chip chip-addr"
                onClick={() => tm.switchTo(i.id)}
                title={`${t.switchTo} ${i.address}`}
              >
                <span className="chip-addr-text">{i.address}</span>
                <span className="muted">{clock(msLeft(i.expires_at, tm.now))}</span>
              </button>
            ))}
          </nav>
        )}
        <button type="button" className={`btn btn-quiet notify${notify ? " notify-on" : ""}`} onClick={toggleNotify} aria-pressed={notify}>
          <Icon name="bell" /> {notify ? t.notifyOn : t.notify}
        </button>
      </div>

      <InboxPanel
        inbox={tm.active}
        messages={tm.messages}
        now={tm.now}
        live={tm.live}
        refreshing={tm.refreshing}
        onRefresh={() => tm.refresh().then(() => toast(t.refreshed))}
        onDelete={(id) => tm.removeMessage(id).catch(fail)}
        onRead={tm.markRead}
        onSimulate={DEV && tm.active ? () => api.simulate(tm.active!).then(() => tm.refresh()).catch(fail) : undefined}
      />

      <AdSlot slot="inbox-below" />

      <QrDialog open={qrOpen} address={tm.active?.address ?? ""} onClose={() => setQrOpen(false)} />
      <NewAddressDialog
        open={newOpen}
        domains={tm.domains.length ? tm.domains : tm.active ? [tm.active.domain] : []}
        ttlChoices={tm.ttlChoices}
        onClose={() => setNewOpen(false)}
        onCreate={async (o) => {
          await tm.create(o);
          toast(t.newAddress);
        }}
      />
    </>
  );
}

"use client";

import { clock, msLeft } from "@/lib/format";
import type { Inbox } from "@/lib/api";
import type { Status } from "@/lib/useTempMail";
import { useApp } from "./Providers";
import { Icon } from "./Icon";

function Postmark({ inbox, now, label, expiredLabel }: { inbox: Inbox | null; now: number; label: string; expiredLabel: string }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  let frac = 0;
  let text = "--:--";
  if (inbox) {
    const total = new Date(inbox.expires_at).getTime() - new Date(inbox.created_at).getTime();
    const left = msLeft(inbox.expires_at, now);
    frac = total > 0 ? Math.min(1, left / total) : 0;
    text = left > 0 ? clock(left) : expiredLabel;
  }
  const urgent = inbox && frac < 0.15;
  return (
    <div className={`postmark${urgent ? " postmark-urgent" : ""}`} aria-live="off">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="56" className="pm-outer" />
        <circle cx="60" cy="60" r={r} className="pm-track" />
        <circle
          cx="60"
          cy="60"
          r={r}
          className="pm-progress"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          transform="rotate(-90 60 60)"
        />
        <text x="60" y="50" textAnchor="middle" className="pm-label">
          {label}
        </text>
        <text x="60" y="73" textAnchor="middle" className="pm-time">
          {text}
        </text>
      </svg>
      <span className="sr-only">
        {label} {text}
      </span>
    </div>
  );
}

type Props = {
  inbox: Inbox | null;
  status: Status;
  now: number;
  ttlChoices: number[];
  onCopy: () => void;
  onQr: () => void;
  onNew: () => void;
  onCustom: () => void;
  onDelete: () => void;
  onExtend: (ttl: number) => void;
};

export function AddressCard({ inbox, status, now, ttlChoices, onCopy, onQr, onNew, onCustom, onDelete, onExtend }: Props) {
  const { t } = useApp();
  const busy = status === "loading" || status === "waking";
  const ttlLabel = (m: number) => (m === 10 ? t.ttl10 : m === 60 ? t.ttl60 : m === 1440 ? t.ttl1440 : `${m}m`);
  const [local, domain] = inbox ? inbox.address.split("@") : ["", ""];

  return (
    <section className="envelope" aria-labelledby="addr-label">
      <div className="envelope-inner">
        <div className="envelope-main">
          <p id="addr-label" className="addr-label">
            {t.yourAddress}
          </p>
          {busy || !inbox ? (
            <div className="addr addr-loading" aria-busy="true">
              <span className="addr-skeleton" />
              <p className="addr-hint">{status === "waking" ? t.wakingServer : t.creating}</p>
            </div>
          ) : (
            <button type="button" className="addr" onClick={onCopy} title={t.copy}>
              <span className="addr-local">{local}</span>
              <span className="addr-tail">
                <span className="addr-at">@</span>
                <span className="addr-domain">{domain}</span>
              </span>
            </button>
          )}

          <div className="actions" role="group" aria-label={t.yourAddress}>
            <button type="button" className="btn btn-primary" onClick={onCopy} disabled={!inbox || busy}>
              <Icon name="copy" /> {t.copy}
            </button>
            <button type="button" className="btn" onClick={onQr} disabled={!inbox || busy}>
              <Icon name="qr" /> {t.qr}
            </button>
            <button type="button" className="btn" onClick={onNew} disabled={busy}>
              <Icon name="shuffle" /> {t.newAddress}
            </button>
            <button type="button" className="btn" onClick={onCustom} disabled={busy}>
              <Icon name="pen" /> {t.customName}
            </button>
            <button type="button" className="btn btn-quiet" onClick={onDelete} disabled={!inbox || busy}>
              <Icon name="trash" /> {t.deleteAddress}
            </button>
          </div>
        </div>

        <aside className="envelope-side">
          <Postmark inbox={busy ? null : inbox} now={now} label={t.expiresIn} expiredLabel={t.expired} />
          <div className="extend">
            <span className="extend-label">{t.extend}</span>
            <div className="extend-row">
              {ttlChoices.map((m) => (
                <button
                  key={m}
                  type="button"
                  className="chip"
                  onClick={() => onExtend(m)}
                  disabled={!inbox || busy || status === "expired"}
                >
                  +{ttlLabel(m)}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

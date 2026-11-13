"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "./Providers";
import { Icon } from "./Icon";

function Modal({ open, onClose, labelledBy, children }: { open: boolean; onClose: () => void; labelledBy: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={labelledBy}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="modal-card">{children}</div>
    </dialog>
  );
}

export function QrDialog({ open, address, onClose }: { open: boolean; address: string; onClose: () => void }) {
  const { t } = useApp();
  const [svg, setSvg] = useState("");
  useEffect(() => {
    if (open && address)
      import("qrcode").then((QR) => QR.toString(address, { type: "svg", margin: 1, errorCorrectionLevel: "M" })).then(setSvg);
  }, [open, address]);
  return (
    <Modal open={open} onClose={onClose} labelledBy="qr-title">
      <h2 id="qr-title">{t.qrTitle}</h2>
      <p className="muted">{t.qrBody}</p>
      <div className="qr" dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="qr-addr">{address}</p>
      <div className="modal-actions">
        <button type="button" className="btn btn-primary" onClick={onClose}>
          {t.close}
        </button>
      </div>
    </Modal>
  );
}

export function NewAddressDialog({
  open,
  domains,
  ttlChoices,
  onClose,
  onCreate,
}: {
  open: boolean;
  domains: string[];
  ttlChoices: number[];
  onClose: () => void;
  onCreate: (o: { username?: string; domain?: string; ttl_minutes: number }) => Promise<void>;
}) {
  const { t } = useApp();
  const [username, setUsername] = useState("");
  const [domain, setDomain] = useState("");
  const [ttl, setTtl] = useState(60);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setErr("");
      setDomain((d) => d || domains[0] || "");
    }
  }, [open, domains]);

  const ttlLabel = (m: number) => (m === 10 ? t.ttl10 : m === 60 ? t.ttl60 : m === 1440 ? t.ttl1440 : `${m}m`);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await onCreate({ username: username.trim() || undefined, domain: domain || undefined, ttl_minutes: ttl });
      setUsername("");
      onClose();
    } catch (x) {
      setErr(x instanceof Error && x.message !== "network" ? x.message : t.networkError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} labelledBy="new-title">
      <form onSubmit={submit}>
        <h2 id="new-title">{t.dialogNewTitle}</h2>
        <p className="muted">{t.dialogNewBody}</p>
        <div className="field-row">
          <label className="field">
            <span>{t.username}</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder={t.usernamePlaceholder}
              autoComplete="off"
              spellCheck={false}
              maxLength={32}
              pattern="[a-z0-9._\-]*"
              aria-invalid={!!err}
              aria-describedby={err ? "new-err" : undefined}
            />
          </label>
          <span className="field-at" aria-hidden="true">
            @
          </span>
          <label className="field">
            <span>{t.domain}</span>
            <select value={domain} onChange={(e) => setDomain(e.target.value)}>
              {domains.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        </div>
        <fieldset className="field">
          <legend>{t.lifetime}</legend>
          <div className="seg">
            {ttlChoices.map((m) => (
              <button key={m} type="button" aria-pressed={ttl === m} onClick={() => setTtl(m)}>
                {ttlLabel(m)}
              </button>
            ))}
          </div>
        </fieldset>
        {err && (
          <p id="new-err" className="error" role="alert">
            {err}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            <Icon name="close" /> {t.cancel}
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {t.create}
          </button>
        </div>
      </form>
    </Modal>
  );
}

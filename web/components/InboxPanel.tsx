"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError, type FullMessage, type Inbox, type MessageSummary } from "@/lib/api";
import { bytes, countRemoteImages, emailDocument, initials, relativeTime, senderLabel } from "@/lib/format";
import { useApp } from "./Providers";
import { Icon } from "./Icon";

type Props = {
  inbox: Inbox | null;
  messages: MessageSummary[];
  now: number;
  live: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onDelete: (id: string) => Promise<void>;
  onRead: (id: string) => void;
  onSimulate?: () => void;
};

export function InboxPanel({ inbox, messages, now, live, refreshing, onRefresh, onDelete, onRead, onSimulate }: Props) {
  const { t, lang, toast } = useApp();
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => setOpenId(null), [inbox?.id]);
  useEffect(() => {
    if (openId && !messages.some((m) => m.id === openId)) setOpenId(null);
  }, [messages, openId]);

  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code).catch(() => undefined);
    toast(t.codeCopied);
  };

  return (
    <section className={`inbox${openId ? " inbox-reading" : ""}`} aria-labelledby="inbox-title">
      <div className="inbox-list">
        <header className="inbox-head">
          <h2 id="inbox-title">
            {t.inbox} <span className="count">{messages.length}</span>
          </h2>
          <span className={`live${live ? " live-on" : ""}`}>
            <span className="live-dot" aria-hidden="true" />
            {live ? t.live : t.waiting}
          </span>
          <button type="button" className="btn btn-icon" onClick={onRefresh} aria-label={t.refresh} title={t.refresh}>
            <span className={refreshing ? "spin" : ""}>
              <Icon name="refresh" />
            </span>
          </button>
        </header>

        {messages.length === 0 ? (
          <div className="empty">
            <svg viewBox="0 0 120 80" className="empty-art" aria-hidden="true">
              <rect x="6" y="10" width="108" height="64" rx="4" className="ea-env" />
              <path d="M6 14 L60 50 L114 14" className="ea-flap" />
              <path d="M84 4 h26 v20 h-26z" className="ea-stamp" />
            </svg>
            <h3>{t.emptyTitle}</h3>
            <p>{t.emptyBody}</p>
            {onSimulate && (
              <button type="button" className="btn" onClick={onSimulate}>
                <Icon name="mail" /> {t.sendTest}
              </button>
            )}
          </div>
        ) : (
          <ul className="msg-list">
            {messages.map((m) => {
              const who = senderLabel(m.from_name, m.from_address);
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    className={`msg${m.read ? "" : " msg-unread"}${openId === m.id ? " msg-open" : ""}`}
                    onClick={() => setOpenId(m.id)}
                  >
                    <span className="avatar" aria-hidden="true">
                      {initials(who)}
                    </span>
                    <span className="msg-body">
                      <span className="msg-top">
                        <span className="msg-from">{who}</span>
                        <time className="msg-time" dateTime={m.received_at}>
                          {relativeTime(m.received_at, now, lang)}
                        </time>
                      </span>
                      <span className="msg-subject">{m.subject}</span>
                      <span className="msg-preview">{m.preview}</span>
                    </span>
                    {m.has_attachments && (
                      <span className="msg-clip" aria-label={t.attachments}>
                        <Icon name="clip" size={16} />
                      </span>
                    )}
                  </button>
                  {m.otp && (
                    <button type="button" className="otp-pill" onClick={() => copyCode(m.otp!)} title={t.copy}>
                      <span className="otp-pill-code">{m.otp}</span>
                      <Icon name="copy" size={14} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="reader">
        {openId && inbox ? (
          <Reader
            key={openId}
            inbox={inbox}
            id={openId}
            now={now}
            onBack={() => setOpenId(null)}
            onDelete={async () => {
              await onDelete(openId);
              setOpenId(null);
              toast(t.messageDeleted);
            }}
            onLoaded={() => onRead(openId)}
            onCopyCode={copyCode}
          />
        ) : (
          <div className="reader-empty">
            <Icon name="mail" size={28} />
            <p>{t.selectMessage}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function Reader({
  inbox,
  id,
  now,
  onBack,
  onDelete,
  onLoaded,
  onCopyCode,
}: {
  inbox: Inbox;
  id: string;
  now: number;
  onBack: () => void;
  onDelete: () => Promise<void>;
  onLoaded: () => void;
  onCopyCode: (c: string) => void;
}) {
  const { t, lang, theme, toast } = useApp();
  const [msg, setMsg] = useState<FullMessage | null>(null);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<"html" | "text">("html");
  const [images, setImages] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let alive = true;
    api
      .message(inbox, id)
      .then((m) => {
        if (!alive) return;
        setMsg(m);
        setView(m.html ? "html" : "text");
        onLoaded();
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inbox.id, id]);

  const fit = () => {
    const doc = frame.current?.contentDocument;
    if (doc && frame.current) frame.current.style.height = `${Math.max(240, doc.documentElement.scrollHeight + 4)}px`;
  };

  const download = async (aid: string, filename: string) => {
    try {
      await api.download(inbox, aid, filename);
    } catch (e) {
      toast(e instanceof ApiError && e.status === 0 ? t.networkError : t.genericError, "error");
    }
  };

  if (failed) return <div className="reader-empty"><p>{t.genericError}</p></div>;
  if (!msg) return <div className="reader-empty" aria-busy="true"><span className="addr-skeleton" /></div>;

  const who = senderLabel(msg.from_name, msg.from_address);
  const blocked = msg.html ? countRemoteImages(msg.html) : 0;

  return (
    <article className="letter">
      <div className="letter-bar">
        <button type="button" className="btn btn-quiet back" onClick={onBack}>
          <Icon name="back" /> {t.back}
        </button>
        <button type="button" className="btn btn-quiet" onClick={onDelete}>
          <Icon name="trash" /> {t.deleteMessage}
        </button>
      </div>

      <h3 className="letter-subject">{msg.subject}</h3>
      <dl className="letter-meta">
        <div>
          <dt>{t.from}</dt>
          <dd>
            <strong>{who}</strong>
            {msg.from_name && msg.from_address ? <span className="muted"> &lt;{msg.from_address}&gt;</span> : null}
          </dd>
        </div>
        <div>
          <dt>{t.received}</dt>
          <dd>
            <time dateTime={msg.received_at} title={new Date(msg.received_at).toLocaleString()}>
              {relativeTime(msg.received_at, now, lang)}
            </time>
          </dd>
        </div>
      </dl>

      {msg.otp && (
        <div className="otp">
          <span className="otp-label">{t.code}</span>
          <span className="otp-code">{msg.otp}</span>
          <button type="button" className="btn btn-primary" onClick={() => onCopyCode(msg.otp!)}>
            <Icon name="copy" /> {t.copy}
          </button>
        </div>
      )}

      {msg.html && msg.text && (
        <div className="seg" role="tablist" aria-label="View">
          <button type="button" role="tab" aria-selected={view === "html"} onClick={() => setView("html")}>
            {t.html}
          </button>
          <button type="button" role="tab" aria-selected={view === "text"} onClick={() => setView("text")}>
            {t.text}
          </button>
        </div>
      )}

      {view === "html" && msg.html ? (
        <>
          {blocked > 0 && !images && (
            <div className="notice">
              <Icon name="image" />
              <span>{t.imagesBlocked(blocked)}</span>
              <button type="button" className="btn btn-quiet" onClick={() => setImages(true)}>
                {t.showImages}
              </button>
            </div>
          )}
          <iframe
            ref={frame}
            className="letter-frame"
            title={msg.subject}
            sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            srcDoc={emailDocument(msg.html, images, theme === "dark")}
            onLoad={fit}
          />
        </>
      ) : (
        <pre className="letter-text">{msg.text || t.noText}</pre>
      )}

      {msg.attachments.length > 0 && (
        <div className="files">
          <h4>{t.attachments}</h4>
          <ul>
            {msg.attachments.map((a) => (
              <li key={a.id}>
                <Icon name="clip" size={16} />
                <span className="file-name">{a.filename}</span>
                <span className="muted">{bytes(a.size_bytes)}</span>
                <button type="button" className="btn btn-quiet" onClick={() => download(a.id, a.filename)}>
                  <Icon name="download" /> {t.download}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

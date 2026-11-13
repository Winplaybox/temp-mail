"use client";

import Link from "next/link";
import { useApp } from "./Providers";
import { Icon } from "./Icon";
import { LANDINGS } from "@/lib/landing";

export function Header() {
  const { t, lang, theme, toggleTheme } = useApp();
  return (
    <header className="site-header">
      <Link href="/" className="wordmark">
        <svg viewBox="0 0 40 28" className="wordmark-mark" aria-hidden="true">
          <rect x="1" y="1" width="38" height="26" rx="3" className="wm-env" />
          <path d="M1 4 L20 17 L39 4" className="wm-flap" />
        </svg>
        <span className="wordmark-text">
          {t.brand}
          <small>{t.brandBy}</small>
        </span>
      </Link>
      <nav className="header-nav" aria-label="Main">
        <a href={lang === "hi" ? "/hi#how" : "/#how"}>{t.stepsTitle}</a>
        <a href={lang === "hi" ? "/hi#faq" : "/#faq"}>{t.faqTitle}</a>
        <Link href="/10-minute-mail">10 min mail</Link>
      </nav>
      <div className="header-actions">
        <Link href={lang === "hi" ? "/" : "/hi"} className="btn btn-quiet" hrefLang={lang === "hi" ? "en" : "hi"} lang={lang === "hi" ? "en" : "hi"}>
          {t.language}
        </Link>
        <button
          type="button"
          className="btn btn-icon"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? t.themeLight : t.themeDark}
          title={theme === "dark" ? t.themeLight : t.themeDark}
        >
          <Icon name={theme === "dark" ? "sun" : "moon"} />
        </button>
      </div>
    </header>
  );
}

export function Hero({ h1, lead }: { h1?: string; lead?: string }) {
  const { t } = useApp();
  return (
    <div className="hero">
      <h1>{h1 ?? t.h1}</h1>
      <p className="lead">{lead ?? t.lead}</p>
    </div>
  );
}

export function SiteContent() {
  const { t } = useApp();
  return (
    <div className="content">
      <section className="about" aria-labelledby="about-title" id="about">
        <h2 id="about-title">{t.aboutTitle}</h2>
        {t.aboutBody.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </section>

      <section aria-labelledby="steps-title" id="how">
        <h2 id="steps-title">{t.stepsTitle}</h2>
        <ol className="steps">
          {t.steps.map((s) => (
            <li key={s.t}>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="features-title" id="features">
        <h2 id="features-title">{t.featuresTitle}</h2>
        <dl className="features">
          {t.features.map((f) => (
            <div key={f.t}>
              <dt>{f.t}</dt>
              <dd>{f.d}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="faq-title" className="faq" id="faq">
        <h2 id="faq-title">{t.faqTitle}</h2>
        {t.faq.map((f) => (
          <details key={f.q}>
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </section>
    </div>
  );
}

export function Footer() {
  const { t } = useApp();
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="footer-cols">
        <div>
          <p className="footer-brand">{t.brand}</p>
          <p>{t.footerNote}</p>
        </div>
        <nav aria-label="Temp mail tools">
          <p className="footer-head">Tools</p>
          <Link href="/">Temp mail</Link>
          {LANDINGS.map((l) => (
            <Link key={l.slug} href={`/${l.slug}`}>
              {l.title.split(" — ")[0]}
            </Link>
          ))}
          <Link href="/hi">टेम्प मेल (हिन्दी)</Link>
        </nav>
        <nav aria-label={t.moreTools}>
          <p className="footer-head">{t.moreTools}</p>
          <a href="https://winplaybox.in">WinPlayBox</a>
          <a href="https://ovd.winplaybox.in">OVD downloader</a>
          <a href="https://pricewatch.winplaybox.in">PriceWatch</a>
          <Link href="/privacy">{t.privacy}</Link>
          <Link href="/terms">{t.terms}</Link>
        </nav>
      </div>
      <p className="muted">© {year} WinPlayBox</p>
    </footer>
  );
}

import Link from "next/link";
import type { Landing } from "@/lib/landing";
import { LANDINGS } from "@/lib/landing";

/** Server-rendered copy for keyword pages — fully visible to crawlers without JS. */
export function LandingContent({ page }: { page: Landing }) {
  const others = LANDINGS.filter((l) => l.slug !== page.slug);
  return (
    <div className="content">
      {page.sections.map((s) => (
        <section key={s.h} className="about">
          <h2>{s.h}</h2>
          {s.p.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </section>
      ))}

      <section className="faq" id="faq" aria-labelledby="lfaq">
        <h2 id="lfaq">Questions</h2>
        {page.faq.map((f) => (
          <details key={f.q}>
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </section>

      <section aria-labelledby="more" className="more-tools">
        <h2 id="more">More ways to use temp mail</h2>
        <ul>
          {others.map((l) => (
            <li key={l.slug}>
              <Link href={`/${l.slug}`}>{l.title.split(" — ")[0]}</Link>
              <span className="muted">{l.description.split(". ")[0]}.</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

import Script from "next/script";
import "../app/globals.css";
import { fontVars } from "../app/fonts";
import { Providers } from "./Providers";
import { Header, Footer } from "./Chrome";
import type { Lang } from "@/lib/i18n";

const ADSENSE = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

const themeBoot = `try{var t=localStorage.getItem('wpb.tm.theme');if(!t)t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t}catch(e){}`;

export function RootShell({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return (
    <html lang={lang} className={fontVars} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
        <link rel="preconnect" href="https://xatbfyiytcnogfbtfsym.supabase.co" crossOrigin="" />
        {ADSENSE && <link rel="preconnect" href="https://pagead2.googlesyndication.com" crossOrigin="" />}
      </head>
      <body>
        <a className="skip" href="#main">
          {lang === "hi" ? "इनबॉक्स पर जाएँ" : "Skip to inbox"}
        </a>
        <Providers initialLang={lang}>
          <div className="shell">
            <Header />
            <main id="main">{children}</main>
            <Footer />
          </div>
        </Providers>
        {ADSENSE && (
          <Script
            id="adsense"
            strategy="lazyOnload"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE}`}
            crossOrigin="anonymous"
          />
        )}
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/figtree";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Header, Footer } from "@/components/Chrome";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://temp-mail.winplaybox.in";
const ADSENSE = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "Temp Mail — Free Temporary Disposable Email | WinPlayBox",
    template: "%s | WinPlayBox Temp Mail",
  },
  description:
    "Get a free temporary email address in one click. Receive OTPs and verification mails instantly, block trackers, and let the inbox delete itself. No sign-up.",
  keywords: [
    "temp mail",
    "temporary email",
    "disposable email",
    "10 minute mail",
    "fake email generator",
    "burner email",
    "throwaway email",
    "temp mail india",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE,
    siteName: "WinPlayBox Temp Mail",
    title: "Temp Mail — Free Temporary Disposable Email",
    description: "A fresh inbox in one click. Receive codes instantly, then it deletes itself.",
  },
  twitter: { card: "summary", title: "Temp Mail by WinPlayBox", description: "Free disposable email that receives in seconds." },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e8eef5" },
    { media: "(prefers-color-scheme: dark)", color: "#0f2238" },
  ],
  width: "device-width",
  initialScale: 1,
};

const themeBoot = `try{var t=localStorage.getItem('wpb.tm.theme');if(!t)t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body>
        <a className="skip" href="#main">
          Skip to inbox
        </a>
        <Providers>
          <div className="shell">
            <Header />
            <main id="main">{children}</main>
            <Footer />
          </div>
        </Providers>
        {ADSENSE && (
          <Script
            async
            strategy="afterInteractive"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE}`}
            crossOrigin="anonymous"
          />
        )}
      </body>
    </html>
  );
}

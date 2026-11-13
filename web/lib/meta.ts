import type { Metadata, Viewport } from "next";
import { SITE } from "./seo";

export const baseMetadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "Temp Mail — Free Temporary Disposable Email | WinPlayBox",
    template: "%s | WinPlayBox Temp Mail",
  },
  description:
    "Free temp mail: get a temporary disposable email address in one click. Receive OTPs and verification mails instantly, block trackers, auto-delete. No sign-up.",
  applicationName: "WinPlayBox Temp Mail",
  keywords: [
    "temp mail",
    "temporary email",
    "disposable email",
    "10 minute mail",
    "fake email generator",
    "burner email",
    "throwaway email",
    "temp mail for otp",
    "temp mail india",
    "temporary email address free",
  ],
  authors: [{ name: "WinPlayBox", url: "https://winplaybox.in" }],
  creator: "WinPlayBox",
  publisher: "WinPlayBox",
  category: "utilities",
  formatDetection: { email: false, telephone: false, address: false },
  openGraph: {
    type: "website",
    siteName: "WinPlayBox Temp Mail",
    locale: "en_IN",
    alternateLocale: ["hi_IN"],
  },
  twitter: { card: "summary_large_image" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  verification: process.env.NEXT_PUBLIC_GSC_VERIFICATION ? { google: process.env.NEXT_PUBLIC_GSC_VERIFICATION } : undefined,
  other: process.env.NEXT_PUBLIC_ADSENSE_CLIENT ? { "google-adsense-account": process.env.NEXT_PUBLIC_ADSENSE_CLIENT } : undefined,
};

export const baseViewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e8eef5" },
    { media: "(prefers-color-scheme: dark)", color: "#0f2238" },
  ],
  width: "device-width",
  initialScale: 1,
};

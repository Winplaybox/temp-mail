import type { Metadata } from "next";
import { Hero, SiteContent } from "@/components/Chrome";
import { TempMailApp } from "@/components/TempMailApp";
import { dictionaries } from "@/lib/i18n";
import { appSchema, faqSchema, jsonLd, SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: { absolute: "Temp Mail — Free Temporary Disposable Email Address | WinPlayBox" },
  alternates: { canonical: "/", languages: { en: "/", hi: "/hi", "x-default": "/" } },
  openGraph: {
    url: SITE,
    title: "Temp Mail — Free Temporary Disposable Email",
    description: "A fresh inbox in one click. Receive codes instantly, then it deletes itself. No sign-up.",
  },
};

export default function Home() {
  return (
    <>
      <Hero />
      <TempMailApp />
      <SiteContent />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd([appSchema, faqSchema(dictionaries.en.faq)])} />
    </>
  );
}

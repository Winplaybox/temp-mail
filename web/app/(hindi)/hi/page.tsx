import type { Metadata } from "next";
import { Hero, SiteContent } from "@/components/Chrome";
import { TempMailApp } from "@/components/TempMailApp";
import { dictionaries } from "@/lib/i18n";
import { appSchema, faqSchema, jsonLd, SITE } from "@/lib/seo";

const hi = dictionaries.hi;

export const metadata: Metadata = {
  title: { absolute: "टेम्प मेल — मुफ़्त अस्थायी ईमेल पता | WinPlayBox" },
  description:
    "एक क्लिक में मुफ़्त अस्थायी (टेम्प) ईमेल पता पाएँ। OTP और वेरिफ़िकेशन मेल तुरंत पाएँ, ट्रैकिंग रोकें, और पता अपने-आप मिट जाता है। कोई साइन-अप नहीं।",
  alternates: { canonical: "/hi", languages: { en: "/", hi: "/hi", "x-default": "/" } },
  openGraph: { url: `${SITE}/hi`, locale: "hi_IN", title: "टेम्प मेल — मुफ़्त अस्थायी ईमेल", description: hi.lead },
};

export default function HindiHome() {
  return (
    <>
      <Hero h1={hi.h1} lead={hi.lead} />
      <TempMailApp />
      <SiteContent />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd([{ ...appSchema, url: `${SITE}/hi`, inLanguage: "hi" }, faqSchema(hi.faq)])} />
    </>
  );
}
